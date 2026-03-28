import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as QRCode from 'qrcode';
import { QRCodeSVG } from 'qrcode.react';
import { NavSpacer } from '../../components/Navbar';
import { registrationsAPI } from '../../lib/api';

const formatDate = (d) =>
  (typeof d === 'string' && d.includes('T') ? new Date(d) : new Date(`${d}T00:00:00`)).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

const toDayStart = (value) => {
  const dt = typeof value === 'string' && value.includes('T') ? new Date(value) : new Date(`${value}T00:00:00`);
  dt.setHours(0, 0, 0, 0); return dt;
};

const formatTime = (t) => {
  if (!t) return '—';
  const [h = '0', m = '0'] = String(t).split(':');
  const date = new Date(); date.setHours(+h, +m);
  return date.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true });
};

const slugify = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48);

const STRIPE_COLORS = { PENDING: 'var(--ocean-500)', ACTIVE: 'var(--green-500)', DONE: 'var(--green-500)', ABSENT: 'var(--coral-500)' };

function useCounterAnimation(ref) {
  const hasAnimated = useRef(false);
  useEffect(() => {
    if (typeof window === 'undefined' || !ref.current) return;
    const section = ref.current;
    const animate = (el, target, dur, suffix) => {
      let st = null;
      const step = (ts) => { if (!st) st = ts; const p = Math.min((ts - st) / dur, 1); const e = 1 - Math.pow(1 - p, 3); el.textContent = Math.floor(e * target).toLocaleString('en-IN') + suffix; if (p < 1) requestAnimationFrame(step); };
      requestAnimationFrame(step);
    };
    const obs = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting && !hasAnimated.current) {
          hasAnimated.current = true;
          section.querySelectorAll('[data-counter]').forEach((el) => {
            animate(el, parseFloat(el.dataset.counterTarget), parseInt(el.dataset.counterDuration) || 1500, el.dataset.counterSuffix || '');
          });
        }
      });
    }, { threshold: 0.3 });
    obs.observe(section);
    return () => obs.disconnect();
  }, [ref]);
}

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [registrations, setRegistrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('upcoming');
  const statsRef = useRef(null);
  useCounterAnimation(statsRef);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const token = localStorage.getItem('shoreclean_token');
    const current = JSON.parse(localStorage.getItem('shoreclean_user') || 'null');
    if (!token) { router.push('/login'); return; }
    if (current?.role === 'ngo' || current?.role === 'admin') { router.push('/ngo/dashboard'); return; }
    setUser(current);
    (async () => {
      try {
        const res = await registrationsAPI.getMy();
        setRegistrations(Array.isArray(res.data) ? res.data : Array.isArray(res.data?.registrations) ? res.data.registrations : []);
      } catch { setRegistrations([]); }
      finally { setLoading(false); }
    })();
  }, [router]);

  const upcoming = useMemo(() => registrations.filter((r) => ['PENDING', 'ACTIVE'].includes(r.status) && toDayStart(r.event_date) >= new Date(new Date().setHours(0, 0, 0, 0))), [registrations]);
  const completed = useMemo(() => registrations.filter((r) => r.status === 'DONE'), [registrations]);
  const totalMins = useMemo(() => completed.reduce((s, r) => s + (r.duration_mins || 0), 0), [completed]);
  const totalHours = (totalMins / 60).toFixed(1);
  const kgEstimate = Math.round(totalMins * 0.5);
  const completionPct = registrations.length > 0 ? Math.round((completed.length / registrations.length) * 100) : 0;

  const tabData = activeTab === 'upcoming' ? upcoming : activeTab === 'completed' ? completed : registrations;

  const downloadQR = (token, reg) => {
    const canvas = document.createElement('canvas');
    QRCode.toCanvas(canvas, token, { width: 720, margin: 3, errorCorrectionLevel: 'L' }, (err) => {
      if (!err) {
        const a = document.createElement('a');
        a.href = canvas.toDataURL('image/png');
        a.download = `shoreclean-${slugify(reg?.title)}-${slugify(reg?.beach_name)}-${String(reg?.event_date || '').slice(0, 10)}.png`;
        a.click();
      }
    });
  };

  return (
    <>
      <NavSpacer />

      {/* ═══ HEADER ═══ */}
      <section style={{ background: 'var(--ocean-900)', color: 'white', padding: 'var(--sp-10) 0' }}>
        <div className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--sp-6)' }}>
          <div>
            <h1 data-aos="fade-up" style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 700 }}>
              Welcome back, {user?.name || 'Volunteer'} 👋
            </h1>
            <p data-aos="fade-up" data-aos-delay="100" style={{ fontSize: 17, color: 'var(--ocean-300)', marginTop: 'var(--sp-1)' }}>
              You&apos;ve contributed {totalHours} hours to cleaner coasts.
            </p>
          </div>
          <div className="progress-ring" style={{ '--pct': completionPct }} data-label={`${completionPct}%`} data-aos="zoom-in" />
        </div>
      </section>

      {/* ═══ IMPACT STATS STRIP ═══ */}
      <section style={{ background: 'var(--ocean-800)', padding: 'var(--sp-6) 0' }} ref={statsRef}>
        <div className="container">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--sp-4)', textAlign: 'center' }}>
            {[
              [registrations.length, 'Events Joined'],
              [totalHours, 'Hours Contributed'],
              [completed.length, 'Cleanups Done'],
              [`~${kgEstimate}`, 'Kg Removed'],
            ].map(([val, label], i) => (
              <div key={label} data-aos="zoom-in" data-aos-delay={i * 100}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 36, fontWeight: 700, color: 'white' }}
                  data-counter data-counter-target={typeof val === 'number' ? val : parseFloat(val) || 0} data-counter-suffix="" data-counter-duration="1500">
                  {val}
                </div>
                <div style={{ fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ocean-300)', marginTop: 4 }}>{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ REGISTRATIONS ═══ */}
      <div className="container page-section">
        {/* Tab bar pills */}
        <div style={{ display: 'flex', gap: 'var(--sp-2)', marginBottom: 'var(--sp-6)', flexWrap: 'wrap' }}>
          {[
            { key: 'upcoming', label: `Upcoming (${upcoming.length})`, activeColor: 'var(--ocean-600)' },
            { key: 'completed', label: `Completed (${completed.length})`, activeColor: 'var(--green-500)' },
            { key: 'all', label: `All (${registrations.length})`, activeColor: 'var(--gray-700)' },
          ].map((tab) => (
            <button key={tab.key} type="button" onClick={() => setActiveTab(tab.key)}
              style={{
                padding: '8px 20px', borderRadius: 'var(--r-full)', border: 'none', fontSize: 14, fontWeight: 600, cursor: 'pointer', transition: 'var(--t)',
                background: activeTab === tab.key ? tab.activeColor : 'var(--gray-100)',
                color: activeTab === tab.key ? 'white' : 'var(--color-text-muted)',
              }}>
              {tab.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-center" style={{ padding: 'var(--sp-16) 0' }}><span className="spinner spinner-lg" /></div>
        ) : tabData.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">{activeTab === 'completed' ? '🏅' : '🌊'}</div>
            <h3>{activeTab === 'upcoming' ? 'No upcoming events' : activeTab === 'completed' ? 'No completed events yet' : 'No registrations yet'}</h3>
            <p><Link href="/events" style={{ color: 'var(--ocean-600)' }}>Browse cleanups →</Link></p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 'var(--sp-5)' }}>
            {tabData.map((r, i) => (
              <div key={r.id} className="ticket-card" data-aos="fade-up" data-aos-delay={Math.min(i * 100, 300)} style={{ position: 'relative' }}>
                {/* Stripe */}
                <div className="ticket-stripe" style={{ background: STRIPE_COLORS[r.status] || 'var(--gray-300)' }} />

                {/* Dark section */}
                <div className="ticket-dark">
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, lineHeight: 1.35 }}>{r.title}</div>
                  <div style={{ fontSize: 13, opacity: 0.7, marginTop: 4 }}>🏖️ {r.beach_name} · 📅 {formatDate(r.event_date)}</div>
                </div>

                {/* Perforation */}
                <div className="ticket-perforation" />

                {/* Light section */}
                <div className="ticket-light">
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--sp-4)' }}>
                    {/* QR Code */}
                    {(r.status === 'PENDING' || r.status === 'ACTIVE') && r.qr_token ? (
                      <div style={{ flex: '0 0 100px' }}>
                        <QRCodeSVG value={r.qr_token} size={100} level="L" includeMargin marginSize={2} />
                      </div>
                    ) : null}

                    {/* Status info */}
                    <div style={{ flex: 1 }}>
                      <span className={`badge ${r.status === 'DONE' ? 'badge-green' : r.status === 'ABSENT' ? 'badge-red' : 'badge-blue'}`}>{r.status}</span>
                      {r.status === 'DONE' && (
                        <div style={{ marginTop: 'var(--sp-2)', fontSize: 14 }}>
                          <div>⏱ {r.duration_mins || 0} minutes</div>
                          <div style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>
                            {formatTime(r.start_time)} check-in
                          </div>
                        </div>
                      )}
                      {r.status === 'ABSENT' && (
                        <div style={{ marginTop: 'var(--sp-2)', fontSize: 13, color: 'var(--coral-500)' }}>Marked absent by organizer</div>
                      )}
                    </div>
                  </div>

                  {/* Download button */}
                  {(r.status === 'PENDING' || r.status === 'ACTIVE') && r.qr_token && (
                    <button type="button" className="btn btn-secondary btn-sm btn-full" style={{ marginTop: 'var(--sp-3)' }}
                      onClick={() => downloadQR(r.qr_token, r)}>
                      Download QR
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <style jsx>{`
        @media (max-width: 900px) {
          .progress-ring { display: none; }
        }
        @media (max-width: 768px) {
          section .container > div[style*="grid-template-columns: repeat(4"] {
            grid-template-columns: repeat(2, 1fr) !important;
          }
        }
      `}</style>
    </>
  );
}
