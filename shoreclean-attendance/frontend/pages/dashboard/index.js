import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { NavSpacer } from '../../components/Navbar';
import { generateVolunteerPass } from '../../lib/generatePass';
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

const STRIPE_COLORS = {
  PENDING: 'var(--ocean-500)',
  ACTIVE: 'var(--green-500)',
  DONE: 'var(--gray-300)',
  ABSENT: 'var(--coral-500)',
  REJECTED: 'var(--coral-500)',
  CANCELLED: 'var(--sand-500)',
};

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
  const [pdfLoading, setPdfLoading] = useState({});
  const [cancelModal, setCancelModal] = useState(null);
  const [cancelLoading, setCancelLoading] = useState(false);
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

  const handleDownloadPdf = async (registration) => {
    setPdfLoading((prev) => ({ ...prev, [registration.id]: true }));
    try {
      // Fetch pass payload from DB-backed endpoint for authoritative values
      const passRes = await registrationsAPI.getPassData(registration.id);
      const passRegistration = passRes.data?.registration || registration;
      const passUser = passRes.data?.user || JSON.parse(localStorage.getItem('shoreclean_user') || '{}');
      await generateVolunteerPass(passRegistration, passUser);
    } catch (err) {
      console.error('PDF generation failed:', err);
      window.showToast?.('PDF generation failed. Try again.', 'error');
    } finally {
      setPdfLoading((prev) => ({ ...prev, [registration.id]: false }));
    }
  };

  const handleCancel = async () => {
    if (!cancelModal?.id) return;
    setCancelLoading(true);
    try {
      await registrationsAPI.cancel(cancelModal.id);
      // Update local state — change status to CANCELLED without refetch
      setRegistrations((prev) =>
        prev.map((r) => (r.id === cancelModal.id ? { ...r, status: 'CANCELLED' } : r))
      );
      setCancelModal(null);
      window.showToast?.('Registration cancelled successfully', 'success');
    } catch (err) {
      window.showToast?.(err.response?.data?.error || 'Cancellation failed', 'error');
    } finally {
      setCancelLoading(false);
    }
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
                      {r.status === 'CANCELLED' ? (
                        <span className="badge badge-sand">Cancelled by you</span>
                      ) : r.status === 'REJECTED' ? (
                        <span className="badge badge-red">Entry Rejected</span>
                      ) : (
                        <span className={`badge ${r.status === 'DONE' ? 'badge-green' : r.status === 'ABSENT' ? 'badge-red' : 'badge-blue'}`}>{r.status}</span>
                      )}
                      
                      {r.status === 'DONE' && (
                        <div style={{ marginTop: 'var(--sp-2)', fontSize: 13, color: 'var(--color-text-muted)' }}>
                          <div>⏱ {r.duration_mins || 0} minutes of impact</div>
                          <div style={{ marginTop: 2 }}>
                            Verified: {formatTime(r.start_time)} – {formatTime(r.exit_time || r.end_time)}
                          </div>
                        </div>
                      )}
                      {r.status === 'ABSENT' && (
                        <div style={{ marginTop: 'var(--sp-2)', fontSize: 13, color: 'var(--coral-500)' }}>Marked absent by organizer</div>
                      )}

                      {r.photo_url && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 'var(--sp-3)', padding: 'var(--sp-3)', background: 'var(--ocean-100)', borderRadius: 'var(--r-md)' }}>
                          <img
                            src={r.photo_url}
                            alt="Your registration photo"
                            style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--ocean-300)' }}
                          />
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ocean-700)' }}>Photo verified ✓</div>
                            <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>Used for identity check at the event</div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Download pass button */}
                  {(r.status === 'PENDING' || r.status === 'ACTIVE') && r.qr_token && (
                    <>
                      <button
                        className="btn btn-primary btn-full btn-sm"
                        onClick={() => handleDownloadPdf(r)}
                        disabled={pdfLoading[r.id]}
                        style={{ marginTop: 'var(--sp-3)' }}
                      >
                        {pdfLoading[r.id]
                          ? <><span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> Generating…</>
                          : '📄 Download Volunteer Pass'}
                      </button>
                      <p style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 6, textAlign: 'center', lineHeight: 1.4 }}>
                        Show this PDF at the event entrance. The organizer will verify your identity.
                      </p>
                      {r.status === 'PENDING' && (
                        <button
                          className="btn btn-ghost btn-sm btn-full"
                          style={{ color: 'var(--coral-500)', marginTop: 'var(--sp-2)', fontSize: 13 }}
                          onClick={() => setCancelModal({ id: r.id, title: r.title })}
                        >
                          Cancel Registration
                        </button>
                      )}
                    </>
                  )}

                  {r.status === 'CANCELLED' && (
                    <div style={{ marginTop: 'var(--sp-4)', padding: 'var(--sp-3)', background: 'var(--sand-100)', borderRadius: 'var(--r-md)', fontSize: 13, color: 'var(--sand-700)', textAlign: 'center' }}>
                      You cancelled this registration
                    </div>
                  )}

                  {r.status === 'REJECTED' && (
                    <div style={{ marginTop: 'var(--sp-4)', padding: 'var(--sp-3)', background: 'var(--coral-100)', borderRadius: 'var(--r-md)', fontSize: 13, color: 'var(--coral-500)', textAlign: 'center' }}>
                      Entry was rejected by the organizer
                    </div>
                  )}

                  {r.status === 'DONE' && r.certificate_url && (
                    <a 
                      href={r.certificate_url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="btn btn-primary btn-sm btn-full" 
                      style={{ marginTop: 'var(--sp-3)', display: 'inline-flex', justifyContent: 'center', alignItems: 'center', textDecoration: 'none' }}
                    >
                      🏆 Download Certificate
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {cancelModal && (
        <div className="modal-overlay" onClick={() => setCancelModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <div className="modal-header">
              <h2 className="modal-title">Cancel Registration?</h2>
              <button className="modal-close" onClick={() => setCancelModal(null)}>✕</button>
            </div>

            <p style={{ fontSize: 15, color: 'var(--color-text-muted)', lineHeight: 1.6, marginBottom: 'var(--sp-4)' }}>
              Are you sure you want to cancel your registration for
              <strong style={{ color: 'var(--color-text)' }}> {cancelModal.title}</strong>?
              This cannot be undone.
            </p>

            <div style={{ background: 'var(--coral-100)', border: '1px solid #fca5a5', borderRadius: 'var(--r-md)', padding: 'var(--sp-3)', fontSize: 13, color: 'var(--coral-500)', marginBottom: 'var(--sp-5)' }}>
              Your spot will be released for another volunteer.
            </div>

            <div style={{ display: 'flex', gap: 'var(--sp-3)', justifyContent: 'flex-end' }}>
              <button
                className="btn btn-ghost"
                onClick={() => setCancelModal(null)}
                disabled={cancelLoading}
              >
                Keep Registration
              </button>
              <button
                className="btn btn-danger"
                onClick={handleCancel}
                disabled={cancelLoading}
              >
                {cancelLoading
                  ? <><span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> Cancelling…</>
                  : 'Yes, Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}

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
