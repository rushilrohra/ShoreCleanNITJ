import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import VolunteerDashboard from './pages/VolunteerDashboard';
import OrganizerDashboard from './pages/OrganizerDashboard';
import ScannerPage from './pages/ScannerPage';
import VerificationPage from './pages/VerificationPage';

// ── Simple home screen to pick which view to demo ────────────────────────────
function HomeScreen() {
    const navigate = useNavigate();

    const cardStyle = {
        flex: '1 1 260px',
        background: 'rgba(255,255,255,0.1)',
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(255,255,255,0.2)',
        borderRadius: '20px',
        padding: '32px 24px',
        cursor: 'pointer',
        textAlign: 'center',
        transition: 'all 0.2s ease',
    };

    return (
        <div style={{
            minHeight: '100vh',
            background: 'linear-gradient(135deg, #0A2540 0%, #0891B2 100%)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: 'Arial, sans-serif',
            padding: '24px',
        }}>
            {/* Logo */}
            <div style={{ textAlign: 'center', marginBottom: '48px' }}>
                <div style={{ fontSize: '64px', marginBottom: '16px' }}>🌊</div>
                <h1 style={{ margin: 0, color: 'white', fontSize: '42px', fontWeight: '800', letterSpacing: '-1px' }}>
                    ShoreClean
                </h1>
                <p style={{ margin: '12px 0 0', color: '#BAE6FD', fontSize: '16px' }}>
                    Gamified Beach Cleanup Platform
                </p>
            </div>

            {/* Role Cards */}
            <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', justifyContent: 'center', maxWidth: '960px', width: '100%' }}>

                {/* Volunteer */}
                <div
                    style={cardStyle}
                    onClick={() => navigate('/volunteer')}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.18)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                >
                    <div style={{ fontSize: '48px', marginBottom: '14px' }}>🙋</div>
                    <h2 style={{ margin: '0 0 8px', color: 'white', fontSize: '20px', fontWeight: '800' }}>Volunteer</h2>
                    <p style={{ margin: '0 0 20px', color: '#BAE6FD', fontSize: '13px', lineHeight: '1.6' }}>
                        View your impact, badges, and download certificates
                    </p>
                    <div style={{ background: '#2563EB', color: 'white', padding: '10px 20px', borderRadius: '10px', fontWeight: '700', fontSize: '14px' }}>
                        Go to Dashboard →
                    </div>
                </div>

                {/* Organizer */}
                <div
                    style={cardStyle}
                    onClick={() => navigate('/organizer')}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.18)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                >
                    <div style={{ fontSize: '48px', marginBottom: '14px' }}>🏢</div>
                    <h2 style={{ margin: '0 0 8px', color: 'white', fontSize: '20px', fontWeight: '800' }}>NGO / Organizer</h2>
                    <p style={{ margin: '0 0 20px', color: '#BAE6FD', fontSize: '13px', lineHeight: '1.6' }}>
                        Create events, generate AI posters, send invitations
                    </p>
                    <div style={{ background: '#0891B2', color: 'white', padding: '10px 20px', borderRadius: '10px', fontWeight: '700', fontSize: '14px' }}>
                        Go to Dashboard →
                    </div>
                </div>

                {/* QR Scanner */}
                <div
                    style={cardStyle}
                    onClick={() => navigate('/scanner')}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.18)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                >
                    <div style={{ fontSize: '48px', marginBottom: '14px' }}>📸</div>
                    <h2 style={{ margin: '0 0 8px', color: 'white', fontSize: '20px', fontWeight: '800' }}>QR Scanner</h2>
                    <p style={{ margin: '0 0 20px', color: '#BAE6FD', fontSize: '13px', lineHeight: '1.6' }}>
                        Scan volunteer QR codes to check in &amp; check out at the event
                    </p>
                    <div style={{ background: '#059669', color: 'white', padding: '10px 20px', borderRadius: '10px', fontWeight: '700', fontSize: '14px' }}>
                        Open Scanner →
                    </div>
                </div>

            </div>

            <p style={{ color: 'rgba(255,255,255,0.3)', marginTop: '48px', fontSize: '12px' }}>
                ShoreClean · Hackathon Demo 2026
            </p>
        </div>
    );
}

// ── Simple top nav bar ────────────────────────────────────────────────────────
function Topbar({ role }) {
    const navigate = useNavigate();
    const colors = { volunteer: '#2563EB', organizer: '#0891B2', scanner: '#059669' };
    const labels = { volunteer: '🙋 Volunteer', organizer: '🏢 Organizer', scanner: '📸 Scanner' };

    return (
        <div style={{
            background: '#0A2540',
            padding: '14px 32px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontFamily: 'Arial, sans-serif',
        }}>
            <div style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px' }} onClick={() => navigate('/')}>
                <span style={{ fontSize: '22px' }}>🌊</span>
                <span style={{ color: 'white', fontWeight: '800', fontSize: '18px' }}>ShoreClean</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <span style={{
                    background: colors[role] || '#2563EB',
                    color: 'white', padding: '4px 12px',
                    borderRadius: '20px', fontSize: '12px', fontWeight: '700',
                }}>
                    {labels[role] || role}
                </span>
                <button
                    onClick={() => navigate('/')}
                    style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', color: '#94A3B8', padding: '6px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px' }}
                >
                    ← Home
                </button>
            </div>
        </div>
    );
}

// ── App ───────────────────────────────────────────────────────────────────────
function App() {
    return (
        <Router>
            <Routes>
                <Route path="/"          element={<HomeScreen />} />
                <Route path="/volunteer" element={
                    <>
                        <Topbar role="volunteer" />
                        <VolunteerDashboard />
                    </>
                } />
                <Route path="/organizer" element={
                    <>
                        <Topbar role="organizer" />
                        <OrganizerDashboard />
                    </>
                } />
                <Route path="/scanner"   element={<ScannerPage />} />
                <Route path="/verify/:hash" element={<VerificationPage />} />
                {/* Catch-all */}
                <Route path="*" element={<Navigate to="/" />} />
            </Routes>
        </Router>
    );
}

export default App;
