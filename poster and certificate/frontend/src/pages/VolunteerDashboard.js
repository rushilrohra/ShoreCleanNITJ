import React, { useState, useEffect } from 'react';
import { dashboardApi, certificatesApi } from '../services/api';
import LeaderboardCard from '../components/LeaderboardCard';

const BADGE_EMOJI = { Bronze: '🥉', Silver: '🥈', Gold: '🥇' };
const BADGE_COLOR = { Bronze: '#CD7F32', Silver: '#9CA3AF', Gold: '#F59E0B' };

export default function VolunteerDashboard() {
    const [dashboardData, setDashboardData] = useState(null);
    const [leaderboard, setLeaderboard]     = useState([]);
    const [certificates, setCertificates]   = useState([]);
    const [loading, setLoading]             = useState(true);

    useEffect(() => {
        const fetchAll = async () => {
            try {
                const [dashboard, lb, certs] = await Promise.all([
                    dashboardApi.getVolunteerDashboard(),
                    dashboardApi.getLeaderboard(),
                    certificatesApi.getMyCertificates(),
                ]);
                setDashboardData(dashboard);
                setLeaderboard(lb || []);
                setCertificates(Array.isArray(certs) ? certs : certs?.certificates || []);
            } catch (error) {
                console.error('Dashboard fetch error:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchAll();
    }, []);

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh', fontFamily: 'Arial, sans-serif', color: '#6B7280' }}>
                Loading your dashboard...
            </div>
        );
    }

    const badges = dashboardData?.badges || {};

    return (
        <div style={{ minHeight: '100vh', background: '#F3F4F6', padding: '32px', fontFamily: 'Arial, sans-serif' }}>
            <div style={{ maxWidth: '1100px', margin: '0 auto' }}>

                {/* Page Title */}
                <h1 style={{ fontSize: '28px', fontWeight: '800', color: '#111827', marginBottom: '28px' }}>
                    🌊 Your Impact Dashboard
                </h1>

                {/* ── Stats Cards ── */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '28px' }}>
                    {[
                        { label: 'Total Hours',     value: `${Number(badges.total_impact_hours || 0).toFixed(1)}h`,   color: '#2563EB' },
                        { label: 'Waste Collected', value: `${Number(badges.total_waste_collected_kg || 0).toFixed(1)} kg`, color: '#10B981' },
                        { label: 'Events Attended', value: Number(badges.total_events_attended || 0),                 color: '#7C3AED' },
                        { label: 'Global Rank',     value: badges.global_rank ? `#${badges.global_rank}` : '—',       color: '#F59E0B' },
                    ].map(stat => (
                        <div key={stat.label} style={{ background: '#fff', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
                            <p style={{ margin: '0 0 8px', fontSize: '11px', fontWeight: '700', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '1px' }}>{stat.label}</p>
                            <p style={{ margin: 0, fontSize: '28px', fontWeight: '800', color: stat.color }}>{stat.value}</p>
                        </div>
                    ))}
                </div>

                {/* ── Badges ── */}
                <div style={{ background: '#fff', borderRadius: '12px', padding: '24px', boxShadow: '0 1px 4px rgba(0,0,0,0.07)', marginBottom: '28px' }}>
                    <h2 style={{ fontSize: '18px', fontWeight: '700', color: '#111827', margin: '0 0 20px' }}>Achievements</h2>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
                        {['Bronze', 'Silver', 'Gold'].map(tier => (
                            <div key={tier} style={{ textAlign: 'center', padding: '20px', background: '#F9FAFB', borderRadius: '10px', border: `2px solid ${BADGE_COLOR[tier]}20` }}>
                                <div style={{ fontSize: '40px', marginBottom: '8px' }}>{BADGE_EMOJI[tier]}</div>
                                <p style={{ margin: '0 0 4px', fontWeight: '700', color: '#374151' }}>{tier}</p>
                                <p style={{ margin: 0, fontSize: '26px', fontWeight: '800', color: BADGE_COLOR[tier] }}>
                                    {badges[`${tier.toLowerCase()}_count`] || 0}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>

                {/* ── Certificates ── */}
                <div style={{ background: '#fff', borderRadius: '12px', padding: '24px', boxShadow: '0 1px 4px rgba(0,0,0,0.07)', marginBottom: '28px' }}>
                    <h2 style={{ fontSize: '18px', fontWeight: '700', color: '#111827', margin: '0 0 20px' }}>My Certificates</h2>

                    {certificates.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '40px', color: '#9CA3AF' }}>
                            <p style={{ fontSize: '40px', margin: '0 0 12px' }}>📄</p>
                            <p style={{ margin: 0 }}>No certificates yet. Complete a cleanup event to earn one!</p>
                        </div>
                    ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
                            {certificates.map(cert => (
                                <CertCard key={cert.id} cert={cert} />
                            ))}
                        </div>
                    )}
                </div>

                {/* ── Leaderboard ── */}
                <div style={{ background: '#fff', borderRadius: '12px', padding: '24px', boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
                    <h2 style={{ fontSize: '18px', fontWeight: '700', color: '#111827', margin: '0 0 20px' }}>🏆 Global Leaderboard</h2>
                    <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                        {leaderboard.slice(0, 20).map((entry, index) => (
                            <LeaderboardCard key={entry.volunteer_id} entry={entry} index={index + 1} />
                        ))}
                        {leaderboard.length === 0 && (
                            <p style={{ color: '#9CA3AF', textAlign: 'center', padding: '20px' }}>No leaderboard data yet.</p>
                        )}
                    </div>
                </div>

            </div>
        </div>
    );
}

// ── Certificate Card (inline, simple) ────────────────────────────────────────
function CertCard({ cert }) {
    const tier  = cert.badge_tier || 'Bronze';
    const emoji = BADGE_EMOJI[tier] || '🏅';
    const color = BADGE_COLOR[tier] || '#6B7280';

    const issueDate = cert.issue_date
        ? new Date(cert.issue_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
        : '—';

    return (
        <div style={{ border: `1px solid ${color}40`, borderRadius: '10px', padding: '20px', background: '#FAFAFA', position: 'relative' }}>
            {/* Badge Tag */}
            <div style={{ position: 'absolute', top: '16px', right: '16px', background: `${color}18`, color, padding: '4px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '700' }}>
                {emoji} {tier}
            </div>

            <p style={{ margin: '0 0 4px', fontSize: '13px', color: '#6B7280' }}>📅 {issueDate}</p>
            <p style={{ margin: '0 0 12px', fontWeight: '700', color: '#111827', fontSize: '15px' }}>
                {cert.event_title || cert.event_id || 'Beach Cleanup Event'}
            </p>

            <div style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
                <span style={{ fontSize: '13px', color: '#2563EB', fontWeight: '600' }}>
                    🕒 {Number(cert.total_hours || 0).toFixed(1)}h
                </span>
                <span style={{ fontSize: '13px', color: '#10B981', fontWeight: '600' }}>
                    ♻️ {Number(cert.total_waste_kg || 0).toFixed(1)} kg
                </span>
            </div>

            {cert.certificate_url ? (
                <a
                    href={cert.certificate_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    download
                    style={{
                        display: 'block',
                        textAlign: 'center',
                        background: '#2563EB',
                        color: 'white',
                        textDecoration: 'none',
                        padding: '10px 16px',
                        borderRadius: '8px',
                        fontSize: '14px',
                        fontWeight: '700',
                    }}
                >
                    ⬇ Download Certificate
                </a>
            ) : (
                <p style={{ textAlign: 'center', color: '#9CA3AF', fontSize: '13px', margin: 0 }}>Certificate pending...</p>
            )}
        </div>
    );
}
