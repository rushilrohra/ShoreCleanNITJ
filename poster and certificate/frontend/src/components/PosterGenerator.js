import React, { useState, useEffect, useRef } from 'react';
import { posterApi, eventsApi } from '../services/api';

const API_ORIGIN = process.env.REACT_APP_API_BASE
    ? new URL(process.env.REACT_APP_API_BASE).origin
    : 'http://localhost:5000';

const LOADING_STEPS = [
    { icon: '🤖', text: 'AI is crafting your professional copy...' },
    { icon: '🎨', text: 'Designing the NGO-standard layout...' },
    { icon: '✨', text: 'Finalizing your corporate 8k poster...' },
];

export default function PosterGenerator() {
    const [events, setEvents] = useState([]);
    const [selectedEvent, setSelectedEvent] = useState('');
    const [heroImage, setHeroImage] = useState(null);
    const [imagePreview, setImagePreview] = useState(null);
    const [loading, setLoading] = useState(false);
    const [loadingStep, setLoadingStep] = useState(0);
    const [poster, setPoster] = useState(null);
    const [error, setError] = useState('');
    const previewRef = useRef(null);

    useEffect(() => { loadEvents(); }, []);

    // Animated loading steps
    useEffect(() => {
        if (!loading) return;
        const interval = setInterval(() => {
            setLoadingStep(prev => (prev + 1) % LOADING_STEPS.length);
        }, 2200);
        return () => clearInterval(interval);
    }, [loading]);

    // No inline preview: posters are emailed only. (Preview removed)

    const loadEvents = async () => {
        try {
            const result = await eventsApi.getMyEvents();
            if (Array.isArray(result) && result.length > 0) {
                setEvents(result);
            } else if (result && Array.isArray(result.events) && result.events.length > 0) {
                setEvents(result.events);
            } else {
                setEvents([
                    { id: 'demo-1', title: 'Demo Beach Cleanup', location_name: 'Juhu Beach, Mumbai', event_date: new Date().toISOString() },
                    { id: 'demo-2', title: 'Demo Coastal Care', location_name: 'Marina Beach, Chennai', event_date: new Date().toISOString() }
                ]);
            }
        } catch {
            setEvents([{ id: 'demo-1', title: 'Demo Beach Cleanup', location_name: 'Juhu Beach, Mumbai', event_date: new Date().toISOString() }]);
        }
    };

    const handleImageChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            if (file.size > 2 * 1024 * 1024) {
                setError('Please upload an image smaller than 2MB');
                return;
            }
            const reader = new FileReader();
            reader.onloadend = () => {
                setHeroImage(reader.result);
                setImagePreview(reader.result);
                setError('');
            };
            reader.readAsDataURL(file);
        }
    };

    const generatePoster = async () => {
        if (!selectedEvent) { setError('Please select an event'); return; }
        if (!heroImage) { setError('Please upload a hero photo first'); return; }

        // Log organizer email for debugging (reads from localStorage `user` set at login)
        try {
            const stored = localStorage.getItem('user');
            const parsed = stored ? JSON.parse(stored) : null;
            const organizerEmail = parsed?.email || (parsed && parsed.user && parsed.user.email) || 'unknown';
            console.log('→ Poster generation requested by organizer email:', organizerEmail);
        } catch (e) {
            console.log('→ Poster generation requested by organizer email: unable to read from localStorage');
        }

        setLoading(true);
        setLoadingStep(0);
        setError('');
        setPoster(null);

        try {
            // Simplified API call — no template selection needed
            const result = await posterApi.generate(selectedEvent, 'master', heroImage);
            if (result.success) {
                setPoster(result);
                setError('');
            } else {
                setError(result.error || 'Failed to generate poster');
            }
        } catch (err) {
            setError(err?.message || 'Error generating poster');
        }
        setLoading(false);
    };

    const downloadPoster = () => {
        if (poster) {
            const link = document.createElement('a');
            link.href = `${API_ORIGIN}${poster.posterUrl}`;
            link.download = `ShoreClean_AI_Poster.svg`;
            link.click();
        }
    };

    return (
        <div style={{ background: 'white', borderRadius: '16px', boxShadow: '0 4px 32px rgba(10,37,64,0.1)', padding: '32px', maxWidth: '1000px', margin: '0 auto' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '32px', borderBottom: '1px solid #F1F5F9', paddingBottom: '20px' }}>
                <span style={{ fontSize: '40px' }}>💎</span>
                <div>
                    <h2 style={{ margin: 0, fontSize: '24px', fontWeight: 800, color: '#0A2540' }}>Master AI Poster Generator</h2>
                    <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#64748B' }}>Corporate NGO Standard • High-Res AI SVG Export</p>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '32px' }}>
                {/* 1. Left: Event & Image selection */}
                <div>
                    <div style={{ marginBottom: '20px' }}>
                        <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#475569', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>1. Select Event</label>
                        <select
                            value={selectedEvent}
                            onChange={(e) => setSelectedEvent(e.target.value)}
                            style={{ width: '100%', padding: '12px 14px', border: '1px solid #E2E8F0', borderRadius: '12px', fontSize: '14px', background: '#F8FAFC', color: '#1E293B', outline: 'none' }}
                        >
                            <option value="">Choose an event...</option>
                            {(Array.isArray(events) ? events : []).map(event => (
                                <option key={event.id} value={event.id}>
                                    {event.title} — {event.location_name}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#475569', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>2. Upload Hero Photo</label>
                        <div style={{ position: 'relative', height: '140px', border: '2px dashed #CBD5E1', borderRadius: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#F8FAFC', overflow: 'hidden' }}>
                            {imagePreview ? (
                                <img src={imagePreview} alt="Hero" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                                <>
                                    <span style={{ fontSize: '24px', marginBottom: '8px' }}>📸</span>
                                    <span style={{ fontSize: '12px', color: '#94A3B8' }}>Click to upload cleanup photo</span>
                                </>
                            )}
                            <input
                                type="file"
                                accept="image/*"
                                onChange={handleImageChange}
                                style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }}
                            />
                        </div>
                        <p style={{ margin: '8px 0 0', fontSize: '11px', color: '#94A3B8' }}>Tip: Use photos of volunteers or collected waste.</p>
                    </div>
                </div>

                {/* 2. Right: AI Design Brief */}
                <div style={{ background: '#0A2540', borderRadius: '16px', padding: '24px', color: 'white' }}>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: '#F97316', textTransform: 'uppercase', marginBottom: '12px' }}>AI Design Brief</div>
                    <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '13px', lineHeight: '1.6', color: '#E2E8F0' }}>
                        <li>Top: Bold modern sans-serif Title</li>
                        <li>Center: High-quality volunteer photo</li>
                        <li>Bottom: Icon-driven impact panels</li>
                        <li>Footer: Safety Orange registration band</li>
                        <li>Tech: AI-powered cleanup intelligence</li>
                    </ul>
                    <div style={{ marginTop: '20px', padding: '12px', background: 'rgba(255,255,255,0.05)', borderRadius: '10px', fontSize: '12px' }}>
                        ✨ The AI will automatically craft professional NGO-style copy based on your event data.
                    </div>
                </div>
            </div>

            {/* Generate Button */}
            <button
                onClick={generatePoster}
                disabled={loading || !selectedEvent || !heroImage}
                style={{
                    width: '100%', padding: '16px 20px', borderRadius: '14px', border: 'none',
                    background: loading || !selectedEvent || !heroImage ? '#CBD5E1' : 'linear-gradient(135deg, #0A2540, #0891B2)',
                    color: 'white', fontSize: '16px', fontWeight: 700, cursor: loading || !selectedEvent || !heroImage ? 'not-allowed' : 'pointer',
                    boxShadow: loading || !selectedEvent || !heroImage ? 'none' : '0 8px 20px rgba(10,37,64,0.25)',
                    transition: 'all 0.2s',
                    textTransform: 'uppercase', letterSpacing: '1px'
                }}
            >
                {loading ? (
                    <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
                        <span style={{ fontSize: '24px', animation: 'pulse 1.5s infinite' }}>{LOADING_STEPS[loadingStep].icon}</span>
                        {LOADING_STEPS[loadingStep].text}
                    </span>
                ) : '✨ Generate Master AI Poster'}
            </button>

            {/* Error */}
            {error && (
                <div style={{ marginTop: '16px', padding: '12px 16px', background: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626', borderRadius: '12px', fontSize: '14px' }}>
                    ⚠️ {error}
                </div>
            )}

            {/* ═══ POSTER RESULT ═══ */}
            {poster && (
                <div style={{ marginTop: '32px', borderTop: '2px solid #F1F5F9', paddingTop: '32px' }}>
                    <div style={{ background: '#ECFDF5', border: '1px solid #10B981', borderRadius: '16px', padding: '24px', marginBottom: '32px', textAlign: 'center' }}>
                        <div style={{ fontSize: '48px', marginBottom: '16px' }}>📧</div>
                        <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: '#065F46' }}>Poster Successfully Emailed!</h3>
                        <p style={{ margin: '8px 0 0', fontSize: '14px', color: '#047857' }}>
                            A high-resolution version has been sent to <strong>your registered email</strong>.
                        </p>
                    </div>

                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                        <button
                            onClick={generatePoster}
                            disabled={loading}
                            style={{ flex: 1, padding: '14px', borderRadius: '12px', border: 'none', background: '#10B981', color: 'white', fontSize: '15px', fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 12px rgba(16,185,129,0.3)' }}
                        >🔁 Re-send Poster Email</button>

                        <button
                            onClick={() => setPoster(null)}
                            style={{ padding: '14px 24px', borderRadius: '12px', border: '1px solid #E2E8F0', background: 'white', color: '#0A2540', fontSize: '14px', fontWeight: 700, cursor: 'pointer' }}
                        >Done</button>
                    </div>
                </div>
            )}

            <style>{`
                @keyframes pulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.7; transform: scale(1.1); } }
            `}</style>
        </div>
    );
}