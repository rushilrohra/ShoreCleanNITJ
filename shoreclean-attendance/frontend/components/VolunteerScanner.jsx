import { useState, useEffect, useRef, useCallback } from 'react';
import jsQR from 'jsqr';
import { scanAPI } from '../lib/api';
import FloatingInfo from './FloatingInfo';

const REAR_CAMERA_LABEL_REGEX = /(back|rear|environment)/i;
const QR_DEBUG = process.env.NODE_ENV !== 'production' || process.env.NEXT_PUBLIC_QR_DEBUG === 'true';

const debugLog = (...args) => {
  if (QR_DEBUG) {
    console.log('[QR][VolunteerScanner]', ...args);
  }
};

const debugWarn = (...args) => {
  if (QR_DEBUG) {
    console.warn('[QR][VolunteerScanner]', ...args);
  }
};

const serializeError = (errorLike) => {
  if (!errorLike) return { message: 'unknown error' };
  return {
    name: errorLike.name,
    message: String(errorLike.message || errorLike || 'unknown error'),
    stack: errorLike.stack ? String(errorLike.stack).split('\n').slice(0, 3).join(' | ') : undefined,
  };
};

const safeStopAndClear = async (scanner, context) => {
  if (!scanner) return;

  try {
    await scanner.stop();
    debugLog(`${context}: scanner.stop() ok`);
  } catch (error) {
    const message = String(error?.message || error || 'unknown stop error');
    if (message.includes('scanner is not running or paused')) {
      debugWarn(`${context}: scanner.stop() skipped (already stopped)`);
    } else {
      debugWarn(`${context}: scanner.stop() error`, message);
    }
  }

  try {
    await scanner.clear();
    debugLog(`${context}: scanner.clear() ok`);
  } catch (error) {
    debugWarn(`${context}: scanner.clear() error`, String(error?.message || error || 'unknown clear error'));
  }
};

const isPermissionError = (errorLike) => {
  const text = String(errorLike?.message || errorLike || '');
  return text.includes('NotAllowedError') || text.includes('Permission') || text.includes('denied');
};

const isCameraNotFoundError = (errorLike) => {
  const text = String(errorLike?.message || errorLike || '');
  return text.includes('NotFoundError') || text.includes('Requested device not found');
};

const isLocalhostHost = (host) => {
  const h = String(host || '').toLowerCase();
  return h === 'localhost' || h === '127.0.0.1' || h === '::1';
};

const normalizeDecodedQrText = (raw) => {
  const text = String(raw || '').trim();
  if (!text) return '';

  if (text.startsWith('{') && text.endsWith('}')) {
    try {
      const parsed = JSON.parse(text);
      return String(parsed?.qr_token || parsed?.token || parsed?.qr || text).trim();
    } catch {
      return text;
    }
  }

  if (/^https?:\/\//i.test(text)) {
    try {
      const url = new URL(text);
      return String(url.searchParams.get('qr_token') || url.searchParams.get('token') || text).trim();
    } catch {
      return text;
    }
  }

  return text;
};

const preprocessImageForQrScan = async (file) => {
  const objectUrl = URL.createObjectURL(file);

  try {
    const image = await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Image load failed'));
      img.src = objectUrl;
    });

    const maxDimension = 1800;
    const scale = Math.min(1, maxDimension / Math.max(image.width, image.height));
    const width = Math.max(1, Math.round(image.width * scale));
    const height = Math.max(1, Math.round(image.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Canvas context unavailable');
    }

    // Draw on a white base so transparent PNG/SVG exports remain scannable.
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(image, 0, 0, width, height);

    const blob = await new Promise((resolve) => {
      canvas.toBlob((result) => resolve(result), 'image/png', 1);
    });

    if (!blob) {
      throw new Error('Image processing failed');
    }

    return new File([blob], `processed-${file.name}.png`, { type: 'image/png' });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
};

const loadImageFromFile = async (file) => {
  const objectUrl = URL.createObjectURL(file);

  try {
    return await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Image load failed'));
      img.src = objectUrl;
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
};

const decodeWithJsQr = async (file) => {
  const image = await loadImageFromFile(file);
  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;

  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, image.width, image.height);
  ctx.drawImage(image, 0, 0);

  const imageData = ctx.getImageData(0, 0, image.width, image.height);
  const result = jsQR(imageData.data, imageData.width, imageData.height, {
    inversionAttempts: 'attemptBoth',
  });

  return String(result?.data || '').trim();
};

export default function VolunteerScanner(props) {
  const { eventId, onScanResult } = props;

  const [activeScanType, setActiveScanType] = useState(props.scanType || 'checkin');
  const [isScanning, setIsScanning] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastResult, setLastResult] = useState(null);
  const [scanCount, setScanCount] = useState(0);
  const [cameraError, setCameraError] = useState(null);
  const [scannerKey, setScannerKey] = useState(0);
  const [selectedImageFile, setSelectedImageFile] = useState(null);
  const [selectedImagePreviewUrl, setSelectedImagePreviewUrl] = useState('');
  const [selectedImageName, setSelectedImageName] = useState('');
  const [imageScanError, setImageScanError] = useState('');
  const [liveHint, setLiveHint] = useState('');

  const scannerRef = useRef(null);
  const isProcessingRef = useRef(false);
  const clearResultTimerRef = useRef(null);
  const startupInProgressRef = useRef(false);
  const lastLiveDecodeAtRef = useRef(Date.now());
  const liveScanStartAtRef = useRef(0);
  const activeScanTypeRef = useRef(activeScanType);
  const eventIdRef = useRef(eventId);
  const onScanResultRef = useRef(onScanResult);

  useEffect(() => {
    setActiveScanType(props.scanType || 'checkin');
  }, [props.scanType]);

  useEffect(() => {
    activeScanTypeRef.current = activeScanType;
  }, [activeScanType]);

  useEffect(() => {
    eventIdRef.current = eventId;
  }, [eventId]);

  useEffect(() => {
    onScanResultRef.current = onScanResult;
  }, [onScanResult]);

  const handleScanDecode = useCallback(
    async (decodedText, scannerInstance) => {
      const normalizedQr = normalizeDecodedQrText(decodedText);
      if (!normalizedQr) {
        debugWarn('decode ignored: empty decoded text', decodedText);
        return;
      }

      lastLiveDecodeAtRef.current = Date.now();
      setLiveHint('');

      if (isProcessingRef.current) return;
      isProcessingRef.current = true;
      setIsProcessing(true);
      const scanType = activeScanTypeRef.current;
      const selectedEventId = eventIdRef.current;
      debugLog('processing scan', {
        activeScanType: scanType,
        eventId: selectedEventId,
        tokenPreview: `${normalizedQr.slice(0, 24)}...`,
      });

      try {
        scannerInstance?.pause(true);
        debugLog('scanner paused for processing');
      } catch {
        debugWarn('scanner pause failed, continuing processing');
        // pause may fail in some transient states; continue processing scan
      }

      try {
        const response = await scanAPI.scan(normalizedQr, scanType, selectedEventId);
        const data = response.data;
        debugLog('scan API success', data);

        setLastResult({ success: true, ...data });
        setScanCount((prev) => prev + 1);
        onScanResultRef.current?.({ success: true, ...data });
      } catch (err) {
        const message =
          err.response?.data?.message ||
          err.response?.data?.error ||
          'Scan failed. Please try again.';
        debugWarn('scan API failed', {
          message,
          status: err.response?.status,
          response: err.response?.data,
        });
        setLastResult({ success: false, message });
        onScanResultRef.current?.({ success: false, message });
      } finally {
        setIsProcessing(false);
        // We keep isProcessingRef.current = true for a 5-second cooldown
        // to prevent the rapid re-scanning of the same QR code seen in the logs.
        
        if (clearResultTimerRef.current) {
          clearTimeout(clearResultTimerRef.current);
        }

        clearResultTimerRef.current = setTimeout(() => {
          setLastResult(null);
          isProcessingRef.current = false;
          try {
            scannerInstance?.resume();
            debugLog('scanner resumed after 5s cooldown');
          } catch {
            debugWarn('scanner resume skipped');
          }
        }, 5000);
      }
    },
    []
  );

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    if (!eventId) return undefined;

    let cancelled = false;
    let localScanner = null;

    const startScanner = async () => {
      if (startupInProgressRef.current) {
        debugWarn('startScanner ignored: startup already in progress');
        return;
      }

      startupInProgressRef.current = true;
      try {
        debugLog('startScanner begin', { eventId, scannerKey });
        setIsScanning(false);

        const isSecure = window.isSecureContext;
        const host = window.location?.hostname || '';
        if (!isSecure && !isLocalhostHost(host)) {
          setCameraError('Camera requires a secure origin. Open this app on HTTPS (or localhost) and try again.');
          debugWarn('blocked camera start due to insecure context', {
            host,
            protocol: window.location?.protocol,
            isSecure,
          });
          return;
        }

        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          setCameraError('This browser does not support camera access for scanning.');
          debugWarn('mediaDevices/getUserMedia unavailable');
          return;
        }

        const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import('html5-qrcode');
        debugLog('html5-qrcode imported');
        if (cancelled) return;

        const cameras = await Html5Qrcode.getCameras().catch(() => []);
        debugLog('cameras fetched', cameras);
        if (cancelled) return;

        const preferredCamera = cameras.find((camera) =>
          REAR_CAMERA_LABEL_REGEX.test(String(camera?.label || ''))
        );

        const scanConfig = {
          fps: 16,
          disableFlip: false,
          formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
          qrbox: (viewfinderWidth, viewfinderHeight) => {
            const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
            const size = Math.max(220, Math.floor(minEdge * 0.7));
            return { width: size, height: size };
          },
        };

        const rawCandidates = [
          preferredCamera?.id,
          cameras[0]?.id,
          { facingMode: { ideal: 'environment' } },
          { facingMode: 'environment' },
          { facingMode: 'user' },
        ].filter(Boolean);

        const dedupe = new Set();
        const startCandidates = rawCandidates.filter((candidate) => {
          const key = typeof candidate === 'string' ? `id:${candidate}` : JSON.stringify(candidate);
          if (dedupe.has(key)) return false;
          dedupe.add(key);
          return true;
        });

        let started = false;
        let lastStartError = null;

        for (const cameraConfig of startCandidates) {
          if (cancelled) return;

          const attemptScanner = new Html5Qrcode('qr-reader');
          debugLog('scanner instance created for start attempt');

          try {
            debugLog('starting scanner with config', cameraConfig);
            await attemptScanner.start(
              cameraConfig,
              scanConfig,
              (decodedText) => handleScanDecode(decodedText, attemptScanner),
              (errorMessage) => {
                if (
                  String(errorMessage || '').includes('NotFoundException') ||
                  String(errorMessage || '').includes('No MultiFormat Readers')
                ) {
                  return;
                }

                // These callbacks are typically per-frame decode misses; keep scanner running.
                debugWarn('live decode callback warning', errorMessage);
              }
            );

            started = true;
            localScanner = attemptScanner;
            scannerRef.current = attemptScanner;
            debugLog('scanner start succeeded with config', cameraConfig);
            break;
          } catch (startError) {
            lastStartError = startError;
            debugWarn('scanner start attempt failed', {
              config: cameraConfig,
              error: serializeError(startError),
            });

            await safeStopAndClear(attemptScanner, 'start-attempt-failed-cleanup');
          }
        }

        if (!started) {
          throw lastStartError || new Error('Unable to start camera');
        }

        if (cancelled) {
          debugWarn('startScanner resolved after cancellation; cleaning up instance');
          await safeStopAndClear(localScanner, 'startScanner-cancelled');
          return;
        }

        setIsScanning(true);
        lastLiveDecodeAtRef.current = Date.now();
        liveScanStartAtRef.current = Date.now();
        setLiveHint('');
        setCameraError(null);
        debugLog('scanner started successfully');
      } catch (error) {
        debugWarn('startScanner failed', serializeError(error));
        if (isPermissionError(error)) {
          setCameraError(
            'Camera permission denied. Please allow camera access in your browser settings and refresh the page.'
          );
        } else if (isCameraNotFoundError(error)) {
          setCameraError('No camera device was found. Connect a camera and try again.');
        } else {
          setCameraError('Could not start camera. Please try the Retry button or refresh the page.');
        }
        setIsScanning(false);
      } finally {
        startupInProgressRef.current = false;
      }
    };

    startScanner();

    return () => {
      cancelled = true;
      debugLog('scanner effect cleanup begin');

      if (clearResultTimerRef.current) {
        clearTimeout(clearResultTimerRef.current);
      }

      if (scannerRef.current) {
        const scannerToCleanup = scannerRef.current;
        scannerRef.current = null;
        void safeStopAndClear(scannerToCleanup, 'effect-cleanup');
      }

      localScanner = null;
      startupInProgressRef.current = false;

      setIsScanning(false);
    };
  }, [eventId, scannerKey, handleScanDecode]);

  useEffect(() => {
    if (!isScanning) {
      setLiveHint('');
      return undefined;
    }

    const interval = setInterval(() => {
      const now = Date.now();
      const secondsSinceDecode = Math.floor((now - lastLiveDecodeAtRef.current) / 1000);
      const secondsSinceStart = Math.floor((now - liveScanStartAtRef.current) / 1000);

      if (secondsSinceStart >= 8 && secondsSinceDecode >= 8) {
        setLiveHint('Scanner is active but no QR was detected yet. Move closer, reduce glare, and keep QR centered.');
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isScanning]);

  useEffect(() => {
    if (!isScanning) return undefined;

    const interval = setInterval(async () => {
      if (isProcessingRef.current) return;
      if (Date.now() - lastLiveDecodeAtRef.current < 5000) return;

      try {
        const video = document.querySelector('#qr-reader video');
        if (!video || video.readyState < 2 || video.videoWidth < 2 || video.videoHeight < 2) {
          return;
        }

        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) return;

        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const result = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: 'attemptBoth',
        });

        if (result?.data) {
          debugLog('live jsQR fallback detected code');
          await handleScanDecode(result.data, scannerRef.current);
        }
      } catch (error) {
        debugWarn('live jsQR fallback failed', serializeError(error));
      }
    }, 1200);

    return () => clearInterval(interval);
  }, [isScanning, handleScanDecode]);

  useEffect(
    () => () => {
      if (selectedImagePreviewUrl) {
        URL.revokeObjectURL(selectedImagePreviewUrl);
      }
    },
    [selectedImagePreviewUrl]
  );

  const handleRetry = async () => {
    debugLog('retry requested');
    setCameraError(null);

    if (scannerRef.current) {
      const scannerToCleanup = scannerRef.current;
      scannerRef.current = null;
      try {
        await safeStopAndClear(scannerToCleanup, 'retry');
      } catch {
        debugWarn('retry cleanup failed unexpectedly');
      }
    }

    setIsScanning(false);

    setTimeout(() => {
      setScannerKey((k) => k + 1);
    }, 500);
  };

  const handleImageSelect = (e) => {
    const file = e.target.files?.[0] || null;

    if (selectedImagePreviewUrl) {
      URL.revokeObjectURL(selectedImagePreviewUrl);
    }

    const previewUrl = file ? URL.createObjectURL(file) : '';

    setSelectedImageFile(file);
    setSelectedImagePreviewUrl(previewUrl);
    setSelectedImageName(file?.name || '');
    setImageScanError('');
  };

  const handleImageScan = async () => {
    if (!selectedImageFile) {
      setImageScanError('Please choose an image first.');
      return;
    }

    debugLog('image scan start', {
      fileName: selectedImageFile.name,
      fileSize: selectedImageFile.size,
      fileType: selectedImageFile.type,
    });
    setImageScanError('');

    const tempId = `qr-upload-${Date.now()}`;
    const holder = document.createElement('div');
    holder.id = tempId;
    holder.style.display = 'none';
    document.body.appendChild(holder);

    try {
      const { Html5Qrcode } = await import('html5-qrcode');
      const fileScanner = new Html5Qrcode(tempId);

      let decoded = '';
      try {
        debugLog('image decode attempt: scanFile(file, true)');
        decoded = await fileScanner.scanFile(selectedImageFile, true);
      } catch {
        try {
          debugWarn('image decode retry: scanFile(file, false)');
          decoded = await fileScanner.scanFile(selectedImageFile, false);
        } catch {
          debugWarn('image decode fallback: preprocessing image');
          const processedFile = await preprocessImageForQrScan(selectedImageFile);
          try {
            debugLog('image decode attempt: scanFile(processed, true)');
            decoded = await fileScanner.scanFile(processedFile, true);
          } catch {
            debugWarn('image decode retry: scanFile(processed, false)');
            decoded = await fileScanner.scanFile(processedFile, false);
          }
        }
      }

      await fileScanner.clear().catch(() => {});
      const normalized = normalizeDecodedQrText(decoded);
      debugLog('image decode success', {
        rawPreview: String(decoded || '').slice(0, 32),
        normalizedPreview: String(normalized || '').slice(0, 32),
      });
      if (!normalized) {
        throw new Error('Decoded value is empty');
      }

      await handleScanDecode(normalized, scannerRef.current);
    } catch (error) {
      debugWarn('image scan failed, trying jsQR fallback', String(error?.message || error || 'unknown error'));

      try {
        const processedFile = await preprocessImageForQrScan(selectedImageFile);
        const jsQrDecoded =
          (await decodeWithJsQr(selectedImageFile)) || (await decodeWithJsQr(processedFile));
        const normalized = normalizeDecodedQrText(jsQrDecoded);

        if (!normalized) {
          throw new Error('jsQR fallback decode failed');
        }

        debugLog('image decode success via jsQR fallback', {
          normalizedPreview: String(normalized).slice(0, 32),
        });
        await handleScanDecode(normalized, scannerRef.current);
      } catch (fallbackError) {
        debugWarn('image scan jsQR fallback failed', serializeError(fallbackError));
        setImageScanError('Could not decode this image. Try a clearer QR image.');
      }
    } finally {
      debugLog('image scan cleanup done');
      holder.remove();
    }
  };

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }} key={scannerKey}>
      <div
        style={{
          background: 'var(--ocean-800)',
          color: 'white',
          padding: 'var(--sp-4) var(--sp-5)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div className="font-display" style={{ fontSize: 16, fontWeight: 700 }}>
          🔍 QR Scanner
        </div>
        <span
          className="badge"
          style={{
            background: 'white',
            color: 'var(--ocean-700)',
            fontWeight: 700,
          }}
        >
          Scans: {scanCount}
        </span>
      </div>

      <div style={{ display: 'flex', width: '100%' }}>
        <button
          type="button"
          onClick={() => setActiveScanType('checkin')}
          style={{
            width: '50%',
            height: 48,
            fontSize: 14,
            fontWeight: 700,
            letterSpacing: '0.05em',
            border: 'none',
            cursor: 'pointer',
            transition: 'var(--t)',
            background: activeScanType === 'checkin' ? 'var(--ocean-600)' : 'var(--gray-100)',
            color: activeScanType === 'checkin' ? 'white' : 'var(--color-text-muted)',
          }}
        >
          CHECK IN
        </button>
        <button
          type="button"
          onClick={() => setActiveScanType('checkout')}
          style={{
            width: '50%',
            height: 48,
            fontSize: 14,
            fontWeight: 700,
            letterSpacing: '0.05em',
            border: 'none',
            cursor: 'pointer',
            transition: 'var(--t)',
            background: activeScanType === 'checkout' ? 'var(--green-500)' : 'var(--gray-100)',
            color: activeScanType === 'checkout' ? 'white' : 'var(--color-text-muted)',
          }}
        >
          CHECK OUT
        </button>
      </div>

      <div style={{ padding: 'var(--sp-4)' }}>
        {cameraError ? (
          <>
            <div className="alert alert-error" style={{ margin: 'var(--sp-4)' }}>
              <strong>Camera Error</strong>
              <br />
              {cameraError}
            </div>
            <button type="button" className="btn btn-primary btn-full" onClick={handleRetry}>
              Retry
            </button>
          </>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <div
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: isScanning ? 'var(--green-500)' : 'var(--gray-300)',
                  boxShadow: isScanning ? '0 0 6px var(--green-500)' : 'none',
                  animation: isScanning ? 'pulse 1.5s infinite' : 'none',
                }}
              />
              <span className="text-sm text-muted">
                {isScanning
                  ? 'Camera active — point at volunteer QR code'
                  : 'Starting camera…'}
              </span>
              <FloatingInfo
                title="Live Scan Tips"
                message="Keep the QR centered in the camera frame, avoid glare, and hold for 1-2 seconds for faster detection."
                placement="right"
              />
            </div>
            {liveHint ? (
              <div className="text-xs" style={{ color: 'var(--coral-500)', marginBottom: 8 }}>
                {liveHint}
              </div>
            ) : null}

            <div
              id="qr-reader"
              style={{ width: '100%', borderRadius: 'var(--r-md)', overflow: 'hidden' }}
            />

            <div
              style={{
                marginTop: 'var(--sp-4)',
                borderTop: '1px solid var(--color-border)',
                paddingTop: 'var(--sp-4)',
              }}
            >
              <div className="text-sm font-bold" style={{ marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
                Scan from image (optional)
                <FloatingInfo
                  title="Upload Tips"
                  message="PNG works best. Use a high-contrast image and avoid screenshots with blur or compression artifacts."
                  placement="right"
                />
              </div>
              <input type="file" accept="image/*" className="form-input" onChange={handleImageSelect} />
              <div className="text-xs text-muted" style={{ marginTop: 6 }}>
                {selectedImageName ? `Selected image: ${selectedImageName}` : 'No image selected'}
              </div>
              {selectedImagePreviewUrl ? (
                <div
                  style={{
                    marginTop: 'var(--sp-3)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--r-md)',
                    overflow: 'hidden',
                    background: 'white',
                  }}
                >
                  <img
                    src={selectedImagePreviewUrl}
                    alt="Selected QR upload"
                    style={{ width: '100%', maxHeight: 220, objectFit: 'contain', display: 'block' }}
                  />
                </div>
              ) : null}
              <button
                type="button"
                className="btn btn-secondary btn-sm btn-full"
                style={{ marginTop: 'var(--sp-3)' }}
                onClick={handleImageScan}
                disabled={!selectedImageFile || isProcessing}
              >
                Scan Selected Image
              </button>
              {imageScanError && (
                <div className="alert alert-error" style={{ marginTop: 'var(--sp-3)' }}>
                  {imageScanError}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {lastResult !== null && (
        <div
          style={{
            animation: 'result-in 0.25s ease',
            background: lastResult.success ? 'var(--green-100)' : 'var(--coral-100)',
            border: lastResult.success ? '1px solid #86efac' : '1px solid #fca5a5',
            borderRadius: 'var(--r-lg)',
            padding: 'var(--sp-5)',
            margin: '0 var(--sp-4) var(--sp-4)',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--sp-4)',
          }}
        >
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: '50%',
              background: lastResult.success ? 'var(--green-500)' : 'var(--coral-500)',
              color: 'white',
              fontSize: 24,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flex: '0 0 52px',
            }}
          >
            {lastResult.success ? '✓' : '✕'}
          </div>

          <div>
            {lastResult.success ? (
              <>
                <div className="font-bold" style={{ fontSize: 16 }}>
                  {lastResult.volunteer_name}
                </div>
                <div className="text-sm" style={{ color: 'var(--green-500)', marginTop: 2 }}>
                  {lastResult.message}
                </div>
                {lastResult.duration_mins ? (
                  <div
                    className="text-sm font-bold"
                    style={{ color: 'var(--ocean-700)', marginTop: 4 }}
                  >
                    ⏱ {lastResult.duration_mins} minutes
                  </div>
                ) : null}
              </>
            ) : (
              <>
                <div className="font-bold" style={{ fontSize: 16 }}>
                  Scan Error
                </div>
                <div className="text-sm" style={{ color: 'var(--coral-500)', marginTop: 2 }}>
                  {lastResult.message}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {isProcessing && (
        <div
          style={{
            width: '100%',
            padding: 'var(--sp-3) var(--sp-4)',
            background: 'var(--ocean-100)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <span className="spinner" />
          <span className="text-sm" style={{ color: 'var(--ocean-700)' }}>
            Processing scan…
          </span>
        </div>
      )}

      <style jsx global>{`
        @keyframes pulse {
          0%,
          100% {
            opacity: 1;
          }
          50% {
            opacity: 0.4;
          }
        }

        @keyframes result-in {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        #qr-reader {
          border: none !important;
        }

        #qr-reader video {
          border-radius: var(--r-md) !important;
        }

        #qr-reader__scan_region {
          border: none !important;
        }

        #qr-reader__dashboard {
          padding: 8px 0 0 !important;
          font-size: 13px !important;
        }

        #qr-reader__dashboard_section_csr button {
          background: var(--ocean-600) !important;
          color: white !important;
          border: none !important;
          border-radius: var(--r-md) !important;
          padding: 8px 16px !important;
          font-weight: 600 !important;
          cursor: pointer !important;
        }
      `}</style>
    </div>
  );
}
