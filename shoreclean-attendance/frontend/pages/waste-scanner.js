import { useEffect, useMemo, useRef, useState } from 'react';
import { NavSpacer } from '../components/Navbar';
import { samudraEndpoints } from '../lib/samudraApi';

const HAZARD_COLORS = {
  low: 'var(--green-500)',
  medium: 'var(--sand-500)',
  high: 'var(--coral-500)',
  unknown: 'var(--gray-500)',
};

export default function WasteScannerPage() {
  const [tab, setTab] = useState('upload');
  const [health, setHealth] = useState(null);
  const [loadingHealth, setLoadingHealth] = useState(true);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadPreview, setUploadPreview] = useState('');
  const [uploadLoading, setUploadLoading] = useState(false);
  const [liveActive, setLiveActive] = useState(false);
  const [liveLoading, setLiveLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const videoRef = useRef(null);
  const streamRef = useRef(null);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoadingHealth(true);
      try {
        const res = await samudraEndpoints.health();
        if (!active) return;
        setHealth(res.data);
      } catch {
        if (!active) return;
        setHealth({ status: 'error', model_loaded: false, error: 'SAMUDRA server is unreachable' });
      } finally {
        if (active) setLoadingHealth(false);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    return () => {
      stopLive();
      if (uploadPreview) URL.revokeObjectURL(uploadPreview);
    };
  }, [uploadPreview]);

  const hazardColor = useMemo(() => HAZARD_COLORS[result?.hazard] || HAZARD_COLORS.unknown, [result]);

  const stopLive = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setLiveActive(false);
  };

  const startLive = async () => {
    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setLiveActive(true);
    } catch {
      setError('Unable to access camera. Please allow camera permissions and retry.');
    }
  };

  const handlePickUpload = (event) => {
    const file = event.target.files?.[0] || null;
    setUploadFile(file);
    setResult(null);
    setError('');

    if (uploadPreview) URL.revokeObjectURL(uploadPreview);
    setUploadPreview(file ? URL.createObjectURL(file) : '');
  };

  const runUploadPrediction = async () => {
    if (!uploadFile) {
      setError('Select an image first.');
      return;
    }
    setUploadLoading(true);
    setError('');
    setResult(null);
    try {
      const res = await samudraEndpoints.upload(uploadFile);
      setResult(res.data);
    } catch (err) {
      setError(err.response?.data?.detail || 'Prediction failed for uploaded image.');
    } finally {
      setUploadLoading(false);
    }
  };

  const runLivePrediction = async () => {
    if (!videoRef.current) {
      setError('Camera is not active.');
      return;
    }

    const video = videoRef.current;
    if (video.readyState < 2 || !video.videoWidth || !video.videoHeight) {
      setError('Camera frame is not ready yet. Try again in a moment.');
      return;
    }

    setLiveLoading(true);
    setError('');
    setResult(null);
    try {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
      const res = await samudraEndpoints.live(dataUrl);
      setResult(res.data);
    } catch (err) {
      setError(err.response?.data?.detail || 'Live frame prediction failed.');
    } finally {
      setLiveLoading(false);
    }
  };

  return (
    <>
      <NavSpacer />
      <section style={{ background: 'var(--ocean-900)', color: 'white', padding: 'var(--sp-10) 0' }}>
        <div className="container">
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 34 }}>SAMUDRA Waste Scanner</h1>
          <p style={{ marginTop: 'var(--sp-2)', color: 'var(--ocean-300)' }}>
            Upload a beach waste image or analyze a live camera frame using your ONNX model.
          </p>

          <div style={{ marginTop: 'var(--sp-4)', fontSize: 13 }}>
            {loadingHealth ? (
              <span>Checking model server...</span>
            ) : health?.model_loaded ? (
              <span style={{ color: '#86efac' }}>Model server is online and ready.</span>
            ) : (
              <span style={{ color: '#fca5a5' }}>Model server unavailable: {health?.error || 'Unknown error'}</span>
            )}
          </div>
        </div>
      </section>

      <div className="container page-section" style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: 'var(--sp-6)' }}>
        <div className="card">
          <div style={{ display: 'flex', gap: 'var(--sp-2)', marginBottom: 'var(--sp-5)' }}>
            <button
              type="button"
              className="btn btn-sm"
              style={{
                background: tab === 'upload' ? 'var(--ocean-600)' : 'var(--gray-100)',
                color: tab === 'upload' ? 'white' : 'var(--color-text-muted)',
              }}
              onClick={() => {
                setTab('upload');
                stopLive();
              }}
            >
              Upload Image
            </button>
            <button
              type="button"
              className="btn btn-sm"
              style={{
                background: tab === 'live' ? 'var(--green-500)' : 'var(--gray-100)',
                color: tab === 'live' ? 'white' : 'var(--color-text-muted)',
              }}
              onClick={() => setTab('live')}
            >
              Live Scan
            </button>
          </div>

          {tab === 'upload' ? (
            <>
              <input type="file" accept="image/*" className="form-input" onChange={handlePickUpload} />
              {uploadPreview ? (
                <div style={{ marginTop: 'var(--sp-3)', borderRadius: 'var(--r-md)', overflow: 'hidden', border: '1px solid var(--color-border)' }}>
                  <img src={uploadPreview} alt="Upload preview" style={{ width: '100%', maxHeight: 360, objectFit: 'contain', background: 'white' }} />
                </div>
              ) : null}
              <button className="btn btn-primary btn-full" style={{ marginTop: 'var(--sp-4)' }} onClick={runUploadPrediction} disabled={uploadLoading}>
                {uploadLoading ? (<><span className="spinner" /> Running Prediction...</>) : 'Analyze Uploaded Image'}
              </button>
            </>
          ) : (
            <>
              <div style={{ borderRadius: 'var(--r-md)', overflow: 'hidden', border: '1px solid var(--color-border)', background: '#0b1220' }}>
                <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', display: 'block', minHeight: 300 }} />
              </div>

              <div style={{ display: 'flex', gap: 'var(--sp-3)', marginTop: 'var(--sp-4)' }}>
                {!liveActive ? (
                  <button type="button" className="btn btn-primary" onClick={startLive}>Start Camera</button>
                ) : (
                  <button type="button" className="btn btn-secondary" onClick={stopLive}>Stop Camera</button>
                )}

                <button type="button" className="btn btn-primary" onClick={runLivePrediction} disabled={!liveActive || liveLoading}>
                  {liveLoading ? (<><span className="spinner" /> Scanning...</>) : 'Scan Current Frame'}
                </button>
              </div>
            </>
          )}

          {error ? <div className="alert alert-error" style={{ marginTop: 'var(--sp-4)' }}>{error}</div> : null}
        </div>

        <div className="card">
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, marginBottom: 'var(--sp-3)' }}>Prediction Result</h2>
          {!result ? (
            <p className="text-muted">Run a scan to see prediction details.</p>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--sp-3)', marginBottom: 'var(--sp-4)' }}>
                <div>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 700 }}>{result.class}</div>
                  <div className="text-muted" style={{ marginTop: 2 }}>Confidence: {(result.confidence * 100).toFixed(1)}%</div>
                </div>
                <span className="badge" style={{ background: `${hazardColor}22`, color: hazardColor, border: `1px solid ${hazardColor}66` }}>
                  {String(result.hazard || 'unknown').toUpperCase()} RISK
                </span>
              </div>

              {result.festival ? (
                <div style={{ padding: 'var(--sp-3)', borderRadius: 'var(--r-md)', background: 'var(--sand-100)', color: 'var(--sand-700)', fontSize: 13, marginBottom: 'var(--sp-4)' }}>
                  Seasonal indicator: {result.festival}
                </div>
              ) : null}

              <div style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 'var(--sp-2)' }}>Top-5 predictions</div>
              <div style={{ display: 'grid', gap: 8 }}>
                {(result.top5 || []).map((item) => (
                  <div key={item.class} style={{ padding: 'var(--sp-2) var(--sp-3)', borderRadius: 'var(--r-md)', background: 'var(--gray-100)', display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                    <span>{item.class}</span>
                    <strong>{(item.confidence * 100).toFixed(1)}%</strong>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      <style jsx>{`
        @media (max-width: 900px) {
          .container.page-section {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </>
  );
}
