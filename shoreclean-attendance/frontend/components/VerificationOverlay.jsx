import { useMemo, useState } from 'react';

export default function VerificationOverlay({ data, onApprove, onReject, onClose }) {
  const [approveLoading, setApproveLoading] = useState(false);
  const [rejectLoading, setRejectLoading] = useState(false);

  const initials = useMemo(() => {
    const name = String(data?.volunteer_name || '').trim();
    return name ? name.charAt(0).toUpperCase() : '?';
  }, [data?.volunteer_name]);

  const formattedRegDate = useMemo(() => {
    if (!data?.registered_at) return '—';
    const dt = new Date(data.registered_at);
    if (Number.isNaN(dt.getTime())) return '—';
    return dt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  }, [data?.registered_at]);

  const detailsRows = [
    { label: 'Email', value: data?.volunteer_email || '—' },
    { label: 'Phone', value: data?.volunteer_phone || '—' },
    { label: 'Event', value: data?.event_title || '—' },
    { label: 'Beach', value: data?.beach_name || '—' },
    { label: 'Reg. Date', value: formattedRegDate },
  ];

  const handleApprove = async () => {
    setApproveLoading(true);
    try {
      await onApprove?.();
    } finally {
      setApproveLoading(false);
    }
  };

  const handleReject = async () => {
    setRejectLoading(true);
    try {
      await onReject?.();
    } finally {
      setRejectLoading(false);
    }
  };

  const disabled = approveLoading || rejectLoading;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 600,
        background: 'var(--ocean-900)',
        display: 'flex',
        flexDirection: 'column',
        overflowY: 'auto',
        padding: 0,
      }}
    >
      {/* SECTION 1 - HEADER */}
      <div
        style={{
          background: 'var(--ocean-800)',
          height: 56,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 20px',
          flexShrink: 0,
        }}
      >
        <div
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 16,
            fontWeight: 700,
            color: 'white',
          }}
        >
          Identity Verification
        </div>
        <button
          type="button"
          className="btn btn-ghost btn-icon"
          onClick={onClose}
          aria-label="Close without action"
          title="Close without action"
          style={{ color: 'white' }}
        >
          ✕
        </button>
      </div>

      {/* SECTION 2 - PHOTO + NAME */}
      <div style={{ textAlign: 'center', padding: '32px 20px 20px', color: 'white' }}>
        {data?.photo_url ? (
          <img
            src={data.photo_url}
            alt="Volunteer"
            style={{
              width: 160,
              height: 160,
              borderRadius: '50%',
              border: '4px solid var(--ocean-400)',
              objectFit: 'cover',
              display: 'block',
              margin: '0 auto',
            }}
          />
        ) : (
          <div
            style={{
              width: 160,
              height: 160,
              borderRadius: '50%',
              border: '4px solid var(--ocean-400)',
              background: 'var(--ocean-700)',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 48,
              fontWeight: 700,
              margin: '0 auto',
              fontFamily: 'var(--font-display)',
            }}
          >
            {initials}
          </div>
        )}

        <div
          style={{
            marginTop: 16,
            fontFamily: 'var(--font-display)',
            fontSize: 24,
            fontWeight: 700,
            color: 'white',
            textAlign: 'center',
          }}
        >
          {data?.volunteer_name || 'Unknown Volunteer'}
        </div>

        <div style={{ marginTop: 8 }}>
          <span
            style={{
              display: 'inline-block',
              background: 'rgba(22,163,74,0.2)',
              color: '#86efac',
              border: '1px solid rgba(22,163,74,0.3)',
              borderRadius: 999,
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: '0.06em',
              padding: '4px 14px',
            }}
          >
            ✓ REGISTERED
          </span>
        </div>
      </div>

      {/* SECTION 3 - DETAILS CARD */}
      <div
        style={{
          margin: '0 16px',
          background: 'var(--ocean-800)',
          border: '1px solid rgba(255,255,255,0.08)',
          padding: 20,
          borderRadius: 16,
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.1em',
            color: 'var(--ocean-300)',
            textTransform: 'uppercase',
            marginBottom: 16,
          }}
        >
          Volunteer Details
        </div>

        {detailsRows.map((row, idx) => (
          <div
            key={row.label}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: 14,
              padding: '10px 0',
              borderBottom: idx === detailsRows.length - 1 ? 'none' : '1px solid rgba(255,255,255,0.06)',
            }}
          >
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>{row.label}</div>
            <div
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: 'white',
                textAlign: 'right',
                maxWidth: '60%',
                lineHeight: 1.45,
                wordBreak: 'break-word',
              }}
            >
              {row.value}
            </div>
          </div>
        ))}
      </div>

      {/* SECTION 4 - INSTRUCTION STRIP */}
      <div
        style={{
          margin: 16,
          padding: '14px 16px',
          background: 'rgba(196,145,63,0.12)',
          border: '1px solid rgba(196,145,63,0.3)',
          borderRadius: 12,
          fontSize: 13,
          color: 'var(--sand-300)',
          lineHeight: 1.5,
        }}
      >
        👁 Check the person in front of you matches the photo and details above before approving.
      </div>

      {/* SECTION 5 - ACTION BUTTONS */}
      <div style={{ padding: 16, marginTop: 'auto' }}>
        <div style={{ display: 'grid', gap: 12 }}>
          <button
            type="button"
            onClick={handleApprove}
            disabled={disabled}
            style={{
              height: 60,
              fontSize: 18,
              fontWeight: 700,
              background: 'var(--green-500)',
              color: 'white',
              border: 'none',
              borderRadius: 14,
              width: '100%',
              boxShadow: '0 4px 20px rgba(22,163,74,0.35)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              opacity: disabled ? 0.75 : 1,
              cursor: disabled ? 'not-allowed' : 'pointer',
            }}
          >
            {approveLoading ? (
              <>
                <span className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} />
                <span>Approving…</span>
              </>
            ) : (
              '✓  APPROVE ENTRY'
            )}
          </button>

          <button
            type="button"
            onClick={handleReject}
            disabled={disabled}
            style={{
              height: 56,
              fontSize: 16,
              fontWeight: 700,
              background: 'transparent',
              color: 'var(--coral-500)',
              border: '2px solid var(--coral-500)',
              borderRadius: 14,
              width: '100%',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              opacity: disabled ? 0.75 : 1,
              cursor: disabled ? 'not-allowed' : 'pointer',
            }}
          >
            {rejectLoading ? (
              <>
                <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
                <span>Rejecting…</span>
              </>
            ) : (
              '✕  REJECT'
            )}
          </button>
        </div>

        <div
          style={{
            fontSize: 11,
            color: 'rgba(255,255,255,0.35)',
            textAlign: 'center',
            marginTop: 8,
          }}
        >
          Approve only if the person matches the photo above
        </div>
      </div>
    </div>
  );
}
