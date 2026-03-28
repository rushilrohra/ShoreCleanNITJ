import React from 'react';

const BADGE_EMOJI = { Bronze: '🥉', Silver: '🥈', Gold: '🥇' };
const BADGE_COLOR = { Bronze: '#CD7F32', Silver: '#9CA3AF', Gold: '#F59E0B' };

export default function CertificateCard({ certificate }) {
    const cert  = certificate || {};
    const tier  = cert.badge_tier || 'Bronze';
    const emoji = BADGE_EMOJI[tier] || '🏅';
    const color = BADGE_COLOR[tier] || '#6B7280';

    const issueDate = cert.issue_date
        ? new Date(cert.issue_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
        : '—';

    return (
        <div style={{
            border: `1px solid ${color}50`,
            borderRadius: '12px',
            padding: '20px',
            background: '#FAFAFA',
            position: 'relative',
            fontFamily: 'Arial, sans-serif',
        }}>
            {/* Badge Tag */}
            <div style={{
                position: 'absolute', top: '14px', right: '14px',
                background: `${color}20`, color, padding: '4px 10px',
                borderRadius: '20px', fontSize: '12px', fontWeight: '700',
            }}>
                {emoji} {tier}
            </div>

            <p style={{ margin: '0 0 4px', fontSize: '12px', color: '#9CA3AF' }}>📅 {issueDate}</p>
            <p style={{ margin: '0 0 14px', fontWeight: '700', color: '#111827', fontSize: '15px', paddingRight: '80px' }}>
                {cert.event_title || 'Beach Cleanup Event'}
            </p>

            {/* Stats */}
            <div style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
                <span style={{ fontSize: '13px', color: '#2563EB', fontWeight: '700' }}>
                    🕒 {Number(cert.total_hours || 0).toFixed(1)}h
                </span>
                <span style={{ fontSize: '13px', color: '#10B981', fontWeight: '700' }}>
                    ♻️ {Number(cert.total_waste_kg || 0).toFixed(1)} kg
                </span>
            </div>

            {/* Download Button */}
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
                        padding: '10px',
                        borderRadius: '8px',
                        fontSize: '14px',
                        fontWeight: '700',
                    }}
                >
                    ⬇ Download Certificate
                </a>
            ) : (
                <p style={{ textAlign: 'center', color: '#9CA3AF', fontSize: '13px', margin: 0 }}>
                    Certificate pending...
                </p>
            )}
        </div>
    );
}
