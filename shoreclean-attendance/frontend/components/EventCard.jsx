import { useRouter } from 'next/router';
import { useRef, useEffect } from 'react';
import { createPopper } from '@popperjs/core';

const GRADIENTS = ['ec-gradient-0', 'ec-gradient-1', 'ec-gradient-2', 'ec-gradient-3'];
const AVATAR_COLORS = ['var(--ocean-600)', 'var(--ocean-700)', 'var(--sand-700)', 'var(--ocean-500)'];
const AVATAR_INITIALS = ['RS', 'AM', 'PK', 'SJ', 'NK'];

const formatEventDate = (d) =>
  (typeof d === 'string' && d.includes('T') ? new Date(d) : new Date(`${d}T00:00:00`)).toLocaleDateString(
    'en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }
  );

const formatShortDate = (d) =>
  (typeof d === 'string' && d.includes('T') ? new Date(d) : new Date(`${d}T00:00:00`)).toLocaleDateString(
    'en-IN', { day: 'numeric', month: 'short' }
  );

const formatTime = (t) => {
  if (!t) return '';
  const [h, m] = t.split(':');
  const d = new Date();
  d.setHours(+h, +m);
  return d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true });
};

const getFillClass = (filled, total) => {
  const pct = filled / (total || 1);
  if (pct < 0.5) return { bar: 'low', bg: 'var(--ocean-500)' };
  if (pct < 0.8) return { bar: 'medium', bg: 'var(--sand-500)' };
  return { bar: 'high', bg: 'var(--coral-500)' };
};

const isPast = (d) => {
  const dt = typeof d === 'string' && d.includes('T') ? new Date(d) : new Date(`${d}T00:00:00`);
  dt.setHours(0, 0, 0, 0);
  return dt < new Date(new Date().setHours(0, 0, 0, 0));
};

export default function EventCard({ event, index = 0 }) {
  const router = useRouter();
  const triggerRef = useRef(null);
  const tooltipRef = useRef(null);
  const popperRef = useRef(null);

  const registeredCount = Number(event?.registered_count || 0);
  const maxVolunteers = Number(event?.max_volunteers || 0);
  const remaining = Math.max(maxVolunteers - registeredCount, 0);
  const past = isPast(event.event_date);
  const full = registeredCount >= maxVolunteers;
  const fill = getFillClass(registeredCount, maxVolunteers);
  const gradientClass = GRADIENTS[index % GRADIENTS.length];
  const pct = Math.min((registeredCount / (maxVolunteers || 1)) * 100, 100);

  const showPopper = () => {
    if (!tooltipRef.current) return;
    tooltipRef.current.style.display = 'block';
    popperRef.current = createPopper(triggerRef.current, tooltipRef.current, {
      placement: 'top',
      modifiers: [{ name: 'offset', options: { offset: [0, 8] } }],
    });
  };

  const hidePopper = () => {
    if (tooltipRef.current) tooltipRef.current.style.display = 'none';
    popperRef.current?.destroy();
  };

  useEffect(() => () => popperRef.current?.destroy(), []);

  const tooltipText = remaining < maxVolunteers * 0.2
    ? `Only ${remaining} spots left!`
    : `${remaining} spots available`;

  return (
    <div className="event-card-v2" onClick={() => router.push(`/events/${event.id}`)}>
      {/* Gradient hero area */}
      <div className={`ec-hero ${gradientClass}`}>
        <span className="ec-watermark">{event.beach_name}</span>
        <span className="ec-date-pill">{formatShortDate(event.event_date)}</span>
      </div>

      {/* Body */}
      <div className="ec-body">
        <span className="badge badge-blue" style={{ fontSize: 11, marginBottom: 'var(--sp-2)' }}>
          {event.organizer_name || 'ShoreClean NGO'}
        </span>

        <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, lineHeight: 1.35, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', margin: 'var(--sp-1) 0 var(--sp-2)' }}>
          {event.title}
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, color: 'var(--color-text-muted)' }}>📍 {event.location}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, color: 'var(--color-text-muted)' }}>🕘 {formatTime(event.start_time)} – {formatTime(event.end_time)}</div>
        </div>

        {/* Progress bar with Popper tooltip */}
        <div
          ref={triggerRef}
          onMouseEnter={showPopper}
          onMouseLeave={hidePopper}
          style={{ marginTop: 'var(--sp-3)', cursor: 'pointer' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 4 }}>
            <span>{registeredCount} / {maxVolunteers} volunteers</span>
          </div>
          <div className="progress-bar" style={{ height: 6 }}>
            <div className={`progress-fill ${fill.bar}`} style={{ width: `${pct}%` }} />
          </div>
        </div>

        {/* Popper tooltip */}
        <div ref={tooltipRef} className="sc-popper" style={{ display: 'none' }}>
          {tooltipText}
        </div>
      </div>

      {/* Footer */}
      <div className="ec-footer">
        <div className="ec-avatars">
          {AVATAR_INITIALS.slice(0, 3).map((init, i) => (
            <div key={init} className="ec-avatar" style={{ background: AVATAR_COLORS[i % AVATAR_COLORS.length] }}>
              {init}
            </div>
          ))}
        </div>
        {past || event.status === 'cancelled' ? (
          <span className="badge badge-gray">{event.status === 'cancelled' ? 'Cancelled' : 'Completed'}</span>
        ) : full ? (
          <span className="badge badge-red">Full</span>
        ) : (
          <button
            className="btn btn-primary btn-sm"
            type="button"
            onClick={(e) => { e.stopPropagation(); router.push(`/events/${event.id}`); }}
          >
            Register →
          </button>
        )}
      </div>
    </div>
  );
}
