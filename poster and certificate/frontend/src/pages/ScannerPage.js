import React, { useState, useEffect, useRef, useCallback } from 'react';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

// ─── Normalize decoded QR text ─────────────────────────────────────────────────
function normalizeQr(raw) {
    const text = String(raw || '').trim();
    if (!text) return '';
    if (text.startsWith('{') && text.endsWith('}')) {
        try {
            const parsed = JSON.parse(text);
            return String(parsed?.qr_token || parsed?.token || text).trim();
        } catch { return text; }
    }
    try {
        const url = new URL(text);
        return String(url.searchParams.get('qr_token') || url.searchParams.get('token') || text).trim();
    } catch { /* not a URL */ }
    return text;
}

// ─── Call our backend scan API ─────────────────────────────────────────────────
async function callScanApi(qr_token, scan_type, event_id) {
    const res = await fetch(`${API_BASE}/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ qr_token, scan_type, event_id }),
    });
    return res.json();
}

// ─── Safely stop and clear scanner ─────────────────────────────────────────────
async function safeStopAndClear(scanner) {
    if (!scanner) return;
    try { await scanner.stop(); } catch (e) { /* ignore */ }
    try { await scanner.clear(); } catch (e) { /* ignore */ }
}

export default function ScannerPage() {
    const [events, setEvents]               = useState([]);
    const [selectedEventId, setSelectedEventId] = useState('');
    const [scanType, setScanType]           = useState('checkin');
    const [isScanning, setIsScanning]       = useState(false);
    const [lastResult, setLastResult]       = useState(null);
    const [scanCount, setScanCount]         = useState(0);
    const [cameraError, setCameraError]     = useState('');
    const [isProcessing, setIsProcessing]   = useState(false);
    const [scannerKey, setScannerKey]       = useState(0);

    const scannerRef         = useRef(null);
    const isProcessingRef    = useRef(false);
    const clearTimerRef      = useRef(null);
    const scanTypeRef        = useRef(scanType);
    const selectedEventRef   = useRef(selectedEventId);

    useEffect(() => { scanTypeRef.current = scanType; }, [scanType]);
    useEffect(() => { selectedEventRef.current = selectedEventId; }, [selectedEventId]);

    // Load events
    useEffect(() => {
        fetch(`${API_BASE}/events`)
            .then(r => r.json())
            .then(data => setEvents(Array.isArray(data) ? data : []))
            .catch(() => {});
    }, []);

    const handleDecode = useCallback(async (decodedText, scannerInstance) => {
        const token = normalizeQr(decodedText);
        if (!token || isProcessingRef.current) return;

        isProcessingRef.current = true;
        setIsProcessing(true);

        try { scannerInstance?.pause(true); } catch {}

        try {
            const data = await callScanApi(token, scanTypeRef.current, selectedEventRef.current || undefined);

            if (data.success || data.message?.includes('✓')) {
                setLastResult({ success: true, message: data.message, name: data.volunteer_name });
                setScanCount(prev => prev + 1);
            } else {
                setLastResult({ success: false, message: data.message || 'Scan failed' });
            }
        } catch {
            setLastResult({ success: false, message: 'Network error. Please try again.' });
        } finally {
            setIsProcessing(false);
            isProcessingRef.current = false;
            if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
            clearTimerRef.current = setTimeout(() => {
                setLastResult(null);
                try { scannerInstance?.resume(); } catch {}
            }, 3500);
        }
    }, []);

    // Start camera scanner
    useEffect(() => {
        if (typeof window === 'undefined') return;
        let cancelled = false;
        let localScanner = null;

        (async () => {
            try {
                setIsScanning(false);
                const { Html5Qrcode } = await import('html5-qrcode');
                if (cancelled) return;

                // 1. Ask for permission and get cameras
                const cameras = await Html5Qrcode.getCameras();
                if (cancelled) return;

                if (!cameras || cameras.length === 0) {
                    throw new Error('NotFound: No camera found on this device');
                }

                // 2. Pick the first camera (or back camera if available)
                const cameraId = cameras[0].id;

                const scanner = new Html5Qrcode('qr-reader-div');
                localScanner = scanner;
                scannerRef.current = scanner;

                // 3. Start scanning
                await scanner.start(
                    cameraId,
                    { fps: 15, qrbox: { width: 260, height: 260 } },
                    (text) => handleDecode(text, scanner),
                    () => {}  // ignore per-frame decode errors
                );

                if (!cancelled) {
                    setIsScanning(true);
                    setCameraError('');
                }
            } catch (err) {
                const msg = String(err?.message || err || '');
                console.error("Camera Start Error:", err);
                
                if (msg.includes('Permission') || msg.includes('NotAllowed')) {
                    setCameraError('Camera permission denied! Please click the lock icon in the URL bar to allow camera access.');
                } else if (msg.includes('NotFound') || msg.includes('devices found')) {
                    setCameraError('No camera found. Connect a camera and retry.');
                } else {
                    setCameraError(`Could not start camera: ${msg}`);
                }
            }
        })();

        return () => {
            cancelled = true;
            if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
            if (scannerRef.current) {
                const s = scannerRef.current;
                scannerRef.current = null;
                void safeStopAndClear(s);
            }
            localScanner = null;
        };
    }, [scannerKey, handleDecode]);

    const handleRetry = () => {
        setCameraError('');
        setIsScanning(false);
        if (scannerRef.current) {
            const s = scannerRef.current;
            scannerRef.current = null;
            void safeStopAndClear(s);
        }
        setTimeout(() => setScannerKey(k => k + 1), 400);
    };

    const S = {
        page: {
            minHeight: '100vh', background: '#0A2540', fontFamily: 'Arial, sans-serif',
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            padding: '32px 16px',
        },
        card: {
            background: 'white', borderRadius: '16px', width: '100%',
            maxWidth: '480px', overflow: 'hidden', boxShadow: '0 24px 60px rgba(0,0,0,0.4)',
        },
        header: {
            background: '#0A2540', color: 'white', padding: '16px 20px',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        },
        tab: (active, color) => ({
            flex: 1, height: 46, border: 'none', cursor: 'pointer', fontWeight: 700,
            fontSize: 13, letterSpacing: '0.06em',
            background: active ? color : '#F3F4F6',
            color: active ? 'white' : '#6B7280',
            transition: 'all 0.15s',
        }),
    };

    return (
        <div style={S.page}>
            {/* Title */}
            <div style={{ textAlign: 'center', marginBottom: '28px' }}>
                <div style={{ fontSize: '36px' }}>🌊</div>
                <h1 style={{ color: 'white', fontWeight: 800, fontSize: '24px', margin: '8px 0 4px' }}>ShoreClean Scanner</h1>
                <p style={{ color: '#BAE6FD', fontSize: '13px', margin: 0 }}>NGO / Organizer QR Station</p>
            </div>

            <div style={S.card} key={scannerKey}>
                {/* Header */}
                <div style={S.header}>
                    <span style={{ fontWeight: 800, fontSize: '15px' }}>🔍 QR Scanner</span>
                    <span style={{
                        background: 'rgba(255,255,255,0.15)', padding: '4px 12px', borderRadius: '20px',
                        fontSize: '12px', fontWeight: 700,
                    }}>
                        Scans: {scanCount}
                    </span>
                </div>

                {/* Check-in / Check-out Tabs */}
                <div style={{ display: 'flex' }}>
                    <button style={S.tab(scanType === 'checkin', '#2563EB')} onClick={() => setScanType('checkin')}>
                        CHECK IN
                    </button>
                    <button style={S.tab(scanType === 'checkout', '#059669')} onClick={() => setScanType('checkout')}>
                        CHECK OUT
                    </button>
                </div>

                <div style={{ padding: '16px' }}>

                    {/* Event Selector */}
                    <div style={{ marginBottom: '14px' }}>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#374151', marginBottom: '5px' }}>
                            Event (optional — QR auto-identifies)
                        </label>
                        <select
                            value={selectedEventId}
                            onChange={e => setSelectedEventId(e.target.value)}
                            style={{ width: '100%', padding: '9px 12px', border: '1px solid #D1D5DB', borderRadius: '8px', fontSize: '13px' }}
                        >
                            <option value="">Auto-detect from QR</option>
                            {events.map(ev => (
                                <option key={ev.id} value={ev.id}>{ev.title}</option>
                            ))}
                        </select>
                    </div>

                    {/* Scan Status LED */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                        <div style={{
                            width: 8, height: 8, borderRadius: '50%',
                            background: isScanning ? '#10B981' : '#9CA3AF',
                            boxShadow: isScanning ? '0 0 6px #10B981' : 'none',
                        }} />
                        <span style={{ fontSize: '12px', color: '#6B7280' }}>
                            {isProcessing ? '⏳ Processing...' : isScanning ? 'Camera active — point at volunteer QR' : 'Starting camera…'}
                        </span>
                    </div>

                    {/* Camera */}
                    {cameraError ? (
                        <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '10px', padding: '16px', marginBottom: '12px' }}>
                            <p style={{ margin: '0 0 12px', color: '#DC2626', fontSize: '13px', fontWeight: 600 }}>⚠️ {cameraError}</p>
                            <button onClick={handleRetry} style={{ background: '#DC2626', color: 'white', border: 'none', padding: '8px 18px', borderRadius: '8px', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>
                                Retry
                            </button>
                        </div>
                    ) : (
                        <div id="qr-reader-div" style={{ width: '100%', borderRadius: '10px', overflow: 'hidden', minHeight: '220px', background: '#1F2937' }} />
                    )}

                    {/* Scan Result Banner */}
                    {lastResult && (
                        <div style={{
                            marginTop: '14px', padding: '14px 16px', borderRadius: '10px',
                            background: lastResult.success ? '#ECFDF5' : '#FEF2F2',
                            border: `1px solid ${lastResult.success ? '#6EE7B7' : '#FECACA'}`,
                        }}>
                            <p style={{ margin: '0 0 2px', fontWeight: 800, fontSize: '15px', color: lastResult.success ? '#065F46' : '#991B1B' }}>
                                {lastResult.success ? '✅' : '❌'} {lastResult.name ? `${lastResult.name}` : ''}
                            </p>
                            <p style={{ margin: 0, fontSize: '13px', color: lastResult.success ? '#047857' : '#DC2626' }}>
                                {lastResult.message}
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {/* Instructions */}
            <div style={{ maxWidth: '480px', width: '100%', marginTop: '20px', color: '#BAE6FD', fontSize: '12px', lineHeight: '1.8' }}>
                <p style={{ margin: '2px 0' }}>📱 Select CHECK IN or CHECK OUT above</p>
                <p style={{ margin: '2px 0' }}>📸 Point camera at a volunteer's QR code</p>
                <p style={{ margin: '2px 0' }}>✉️ On checkout, certificate is instantly emailed</p>
            </div>
        </div>
    );
}
