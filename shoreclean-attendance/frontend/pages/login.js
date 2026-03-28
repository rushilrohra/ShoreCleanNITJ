import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useRef, useState } from 'react';
import { authAPI } from '../lib/api';

function WaveBackground() {
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
      <svg style={{ position: 'absolute', bottom: 0, left: 0, width: '200%', height: 140 }} viewBox="0 0 2400 140" preserveAspectRatio="none">
        <path className="wave-1" d="M0,70 C400,140 800,0 1200,70 C1600,140 2000,0 2400,70 L2400,140 L0,140Z" fill="rgba(255,255,255,0.06)" />
        <path className="wave-2" d="M0,90 C300,30 700,120 1200,90 C1700,60 2100,120 2400,90 L2400,140 L0,140Z" fill="rgba(255,255,255,0.04)" />
      </svg>
    </div>
  );
}

function AnimatedCounters() {
  const ref = useRef(null);
  const animated = useRef(false);

  useEffect(() => {
    if (!ref.current || animated.current) return;
    animated.current = true;
    const counters = ref.current.querySelectorAll('[data-counter]');
    counters.forEach((el, idx) => {
      const target = parseFloat(el.dataset.counterTarget);
      const suffix = el.dataset.counterSuffix || '';
      let st = null;
      let lastValue = -1;
      const duration = 1600;
      const delay = idx * 90;

      const step = (ts) => {
        if (!st) st = ts;
        const elapsed = ts - st;
        if (elapsed < delay) {
          requestAnimationFrame(step);
          return;
        }

        const p = Math.min((elapsed - delay) / duration, 1);
        const e = 1 - Math.pow(1 - p, 3);
        const nextValue = Math.round(e * target);
        if (nextValue !== lastValue || p === 1) {
          el.textContent = nextValue.toLocaleString('en-IN') + suffix;
          lastValue = nextValue;
        }
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  }, []);

  return (
    <div ref={ref} className="auth-stats-grid" style={{ display: 'flex', gap: 'var(--sp-4)', marginTop: 'var(--sp-10)' }}>
      {[['2400', '+', 'Registered Volunteers'], ['180', '+', 'Cleanup Drives'], ['34000', ' kg', 'Waste Removed']].map(([target, suffix, label]) => (
        <div key={label} className="auth-stat-card" style={{ background: 'rgba(255,255,255,0.12)', borderRadius: 'var(--r-md)', padding: 'var(--sp-3) var(--sp-4)', textAlign: 'center', flex: 1 }}>
          <div className="auth-stat-value" style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 20 }} data-counter data-counter-target={target} data-counter-suffix={suffix}>0</div>
          <div style={{ fontSize: 11, opacity: 0.8, marginTop: 2 }}>{label}</div>
        </div>
      ))}
    </div>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleLogin = async () => {
    setLoading(true); setError(null);
    try {
      const res = await authAPI.login({ email, password });
      localStorage.setItem('shoreclean_token', res.data.token);
      localStorage.setItem('shoreclean_user', JSON.stringify(res.data.user));
      window.dispatchEvent(new Event('auth-change'));
      router.push(res.data.user.role === 'volunteer' ? '/dashboard' : '/ngo/dashboard');
    } catch (err) { setError(err.response?.data?.error || 'Login failed.'); }
    finally { setLoading(false); }
  };

  return (
    <>
      <div className="auth-layout" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', minHeight: '100vh' }}>
        {/* Left column — animated */}
        <div className="auth-left" style={{ background: 'linear-gradient(160deg, var(--ocean-900), var(--ocean-600))', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--sp-12)', color: 'white', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
          <WaveBackground />
          <div style={{ position: 'relative', zIndex: 2 }}>
            <div style={{ fontSize: 64, marginBottom: 'var(--sp-4)' }}>🌊</div>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 36, fontWeight: 700 }}>ShoreClean</h1>
            <p style={{ fontSize: 17, opacity: 0.85, marginTop: 8, maxWidth: 340, margin: '8px auto 0' }}>
              Digitizing coastal conservation, one beach at a time.
            </p>
            <AnimatedCounters />
          </div>
        </div>

        {/* Right column — form */}
        <div className="auth-right" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'white', padding: 'var(--sp-8)' }}>
          <div style={{ maxWidth: 400, width: '100%' }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 30, fontWeight: 700, marginBottom: 4 }}>Welcome back</h2>
            <p className="text-muted" style={{ fontSize: 15, marginBottom: 'var(--sp-8)' }}>Log in to your ShoreClean account</p>

            <div className="form-group">
              <label className="form-label">Email</label>
              <input type="email" className="form-input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" />
            </div>

            <div className="form-group" style={{ position: 'relative' }}>
              <label className="form-label">Password</label>
              <div style={{ position: 'relative' }}>
                <input type={showPassword ? 'text' : 'password'} className="form-input" value={password} onChange={(e) => setPassword(e.target.value)} />
                <button type="button" onClick={() => setShowPassword((p) => !p)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: 'var(--color-text-muted)' }}>
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>

            {error && <div className="alert alert-error" style={{ marginBottom: 'var(--sp-4)' }}>{error}</div>}

            <button type="button" className="btn btn-primary btn-full btn-lg" onClick={handleLogin} disabled={loading}>
              {loading ? (<><span className="spinner" /> Logging in…</>) : 'Log In'}
            </button>

            <p style={{ textAlign: 'center', marginTop: 'var(--sp-6)', fontSize: 14 }}>
              Don&apos;t have an account?{' '}
              <Link href="/register" style={{ color: 'var(--ocean-600)', fontWeight: 600 }}>Sign up →</Link>
            </p>
          </div>
        </div>
      </div>

      <style jsx>{`
        @media (max-width: 768px) {
          .auth-layout { grid-template-columns: 1fr !important; }
          .auth-left { display: none !important; }
          .auth-right { padding: var(--sp-6) !important; }
        }
      `}</style>
    </>
  );
}
