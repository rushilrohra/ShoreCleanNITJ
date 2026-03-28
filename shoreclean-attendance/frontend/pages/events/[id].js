import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/router';
import { useEffect, useMemo, useState } from 'react';
import CameraCapture from '../../components/CameraCapture';
import { NavSpacer } from '../../components/Navbar';
import api, { eventsAPI, registrationsAPI } from '../../lib/api';

const DynamicEventLocationMap = dynamic(() => import('../../components/EventLocationMap'), {
  ssr: false,
});

const GRADIENTS = [
  'linear-gradient(160deg, #1a4f8a, #2e9fd6)',
  'linear-gradient(160deg, #c4913f, #e8c98a)',
  'linear-gradient(160deg, #0c2340, #2176ae)',
  'linear-gradient(160deg, #16a34a, #87d8f7)',
];

const formatEventDate = (d) =>
  (typeof d === 'string' && d.includes('T') ? new Date(d) : new Date(`${d}T00:00:00`)).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

const formatTime = (t) => {
  if (!t) return '';
  const [h, m] = t.split(':');
  const date = new Date(); date.setHours(+h, +m);
  return date.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true });
};

const isPast = (d) => {
  const dt = typeof d === 'string' && d.includes('T') ? new Date(d) : new Date(`${d}T00:00:00`);
  dt.setHours(0, 0, 0, 0);
  return dt < new Date(new Date().setHours(0, 0, 0, 0));
};

const FAKE_NAMES = ['R. Sharma', 'A. Kumar', 'P. Singh', 'M. Patel', 'S. Nair', 'V. Desai'];

const parseCoordinate = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

export default function EventDetailsPage() {
  const router = useRouter();
  const { id } = router.query;
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isRegistered, setIsRegistered] = useState(false);
  const [regLoading, setRegLoading] = useState(false);
  const [regSuccess, setRegSuccess] = useState(false);
  const [regError, setRegError] = useState(null);
  const [showCamera, setShowCamera] = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState(null); // File object
  const [user, setUser] = useState(null);
  const [viewerCount, setViewerCount] = useState(0);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const rawUser = localStorage.getItem('shoreclean_user');
    setUser(rawUser ? JSON.parse(rawUser) : null);
    setViewerCount(Math.floor(Math.random() * 8) + 3);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setViewerCount(Math.floor(Math.random() * 8) + 3);
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!id) return;
    let active = true;
    const fetchData = async () => {
      setLoading(true);
      try {
        const eventRes = await eventsAPI.getById(id);
        if (!active) return;
        setEvent(eventRes.data);
        if (typeof window !== 'undefined' && localStorage.getItem('shoreclean_token')) {
          try {
            const regRes = await registrationsAPI.getMy();
            if (!active) return;
            const myRegs = Array.isArray(regRes.data) ? regRes.data : Array.isArray(regRes.data?.registrations) ? regRes.data.registrations : [];
            setIsRegistered(myRegs.some((r) => String(r.event_id) === String(eventRes.data.id)));
          } catch { if (active) setIsRegistered(false); }
        }
      } catch { if (active) setEvent(null); }
      finally { if (active) setLoading(false); }
    };
    fetchData();
    return () => { active = false; };
  }, [id]);

  const registeredCount = Number(event?.registered_count || 0);
  const maxVolunteers = Number(event?.max_volunteers || 0);
  const past = useMemo(() => (event?.event_date ? isPast(event.event_date) : false), [event]);
  const full = useMemo(() => registeredCount >= maxVolunteers, [registeredCount, maxVolunteers]);
  const remaining = Math.max(maxVolunteers - registeredCount, 0);
  const pct = Math.min((registeredCount / (maxVolunteers || 1)) * 100, 100);
  const gradientBg = GRADIENTS[(Number(id) || 0) % GRADIENTS.length];
  const latitude = parseCoordinate(event?.latitude);
  const longitude = parseCoordinate(event?.longitude);

  const handleRegisterWithPhoto = async (photoFile) => {
    if (!event?.id) return;
    setRegLoading(true);
    setRegError(null);
    try {
      // Use FormData instead of JSON — backend now expects multipart
      const formData = new FormData();
      formData.append('event_id', event.id);
      formData.append('photo', photoFile);

      // Call API with FormData — axios handles Content-Type automatically
      await api.post('/api/registrations', formData);
      setRegSuccess(true);
      setIsRegistered(true);
      if (typeof window !== 'undefined' && typeof window.showToast === 'function') {
        window.showToast('Registered!', 'success');
      }
    } catch (err) {
      setRegError(err.response?.data?.error || 'Registration failed.');
    } finally {
      setRegLoading(false);
    }
  };

  const handlePhotoCapture = (file) => {
    setCapturedPhoto(file);
    setShowCamera(false);
    handleRegisterWithPhoto(file);
  };

  return (
    <>
      <NavSpacer />
      {showCamera && (
        <CameraCapture
          onCapture={handlePhotoCapture}
          onCancel={() => setShowCamera(false)}
        />
      )}
      {loading ? (
        <div className="text-center" style={{ padding: 'var(--sp-16) 0' }}><span className="spinner spinner-lg" /></div>
      ) : !event ? (
        <div className="container" style={{ padding: 'var(--sp-16) 0' }}>
          <div className="empty-state">
            <div className="empty-icon">🏖️</div>
            <h3>Event not found</h3>
            <p>It may have been removed or is not available right now.</p>
            <Link href="/events" className="btn btn-primary" style={{ marginTop: 'var(--sp-4)' }}>Back to Events</Link>
          </div>
        </div>
      ) : (
        <>
          {/* ═══ FULL-WIDTH HERO ═══ */}
          <section style={{ background: gradientBg, minHeight: 420, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', color: 'white', padding: 'var(--sp-12) var(--sp-6)', position: 'relative' }}>
            <div style={{ position: 'relative', zIndex: 2, maxWidth: 700 }}>
              <span className="badge" style={{ background: 'rgba(255,255,255,0.2)', color: 'white', marginBottom: 'var(--sp-3)', fontWeight: 600 }} data-aos="fade-up">
                {event.organizer_name || 'ShoreClean NGO'}
              </span>
              <h1 data-aos="fade-up" data-aos-delay="100" style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(28px, 4vw, 52px)', fontWeight: 700, lineHeight: 1.1, letterSpacing: '-0.02em', margin: 'var(--sp-3) 0 var(--sp-5)' }}>
                {event.title}
              </h1>
              <div data-aos="fade-up" data-aos-delay="200" style={{ display: 'flex', gap: 'var(--sp-3)', justifyContent: 'center', flexWrap: 'wrap' }}>
                {[
                  `📍 ${event.location}`,
                  `📅 ${formatEventDate(event.event_date)}`,
                  `🕘 ${formatTime(event.start_time)} – ${formatTime(event.end_time)}`,
                ].map((pill) => (
                  <span key={pill} style={{ background: 'rgba(255,255,255,0.15)', borderRadius: 'var(--r-full)', padding: '8px 16px', fontSize: 14, fontWeight: 500 }}>{pill}</span>
                ))}
              </div>
            </div>
          </section>

          {/* ═══ TWO-COLUMN LAYOUT ═══ */}
          <div className="container" style={{ padding: 'var(--sp-10) var(--sp-6)' }}>
            <div className="event-detail-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 'var(--sp-8)' }}>
              {/* LEFT COLUMN */}
              <div>
                {event.description && (
                  <div className="card" data-aos="fade-up">
                    <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, marginBottom: 'var(--sp-3)' }}>About this cleanup</h2>
                    <p style={{ lineHeight: 1.7, color: 'var(--color-text-muted)' }}>{event.description}</p>
                  </div>
                )}

                <div className="card" style={{ marginTop: 'var(--sp-4)' }} data-aos="fade-up" data-aos-delay="100">
                  <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, marginBottom: 'var(--sp-3)' }}>What to bring</h2>
                  {['🧤 Gloves (provided)', '👟 Closed-toe shoes', '💧 Water bottle', '☀️ Sunscreen', '🎒 Small backpack'].map((item) => (
                    <div key={item} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: '1px solid var(--color-border)', fontSize: 15 }}>{item}</div>
                  ))}
                </div>

                <div className="card" style={{ marginTop: 'var(--sp-4)' }} data-aos="fade-up" data-aos-delay="200">
                  <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, marginBottom: 'var(--sp-3)' }}>Location</h2>
                  {latitude !== null && longitude !== null ? (
                    <>
                      <DynamicEventLocationMap latitude={latitude} longitude={longitude} height={280} />
                      <div style={{ marginTop: 'var(--sp-3)', display: 'flex', justifyContent: 'space-between', gap: 'var(--sp-3)', flexWrap: 'wrap' }}>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 16 }}>{event.location}</div>
                          <p className="text-sm text-muted" style={{ marginTop: 2 }}>
                            Coordinates: {latitude}, {longitude}
                          </p>
                        </div>
                        <a
                          href={`https://maps.google.com/?q=${latitude},${longitude}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn btn-secondary btn-sm"
                        >
                          Open in Maps →
                        </a>
                      </div>
                    </>
                  ) : (
                    <div style={{ background: 'var(--ocean-100)', borderRadius: 'var(--r-md)', padding: 'var(--sp-6)', textAlign: 'center' }}>
                      <div style={{ fontSize: 32, marginBottom: 'var(--sp-2)' }}>📍</div>
                      <div style={{ fontWeight: 600, fontSize: 16 }}>{event.location}</div>
                      <a href={`https://maps.google.com?q=${encodeURIComponent(event.location)}`} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm" style={{ marginTop: 'var(--sp-3)' }}>
                        Open in Maps →
                      </a>
                    </div>
                  )}
                </div>

                <div className="card" style={{ marginTop: 'var(--sp-4)' }} data-aos="fade-up" data-aos-delay="300">
                  <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, marginBottom: 'var(--sp-3)' }}>Recent activity</h2>
                  {FAKE_NAMES.slice(0, 3).map((name, i) => (
                    <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: '1px solid var(--color-border)', fontSize: 14 }}>
                      <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--ocean-100)', color: 'var(--ocean-700)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 11, flex: '0 0 28px' }}>
                        {name.charAt(0)}
                      </div>
                      <span>{name} just registered</span>
                      <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--color-text-muted)' }}>{i === 0 ? 'Just now' : `${(i + 1) * 5}m ago`}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* RIGHT COLUMN (sticky) */}
              <div>
                <div style={{ position: 'sticky', top: 80 }}>
                  <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                    {/* Gradient top border */}
                    <div style={{ height: 4, background: 'linear-gradient(90deg, var(--ocean-500), var(--ocean-300))' }} />
                    <div style={{ padding: 'var(--sp-6)' }}>
                      {/* Live viewer count */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 'var(--sp-4)' }}>
                        <span className="live-dot" />
                        {viewerCount} people are viewing this event
                      </div>

                      {/* Capacity */}
                      <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, marginBottom: 'var(--sp-2)' }}>
                        {registeredCount} of {maxVolunteers} spots filled
                      </div>
                      <div className="progress-bar" style={{ height: 8, marginBottom: 'var(--sp-4)' }}>
                        <div className={`progress-fill ${pct < 50 ? 'low' : pct < 80 ? 'medium' : 'high'}`} style={{ width: `${pct}%` }} />
                      </div>

                      {/* Registration states */}
                      {!user ? (
                        <>
                          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, marginBottom: 'var(--sp-3)' }}>Register for this event</h2>
                          <p className="text-sm text-muted" style={{ marginBottom: 'var(--sp-4)' }}>Sign in to register and get your QR check-in code.</p>
                          <Link href="/login" className="btn btn-primary btn-full btn-lg">Log In to Register</Link>
                          <p style={{ textAlign: 'center', marginTop: 'var(--sp-3)', fontSize: 14 }}>
                            <Link href="/register" style={{ color: 'var(--ocean-600)' }}>New here? Create an account</Link>
                          </p>
                        </>
                      ) : regSuccess || isRegistered ? (
                        <div style={{ textAlign: 'center', padding: 'var(--sp-2) 0' }}>
                          <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--green-500)', color: 'white', fontSize: 28, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✓</div>
                          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, color: 'var(--green-500)', marginTop: 'var(--sp-3)' }}>You&apos;re registered!</h2>
                          <p className="text-muted">Your QR code is ready.</p>
                          {capturedPhoto && <p className="text-sm text-muted">Photo captured and verified.</p>}
                          <Link href="/dashboard" className="btn btn-primary btn-full" style={{ marginTop: 'var(--sp-4)' }}>Go to My Dashboard →</Link>
                        </div>
                      ) : full ? (
                        <>
                          <button className="btn btn-full btn-lg" type="button" disabled style={{ background: 'var(--gray-100)', color: 'var(--color-text-muted)' }}>Event is Full</button>
                          <p style={{ textAlign: 'center', marginTop: 'var(--sp-3)', fontSize: 14 }}><Link href="/events" style={{ color: 'var(--ocean-600)' }}>Browse other events →</Link></p>
                        </>
                      ) : event.status === 'cancelled' || past ? (
                        <div style={{ color: 'var(--color-text-muted)' }}>
                          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20, marginBottom: 'var(--sp-3)' }}>Registration unavailable</h2>
                          <p className="text-sm">{event.status === 'cancelled' ? 'This event has been cancelled.' : 'This event has been completed.'}</p>
                        </div>
                      ) : (
                        <>
                          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, marginBottom: 'var(--sp-3)' }}>Register for this event</h2>
                          <div style={{ marginBottom: 'var(--sp-4)' }}>
                            {['QR code for easy check-in', 'Verified participation certificate', 'Points on the leaderboard'].map((perk) => (
                              <div key={perk} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, marginBottom: 8 }}>
                                <span style={{ width: 20, height: 20, borderRadius: '50%', background: 'var(--green-100)', color: 'var(--green-500)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, flex: '0 0 20px', fontSize: 12 }}>✓</span>
                                <span>{perk}</span>
                              </div>
                            ))}
                          </div>
                          <button className="btn btn-primary btn-full btn-lg" type="button" onClick={() => setShowCamera(true)} disabled={regLoading}>
                            {regLoading ? (<><span className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} /> Registering…</>) : '📷 Register & Take Photo →'}
                          </button>
                          <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 8, textAlign: 'center' }}>
                            A photo is required to prevent fake attendance
                          </p>
                          {regError && <div className="alert alert-error" style={{ marginTop: 'var(--sp-3)' }}>{regError}</div>}
                        </>
                      )}

                      {/* Trust badges */}
                      <div style={{ display: 'flex', justifyContent: 'center', gap: 'var(--sp-4)', marginTop: 'var(--sp-5)', paddingTop: 'var(--sp-4)', borderTop: '1px solid var(--color-border)' }}>
                        {['🔒 Secure', '📜 Certified', '✅ Verified NGO'].map((badge) => (
                          <span key={badge} style={{ fontSize: 12, color: 'var(--color-text-muted)', fontWeight: 500 }}>{badge}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      <style jsx>{`
        @media (max-width: 900px) {
          .event-detail-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </>
  );
}
