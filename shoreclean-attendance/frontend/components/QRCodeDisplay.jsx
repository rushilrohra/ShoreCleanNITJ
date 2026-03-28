import * as QRCodeLib from 'qrcode';
import { QRCodeSVG } from 'qrcode.react';

const STATUS_CLASS_MAP = {
  PENDING: 'status pending',
  ACTIVE: 'status active',
  DONE: 'status done',
  ABSENT: 'status absent',
};

function formatDate(dateInput) {
  if (!dateInput) {
    return 'N/A';
  }

  const date = new Date(dateInput);
  if (Number.isNaN(date.getTime())) {
    return 'N/A';
  }

  return date.toLocaleDateString();
}

function formatDateTime(dateInput) {
  if (!dateInput) {
    return null;
  }

  const date = new Date(dateInput);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toLocaleString();
}

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

export default function QRCodeDisplay({ registration }) {
  const qrValue = registration?.qr_token || '';
  const status = registration?.status || 'PENDING';
  const statusClass = STATUS_CLASS_MAP[status] || 'status pending';

  const entryTime = formatDateTime(registration?.entry_time);
  const exitTime = formatDateTime(registration?.exit_time);

  const handleDownload = async () => {
    if (typeof window === 'undefined' || !qrValue || !registration?.id) {
      return;
    }

    try {
      const canvas = document.createElement('canvas');
      await QRCodeLib.toCanvas(canvas, qrValue, {
        width: 720,
        margin: 3,
        errorCorrectionLevel: 'L',
      });

      const dataUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = dataUrl;
      const eventSlug = slugify(registration?.title) || 'event';
      const beachSlug = slugify(registration?.beach_name) || 'beach';
      const datePart = String(registration?.event_date || '').slice(0, 10) || 'date';
      link.download = `shoreclean-${eventSlug}-${beachSlug}-${datePart}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Failed to download QR code:', error);
    }
  };

  return (
    <section className="qr-card">
      <div className="qr-header-row">
        <h3 className="qr-title">Volunteer QR Pass</h3>
        <span className={statusClass}>{status}</span>
      </div>

      <div className="qr-wrapper">
        <QRCodeSVG value={qrValue || 'invalid-qr'} size={260} level="L" includeMargin marginSize={3} />
      </div>

      <div className="event-meta">
        <p className="event-name">{registration?.title || 'Unknown Event'}</p>
        <p className="event-subtext">
          {registration?.beach_name || 'Unknown Beach'} • {formatDate(registration?.event_date)}
        </p>
      </div>

      <div className="timing-grid">
        {entryTime && (
          <p>
            <strong>Entry:</strong> {entryTime}
          </p>
        )}
        {exitTime && (
          <p>
            <strong>Exit:</strong> {exitTime}
          </p>
        )}
        {status === 'DONE' && typeof registration?.duration_mins === 'number' && (
          <p>
            <strong>Duration:</strong> {registration.duration_mins} minutes
          </p>
        )}
      </div>

      <button type="button" className="download-btn" onClick={handleDownload}>
        Download QR
      </button>

      <style jsx>{`
        .qr-card {
          background: #ffffff;
          border: 1px solid #d6e3ef;
          border-radius: 14px;
          padding: 1rem;
          max-width: 360px;
          box-shadow: 0 8px 24px rgba(12, 40, 66, 0.08);
        }

        .qr-header-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.75rem;
          margin-bottom: 0.75rem;
        }

        .qr-title {
          margin: 0;
          font-size: 1.05rem;
          color: #14324a;
        }

        .status {
          padding: 0.25rem 0.6rem;
          border-radius: 999px;
          color: #ffffff;
          font-size: 0.75rem;
          font-weight: 700;
          letter-spacing: 0.03em;
        }

        .pending {
          background: #2563eb;
        }

        .active {
          background: #16a34a;
        }

        .done {
          background: #6b7280;
        }

        .absent {
          background: #dc2626;
        }

        .qr-wrapper {
          display: flex;
          align-items: center;
          justify-content: center;
          background: #f6fbff;
          border: 1px dashed #c6d9eb;
          border-radius: 12px;
          padding: 0.85rem;
        }

        .event-meta {
          margin-top: 0.85rem;
        }

        .event-name {
          margin: 0;
          font-weight: 700;
          color: #173d5a;
        }

        .event-subtext {
          margin: 0.35rem 0 0;
          color: #4a6277;
          font-size: 0.92rem;
        }

        .timing-grid {
          margin-top: 0.85rem;
          display: grid;
          gap: 0.35rem;
          color: #1f3b52;
          font-size: 0.9rem;
        }

        .timing-grid p {
          margin: 0;
        }

        .download-btn {
          margin-top: 1rem;
          width: 100%;
          background: #0f8b8d;
          color: #ffffff;
          border: none;
          border-radius: 10px;
          padding: 0.65rem 0.9rem;
          font-weight: 700;
          cursor: pointer;
          transition: transform 0.1s ease, opacity 0.2s ease;
        }

        .download-btn:hover {
          opacity: 0.92;
          transform: translateY(-1px);
        }

        .download-btn:active {
          transform: translateY(0);
        }
      `}</style>
    </section>
  );
}
