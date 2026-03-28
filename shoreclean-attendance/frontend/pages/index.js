import Link from 'next/link';
import { useEffect, useRef } from 'react';

/* ─── Animated wave SVG component ─── */
function HeroWave() {
  return (
    <div className="hero-wave-wrap">
      <svg className="hero-wave-svg" viewBox="0 0 2400 120" preserveAspectRatio="none">
        <path
          className="wave-1"
          d="M0,60 C400,120 800,0 1200,60 C1600,120 2000,0 2400,60 L2400,120 L0,120Z"
          fill="var(--ocean-700)"
          fillOpacity="0.10"
        />
        <path
          className="wave-2"
          d="M0,80 C300,30 700,110 1200,80 C1700,50 2100,110 2400,80 L2400,120 L0,120Z"
          fill="var(--ocean-600)"
          fillOpacity="0.08"
        />
      </svg>
    </div>
  );
}

/* ─── Counter animation with IntersectionObserver ─── */
function useCounterAnimation() {
  const sectionRef = useRef(null);
  const hasAnimated = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const section = sectionRef.current;
    if (!section) return;

    const animateCounter = (el, target, duration, suffix, decimals) => {
      let startTime = null;
      const step = (timestamp) => {
        if (!startTime) startTime = timestamp;
        const progress = Math.min((timestamp - startTime) / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        const value = eased * target;
        if (decimals > 0) {
          el.textContent = value.toFixed(decimals) + suffix;
        } else {
          el.textContent = Math.floor(value).toLocaleString('en-IN') + suffix;
        }
        if (progress < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    };

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !hasAnimated.current) {
            hasAnimated.current = true;
            const counters = section.querySelectorAll('[data-counter]');
            counters.forEach((el) => {
              const target = parseFloat(el.dataset.counterTarget);
              const suffix = el.dataset.counterSuffix || '';
              const duration = parseInt(el.dataset.counterDuration) || 2000;
              const decimals = parseInt(el.dataset.counterDecimals) || 0;
              animateCounter(el, target, duration, suffix, decimals);
            });
          }
        });
      },
      { threshold: 0.3 }
    );
    observer.observe(section);
    return () => observer.disconnect();
  }, []);

  return sectionRef;
}

/* ─── QR Scanner mockup ─── */
function QRScannerMockup() {
  return (
    <div style={{ background: 'var(--ocean-900)', borderRadius: 'var(--r-lg)', padding: 'var(--sp-5)', color: 'white' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--sp-3)' }}>
        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 14 }}>🔍 QR Scanner</span>
        <span className="badge" style={{ background: 'white', color: 'var(--ocean-700)', fontWeight: 700 }}>Active</span>
      </div>
      <div style={{ height: 120, background: 'var(--ocean-800)', borderRadius: 'var(--r-md)', position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 60, height: 60, border: '2px solid var(--ocean-400)', borderRadius: 4, position: 'relative' }}>
          <div className="scan-laser" />
        </div>
      </div>
      <div style={{ marginTop: 'var(--sp-3)', background: 'var(--green-500)', borderRadius: 'var(--r-md)', padding: 'var(--sp-3)', textAlign: 'center', fontWeight: 700, fontSize: 14 }}>
        ✓ Checked In — Riya Sharma
      </div>
    </div>
  );
}

/* ─── Dashboard mockup ─── */
function DashboardMockup() {
  return (
    <div style={{ background: 'white', borderRadius: 'var(--r-lg)', padding: 'var(--sp-5)', border: '1px solid var(--color-border)' }}>
      <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 14, marginBottom: 'var(--sp-3)' }}>Live Impact Dashboard</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--sp-2)' }}>
        {[['42', 'Volunteers'], ['3.5 hrs', 'Avg Duration'], ['126 kg', 'Waste Removed']].map(([val, label]) => (
          <div key={label} style={{ background: 'var(--gray-100)', borderRadius: 'var(--r-md)', padding: 'var(--sp-2)', textAlign: 'center' }}>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 18, color: 'var(--ocean-600)' }}>{val}</div>
            <div style={{ fontSize: 10, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 'var(--sp-3)', height: 6, background: 'var(--gray-100)', borderRadius: 'var(--r-full)', overflow: 'hidden' }}>
        <div style={{ width: '72%', height: '100%', background: 'var(--ocean-500)', borderRadius: 'var(--r-full)' }} />
      </div>
      <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4 }}>72% capacity filled</div>
    </div>
  );
}

/* ─── Certificate mockup ─── */
function CertificateMockup() {
  return (
    <div style={{ background: 'white', borderRadius: 'var(--r-lg)', border: '2px solid var(--ocean-200)', padding: 'var(--sp-5)', textAlign: 'center' }}>
      <div style={{ fontSize: 28, marginBottom: 'var(--sp-2)' }}>🏅</div>
      <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16, color: 'var(--ocean-700)' }}>Certificate of Participation</div>
      <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 4 }}>Versova Beach Cleanup • Mar 2026</div>
      <div style={{ marginTop: 'var(--sp-3)', display: 'flex', gap: 'var(--sp-2)', justifyContent: 'center' }}>
        <span className="badge badge-green">Verified</span>
        <span className="badge badge-blue">4.5 hrs</span>
      </div>
    </div>
  );
}

export default function HomePage() {
  const counterRef = useCounterAnimation();

  return (
    <>
      {/* ═══ HERO ═══ */}
      <section style={{ minHeight: '100vh', background: 'var(--ocean-900)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', textAlign: 'center', padding: 'var(--sp-12) var(--sp-6)', position: 'relative', overflow: 'hidden' }}>
        <HeroWave />

        <div style={{ position: 'relative', zIndex: 2, maxWidth: 700 }}>
          {/* Pre-title pill */}
          <div className="hero-stagger-1" style={{ display: 'inline-flex', alignItems: 'center', background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 'var(--r-full)', padding: '6px 16px', fontSize: 12, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            🌊 COASTAL CONSERVATION PLATFORM
          </div>

          {/* H1 */}
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(36px, 5vw, 64px)', fontWeight: 700, lineHeight: 1.05, letterSpacing: '-0.03em', marginTop: 'var(--sp-6)' }}>
            <span className="hero-stagger-1" style={{ display: 'block' }}>Every Beach Cleaned</span>
            <span className="hero-stagger-2" style={{ display: 'block' }}>Is A Future Earned.</span>
          </h1>

          {/* Subtext */}
          <p className="hero-stagger-3" style={{ fontSize: 18, color: 'rgba(255,255,255,0.75)', maxWidth: 560, margin: 'var(--sp-6) auto 0', lineHeight: 1.7 }}>
            Connecting volunteers, NGOs, and data — so that every cleanup drive becomes measurable, fundable, unstoppable impact.
          </p>

          {/* CTA row */}
          <div className="hero-stagger-4" style={{ display: 'flex', gap: 'var(--sp-4)', justifyContent: 'center', flexWrap: 'wrap', marginTop: 'var(--sp-8)' }}>
            <Link href="/events" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'white', color: 'var(--ocean-800)', fontWeight: 700, fontSize: 16, borderRadius: 'var(--r-full)', padding: '16px 32px', textDecoration: 'none', transition: 'var(--t)', boxShadow: 'var(--shadow-md)' }}>
              Find a Cleanup →
            </Link>
            <Link href="/ngo/dashboard" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', color: 'white', fontWeight: 600, fontSize: 16, borderRadius: 'var(--r-full)', padding: '16px 32px', border: '1.5px solid rgba(255,255,255,0.5)', textDecoration: 'none', transition: 'var(--t)' }}>
              Create an Event
            </Link>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="scroll-chevron" style={{ position: 'absolute', bottom: 32, left: '50%', transform: 'translateX(-50%)', color: 'white', fontSize: 20, zIndex: 2 }}>
          ▽
        </div>
      </section>

      {/* ═══ IMPACT COUNTER STRIP ═══ */}
      <section className="counter-strip" ref={counterRef}>
        <div className="container">
          <div className="counter-grid">
            <div data-aos="zoom-in">
              <div className="counter-number" data-counter data-counter-target="280" data-counter-suffix="M+" data-counter-duration="2000">0</div>
              <div className="counter-label">Million kg plastic per year in India</div>
            </div>
            <div data-aos="zoom-in" data-aos-delay="100">
              <div className="counter-number" data-counter data-counter-target="11" data-counter-suffix="M" data-counter-duration="2000">0</div>
              <div className="counter-label">Million tonnes ocean waste globally</div>
            </div>
            <div data-aos="zoom-in" data-aos-delay="200">
              <div className="counter-number" data-counter data-counter-target="0.8" data-counter-suffix="%" data-counter-duration="2000" data-counter-decimals="1">&lt;1%</div>
              <div className="counter-label">Recovered by volunteer drives</div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ HOW IT WORKS ═══ */}
      <section className="hiw-section">
        <div className="container">
          <h2 data-aos="fade-up">From Sign-Up to Shoreline</h2>
          <p className="hiw-subtitle" data-aos="fade-up" data-aos-delay="100">Three steps. One QR code. Real impact.</p>

          <div className="hiw-timeline">
            {[
              { num: '1', icon: '🙋', title: 'Register', desc: 'Find a beach cleanup near you and sign up in seconds. No paperwork, no calls.' },
              { num: '2', icon: '📱', title: 'Get Your QR', desc: 'Receive a unique QR code — your digital ticket to the cleanup event.' },
              { num: '3', icon: '🏖️', title: 'Show Up & Clean', desc: 'Arrive at the beach, scan your QR to check in, and start making a difference.' },
              { num: '4', icon: '🏅', title: 'Get Certified', desc: 'After the cleanup, receive a verified certificate and see your impact stats.' },
            ].map((step, i) => (
              <div key={step.num} className="hiw-step" data-aos="fade-up" data-aos-delay={i * 150}>
                <span className="hiw-step-number">{step.num}</span>
                <div className="hiw-step-icon">{step.icon}</div>
                <div className="hiw-step-title">{step.title}</div>
                <div className="hiw-step-desc">{step.desc}</div>
                {i < 3 && <div className="hiw-connector" />}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ THE PROBLEM ═══ */}
      <section className="problem-section">
        <div className="container">
          <h2 data-aos="fade-up" style={{ textAlign: 'center', marginBottom: 'var(--sp-4)' }}>
            The wave doesn&apos;t stop. Neither do we.
          </h2>
          <p data-aos="fade-up" data-aos-delay="100" style={{ textAlign: 'center', maxWidth: 640, margin: '0 auto var(--sp-10)', fontSize: 17, lineHeight: 1.7, opacity: 0.8 }}>
            Every minute, the equivalent of a garbage truck of plastic enters our oceans. India alone contributes 280 million kg to its water bodies each year. Volunteer cleanups — the most accessible form of conservation — recover less than 1% because the infrastructure to coordinate them simply doesn&apos;t exist. Until now.
          </p>

          <div className="grid-3">
            {[
              { icon: '📋', title: 'Manual Coordination Chaos', desc: 'Organizers juggle 200+ volunteers over WhatsApp. No check-ins, no tracking, no accountability.' },
              { icon: '📉', title: 'No Data, No Funding', desc: 'NGOs can\'t prove impact to donors. Without numbers, funding walks away and drives die.' },
              { icon: '👻', title: 'Volunteer Dropout', desc: 'People show up once and never return — without recognition, there\'s no reason to come back.' },
            ].map((card, i) => (
              <div key={card.title} className="problem-card" data-aos="fade-up" data-aos-delay={i * 100}>
                <div className="problem-icon">{card.icon}</div>
                <h3>{card.title}</h3>
                <p>{card.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ FEATURE SHOWCASE ═══ */}
      <section className="feature-showcase">
        <div className="container">
          {/* Feature 1 */}
          <div className="feature-row">
            <div className="feature-text" data-aos="fade-right">
              <span className="badge badge-blue" style={{ marginBottom: 'var(--sp-3)' }}>CORE FEATURE</span>
              <h3>Smart QR Check-In</h3>
              <p>No paper sign-up sheets. No manual headcount. Volunteers scan their unique QR code at entry and exit — duration is auto-calculated, attendance is verified, and the data flows directly to your dashboard.</p>
            </div>
            <div data-aos="fade-left">
              <div className="feature-visual">
                <QRScannerMockup />
              </div>
            </div>
          </div>

          {/* Feature 2 */}
          <div className="feature-row reverse">
            <div className="feature-text" data-aos="fade-left">
              <span className="badge badge-green" style={{ marginBottom: 'var(--sp-3)' }}>FOR NGOS</span>
              <h3>Live Impact Dashboard</h3>
              <p>See real-time volunteer count, average participation duration, and estimated waste removed. Export donor-ready reports with one click. Finally, data that tells your story.</p>
            </div>
            <div data-aos="fade-right">
              <div className="feature-visual">
                <DashboardMockup />
              </div>
            </div>
          </div>

          {/* Feature 3 */}
          <div className="feature-row">
            <div className="feature-text" data-aos="fade-right">
              <span className="badge badge-sand" style={{ marginBottom: 'var(--sp-3)' }}>ENGAGEMENT</span>
              <h3>Gamified Participation</h3>
              <p>Volunteers earn verified participation certificates, climb community leaderboards, and build a track record of impact. Recognition turns one-time visitors into regulars.</p>
            </div>
            <div data-aos="fade-left">
              <div className="feature-visual">
                <CertificateMockup />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ TESTIMONIAL ═══ */}
      <section className="testimonial-section">
        <div className="container-sm" data-aos="fade-up">
          <div style={{ fontSize: 40, marginBottom: 'var(--sp-6)' }}>❝</div>
          <blockquote className="testimonial-quote">
            ShoreClean turned our Sunday chaos into Sunday coordination. For the first time, I could tell our donors exactly how many bags of waste we removed and how long our volunteers stayed.
          </blockquote>
          <div className="testimonial-author">— Anjali Sharma, CleanSeas Mumbai</div>
          <Link href="/register" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'white', color: 'var(--ocean-800)', fontWeight: 700, fontSize: 16, borderRadius: 'var(--r-full)', padding: '16px 32px', textDecoration: 'none', marginTop: 'var(--sp-8)', transition: 'var(--t)', boxShadow: 'var(--shadow-md)' }}>
            Join ShoreClean Today →
          </Link>
        </div>
      </section>

      {/* ═══ FOOTER ═══ */}
      <footer className="sc-footer">
        <div className="container">
          <div className="sc-footer-grid">
            <div>
              <div className="sc-footer-brand">🌊 ShoreClean</div>
              <p className="sc-footer-mission">Digitizing coastal conservation. Connecting every volunteer, every cleanup, every data point — to protect India&apos;s 7,500 km coastline.</p>
            </div>
            <div>
              <h4>Quick Links</h4>
              <Link href="/events">Browse Events</Link>
              <Link href="/dashboard">My Dashboard</Link>
              <Link href="/login">Log In</Link>
              <Link href="/register">Sign Up</Link>
            </div>
            <div>
              <h4>Legal</h4>
              <a href="#">Privacy Policy</a>
              <a href="#">Terms of Service</a>
              <a href="#">Contact Us</a>
            </div>
          </div>
          <div className="sc-footer-bar">
            <span>© {new Date().getFullYear()} ShoreClean. All rights reserved.</span>
            <span>Built for India&apos;s coasts 🌊</span>
          </div>
        </div>
      </footer>
    </>
  );
}
