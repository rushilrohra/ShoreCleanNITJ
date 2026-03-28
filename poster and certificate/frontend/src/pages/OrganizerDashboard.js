import React, { useState, useEffect } from 'react';
import { eventsApi, adminApi } from '../services/api';

const LOADING_STEPS = [
    '🤖 Generating AI beach scene with Stability AI...',
    '🎨 Compositing your professional poster...',
    '📤 Uploading to Cloudinary...',
    '✉️ Sending poster to your email...',
];

export default function OrganizerDashboard() {
    const [events, setEvents]               = useState([]);
    const [loading, setLoading]             = useState(true);

    // Create event form
    const [showForm, setShowForm]           = useState(false);
    const [formData, setFormData]           = useState({ title: '', description: '', locationName: '', eventDate: '' });
    const [formLoading, setFormLoading]     = useState(false);
    const [formMsg, setFormMsg]             = useState('');

    // Poster generator
    const [selectedEvent, setSelectedEvent] = useState('');
    const [posterLoading, setPosterLoading] = useState(false);
    const [posterStep, setPosterStep]       = useState(0);
    const [posterResult, setPosterResult]   = useState(null);
    const [posterError, setPosterError]     = useState('');

    // Announcement
    const [announceEventId, setAnnounceEventId] = useState('');
    const [announceSending, setAnnounceSending] = useState(false);
    const [announceResult, setAnnounceResult]   = useState(null);

    // Copy feedback
    const [copied, setCopied] = useState('');

    useEffect(() => { fetchEvents(); }, []);

    // Cycle poster loading steps
    useEffect(() => {
        if (!posterLoading) return;
        const interval = setInterval(() => {
            setPosterStep(prev => (prev + 1) % LOADING_STEPS.length);
        }, 4000);
        return () => clearInterval(interval);
    }, [posterLoading]);

    async function fetchEvents() {
        setLoading(true);
        try {
            const result = await eventsApi.getMyEvents();
            setEvents(Array.isArray(result) ? result : result?.events || []);
        } catch {
            setEvents([]);
        } finally {
            setLoading(false);
        }
    }

    // ── Create Event ────────────────────────────────────────────────────────
    async function handleCreateEvent(e) {
        e.preventDefault();
        setFormLoading(true);
        setFormMsg('');
        try {
            const res = await eventsApi.create({
                title:              formData.title,
                description:        formData.description,
                locationName:       formData.locationName,
                latitude:           0,
                longitude:          0,
                eventDate:          formData.eventDate,
                expectedVolunteers: 50,
            });
            if (res.id) {
                setFormMsg('✅ Event created successfully!');
                setFormData({ title: '', description: '', locationName: '', eventDate: '' });
                setShowForm(false);
                fetchEvents();
            } else {
                setFormMsg('❌ ' + (res.error || 'Failed to create event'));
            }
        } catch {
            setFormMsg('❌ Network error. Please try again.');
        } finally {
            setFormLoading(false);
        }
    }

    // ── Generate Poster ─────────────────────────────────────────────────────
    async function handleGeneratePoster() {
        if (!selectedEvent) { setPosterError('Please select an event first.'); return; }
        setPosterLoading(true);
        setPosterStep(0);
        setPosterError('');
        setPosterResult(null);
        try {
            const result = await adminApi.generatePoster(selectedEvent);
            if (result.success) {
                setPosterResult(result);
            } else {
                setPosterError(result.error || 'Poster generation failed.');
            }
        } catch (err) {
            setPosterError(err?.message || 'Network error during poster generation.');
        } finally {
            setPosterLoading(false);
        }
    }

    // ── Send Announcement ───────────────────────────────────────────────────
    async function handleSendAnnouncement() {
        if (!announceEventId) return;
        setAnnounceSending(true);
        setAnnounceResult(null);
        try {
            const result = await adminApi.sendAnnouncement(announceEventId);
            setAnnounceResult(result);
        } catch {
            setAnnounceResult({ success: false, error: 'Network error. Try again.' });
        } finally {
            setAnnounceSending(false);
        }
    }

    // ── Copy Caption ────────────────────────────────────────────────────────
    function copyCaption(platform, text) {
        navigator.clipboard.writeText(text).then(() => {
            setCopied(platform);
            setTimeout(() => setCopied(''), 2000);
        });
    }

    const inputStyle = {
        width: '100%', padding: '10px 12px', border: '1px solid #D1D5DB',
        borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box', outline: 'none',
    };
    const labelStyle = { display: 'block', fontSize: '13px', fontWeight: '700', color: '#374151', marginBottom: '6px' };

    return (
        <div style={{ minHeight: '100vh', background: '#F3F4F6', padding: '32px', fontFamily: 'Arial, sans-serif' }}>
            <div style={{ maxWidth: '1100px', margin: '0 auto' }}>

                <h1 style={{ fontSize: '28px', fontWeight: '800', color: '#0A2540', marginBottom: '8px' }}>
                    🌊 Organizer Dashboard
                </h1>
                <p style={{ color: '#6B7280', marginBottom: '32px', fontSize: '14px' }}>
                    Create events, generate AI posters, and send invitations to all volunteers.
                </p>

                {/* ════════════════════════════════════════════════════════════ */}
                {/* SECTION 1: My Events                                         */}
                {/* ════════════════════════════════════════════════════════════ */}
                <div style={{ background: '#fff', borderRadius: '12px', padding: '24px', boxShadow: '0 1px 4px rgba(0,0,0,0.07)', marginBottom: '24px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                        <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: '#111827' }}>My Events</h2>
                        <button
                            onClick={() => setShowForm(!showForm)}
                            style={{ background: '#0A2540', color: 'white', border: 'none', padding: '10px 18px', borderRadius: '8px', fontSize: '14px', fontWeight: '700', cursor: 'pointer' }}
                        >
                            {showForm ? '✕ Cancel' : '+ Create New Event'}
                        </button>
                    </div>

                    {/* Create Event Form */}
                    {showForm && (
                        <form onSubmit={handleCreateEvent} style={{ background: '#F8FAFC', borderRadius: '10px', padding: '20px', marginBottom: '20px', border: '1px solid #E2E8F0' }}>
                            <h3 style={{ margin: '0 0 16px', fontSize: '15px', fontWeight: '700', color: '#374151' }}>New Event Details</h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                                <div>
                                    <label style={labelStyle}>Event Title *</label>
                                    <input style={inputStyle} required value={formData.title} onChange={e => setFormData(p => ({ ...p, title: e.target.value }))} placeholder="e.g. Juhu Beach Cleanup Drive" />
                                </div>
                                <div>
                                    <label style={labelStyle}>Description</label>
                                    <textarea style={{ ...inputStyle, minHeight: '70px', resize: 'vertical' }} value={formData.description} onChange={e => setFormData(p => ({ ...p, description: e.target.value }))} placeholder="Brief description of the event..." />
                                </div>
                                <div>
                                    <label style={labelStyle}>Location *</label>
                                    <input style={inputStyle} required value={formData.locationName} onChange={e => setFormData(p => ({ ...p, locationName: e.target.value }))} placeholder="e.g. Juhu Beach, Mumbai" />
                                </div>
                                <div>
                                    <label style={labelStyle}>Event Date & Time *</label>
                                    <input style={inputStyle} required type="datetime-local" value={formData.eventDate} onChange={e => setFormData(p => ({ ...p, eventDate: e.target.value }))} />
                                </div>
                            </div>
                            {formMsg && <p style={{ margin: '12px 0 0', fontSize: '13px', color: formMsg.startsWith('✅') ? '#10B981' : '#EF4444' }}>{formMsg}</p>}
                            <button type="submit" disabled={formLoading} style={{ marginTop: '16px', background: formLoading ? '#9CA3AF' : '#2563EB', color: 'white', border: 'none', padding: '12px 24px', borderRadius: '8px', fontSize: '14px', fontWeight: '700', cursor: formLoading ? 'not-allowed' : 'pointer' }}>
                                {formLoading ? 'Creating...' : 'Create Event'}
                            </button>
                        </form>
                    )}

                    {/* Events List */}
                    {loading ? (
                        <p style={{ color: '#9CA3AF', textAlign: 'center', padding: '20px' }}>Loading events...</p>
                    ) : events.length === 0 ? (
                        <p style={{ color: '#9CA3AF', textAlign: 'center', padding: '20px' }}>No events yet. Create your first event above!</p>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {events.map(event => (
                                <div key={event.id} style={{ border: '1px solid #E5E7EB', borderRadius: '10px', padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                                    <div>
                                        <p style={{ margin: '0 0 3px', fontWeight: '700', color: '#111827', fontSize: '15px' }}>{event.title}</p>
                                        <p style={{ margin: 0, fontSize: '13px', color: '#6B7280' }}>
                                            📍 {event.location_name} &nbsp;·&nbsp; 📅 {new Date(event.event_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                                        </p>
                                    </div>
                                    <span style={{ background: '#ECFDF5', color: '#065F46', padding: '4px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '700' }}>
                                        Active
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* ════════════════════════════════════════════════════════════ */}
                {/* SECTION 2: Send Event Invitation                             */}
                {/* ════════════════════════════════════════════════════════════ */}
                <div style={{ background: '#fff', borderRadius: '12px', padding: '24px', boxShadow: '0 1px 4px rgba(0,0,0,0.07)', marginBottom: '24px', border: '2px solid #0891B220' }}>
                    <h2 style={{ margin: '0 0 6px', fontSize: '18px', fontWeight: '700', color: '#111827' }}>📣 Send Event Invitation</h2>
                    <p style={{ margin: '0 0 20px', color: '#6B7280', fontSize: '13px' }}>
                        Select an event and send an invitation email to all registered volunteers instantly.
                    </p>

                    <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: '16px' }}>
                        <div style={{ flex: 1, minWidth: '200px' }}>
                            <label style={labelStyle}>Select Event to Announce</label>
                            <select
                                value={announceEventId}
                                onChange={e => { setAnnounceEventId(e.target.value); setAnnounceResult(null); }}
                                style={{ ...inputStyle, background: '#F8FAFC' }}
                            >
                                <option value="">Choose an event...</option>
                                {events.map(ev => (
                                    <option key={ev.id} value={ev.id}>{ev.title} — {ev.location_name}</option>
                                ))}
                            </select>
                        </div>
                        <button
                            onClick={handleSendAnnouncement}
                            disabled={announceSending || !announceEventId}
                            style={{
                                background: announceSending || !announceEventId ? '#9CA3AF' : '#0891B2',
                                color: 'white', border: 'none', padding: '10px 24px',
                                borderRadius: '8px', fontSize: '14px', fontWeight: '700',
                                cursor: announceSending || !announceEventId ? 'not-allowed' : 'pointer',
                                whiteSpace: 'nowrap',
                            }}
                        >
                            {announceSending ? '📤 Sending...' : '📣 Send Invitation to All Volunteers'}
                        </button>
                    </div>

                    {/* Result Banner */}
                    {announceResult && (
                        <div style={{
                            background: announceResult.success ? '#ECFDF5' : '#FEF2F2',
                            border: `1px solid ${announceResult.success ? '#6EE7B7' : '#FECACA'}`,
                            borderRadius: '10px', padding: '14px 18px',
                            display: 'flex', alignItems: 'center', gap: '12px',
                        }}>
                            <span style={{ fontSize: '22px' }}>{announceResult.success ? '✅' : '❌'}</span>
                            <div>
                                <p style={{ margin: 0, fontWeight: '700', fontSize: '14px', color: announceResult.success ? '#065F46' : '#991B1B' }}>
                                    {announceResult.success
                                        ? `Invitation sent to ${announceResult.recipientCount} volunteers!`
                                        : 'Failed to send invitation'}
                                </p>
                                {!announceResult.success && (
                                    <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#DC2626' }}>{announceResult.error}</p>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* ════════════════════════════════════════════════════════════ */}
                {/* SECTION 3: AI Poster Generator                               */}
                {/* ════════════════════════════════════════════════════════════ */}
                <div style={{ background: '#fff', borderRadius: '12px', padding: '24px', boxShadow: '0 1px 4px rgba(0,0,0,0.07)', marginBottom: '24px' }}>
                    <h2 style={{ margin: '0 0 6px', fontSize: '18px', fontWeight: '700', color: '#111827' }}>✨ AI Poster Generator</h2>
                    <p style={{ margin: '0 0 20px', color: '#6B7280', fontSize: '13px' }}>
                        Select an event → AI generates a professional poster → emailed to you + shareable link.
                    </p>

                    <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', marginBottom: '16px', flexWrap: 'wrap' }}>
                        <div style={{ flex: 1, minWidth: '200px' }}>
                            <label style={labelStyle}>Select Event</label>
                            <select
                                value={selectedEvent}
                                onChange={e => setSelectedEvent(e.target.value)}
                                style={{ ...inputStyle, background: '#F8FAFC' }}
                            >
                                <option value="">Choose an event...</option>
                                {events.map(ev => (
                                    <option key={ev.id} value={ev.id}>{ev.title} — {ev.location_name}</option>
                                ))}
                                <option value="demo-1">Demo — Juhu Beach Cleanup</option>
                                <option value="demo-2">Demo — Marina Coastal Care</option>
                            </select>
                        </div>
                        <button
                            onClick={handleGeneratePoster}
                            disabled={posterLoading || !selectedEvent}
                            style={{
                                background: posterLoading || !selectedEvent ? '#9CA3AF' : 'linear-gradient(135deg, #0A2540, #0891B2)',
                                color: 'white', border: 'none', padding: '10px 22px', borderRadius: '8px',
                                fontSize: '14px', fontWeight: '700',
                                cursor: posterLoading || !selectedEvent ? 'not-allowed' : 'pointer',
                                whiteSpace: 'nowrap',
                            }}
                        >
                            {posterLoading ? '⏳ Generating...' : '🎨 Generate AI Poster'}
                        </button>
                    </div>

                    {/* Loading */}
                    {posterLoading && (
                        <div style={{ background: '#F0F9FF', border: '1px solid #BFDBFE', borderRadius: '10px', padding: '20px', textAlign: 'center' }}>
                            <div style={{ fontSize: '32px', marginBottom: '10px' }}>⏳</div>
                            <p style={{ margin: 0, color: '#1D4ED8', fontWeight: '600', fontSize: '15px' }}>{LOADING_STEPS[posterStep]}</p>
                            <p style={{ margin: '6px 0 0', fontSize: '12px', color: '#60A5FA' }}>This may take 30–60 seconds...</p>
                        </div>
                    )}

                    {/* Error */}
                    {posterError && !posterLoading && (
                        <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '10px', padding: '16px', color: '#DC2626', fontSize: '14px' }}>
                            ⚠️ {posterError}
                        </div>
                    )}

                    {/* Poster Result */}
                    {posterResult && !posterLoading && (
                        <div style={{ marginTop: '20px' }}>
                            <div style={{ background: '#ECFDF5', border: '1px solid #6EE7B7', borderRadius: '10px', padding: '16px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <span style={{ fontSize: '24px' }}>✅</span>
                                <div>
                                    <p style={{ margin: '0 0 2px', fontWeight: '700', color: '#065F46', fontSize: '15px' }}>Poster Generated!</p>
                                    <p style={{ margin: 0, fontSize: '13px', color: '#047857' }}>
                                        {posterResult.emailSent ? '📧 Also emailed to your registered address.' : '⚠️ Email failed — use the download link below.'}
                                    </p>
                                </div>
                            </div>

                            <div style={{ border: '1px solid #E5E7EB', borderRadius: '10px', overflow: 'hidden', marginBottom: '16px' }}>
                                <img src={posterResult.posterUrl} alt="AI Generated Poster" style={{ width: '100%', display: 'block', maxHeight: '500px', objectFit: 'contain', background: '#F3F4F6' }} />
                            </div>

                            <a
                                href={posterResult.posterUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                download="ShoreClean_AI_Poster.png"
                                style={{ display: 'inline-block', background: '#0A2540', color: 'white', textDecoration: 'none', padding: '12px 24px', borderRadius: '8px', fontSize: '14px', fontWeight: '700', marginBottom: '28px' }}
                            >
                                ⬇ Download Poster PNG
                            </a>

                            {/* Social Captions */}
                            {posterResult.socialCaptions && (
                                <div>
                                    <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#111827', margin: '0 0 16px' }}>📱 Social Media Captions</h3>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                                        {[
                                            { key: 'instagram', label: '📸 Instagram', color: '#E1306C', bg: '#FDF2F8' },
                                            { key: 'linkedin',  label: '💼 LinkedIn',  color: '#0077B5', bg: '#EFF8FF' },
                                            { key: 'twitter',   label: '🐦 Twitter / X', color: '#1DA1F2', bg: '#F0F9FF' },
                                        ].map(({ key, label, color, bg }) => (
                                            <div key={key} style={{ background: bg, border: `1px solid ${color}30`, borderRadius: '10px', padding: '16px' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                                                    <span style={{ fontWeight: '700', color, fontSize: '14px' }}>{label}</span>
                                                    <button
                                                        onClick={() => copyCaption(key, posterResult.socialCaptions[key])}
                                                        style={{ background: color, color: 'white', border: 'none', padding: '5px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}
                                                    >
                                                        {copied === key ? '✅ Copied!' : '📋 Copy'}
                                                    </button>
                                                </div>
                                                <p style={{ margin: 0, fontSize: '13px', color: '#374151', whiteSpace: 'pre-wrap', lineHeight: '1.6' }}>
                                                    {posterResult.socialCaptions[key]}
                                                </p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
}
