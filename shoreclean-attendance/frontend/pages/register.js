import Link from 'next/link';
import { useRouter } from 'next/router';
import { useState } from 'react';
import { authAPI } from '../lib/api';

const AVATAR_COLORS = ['var(--ocean-500)', 'var(--ocean-600)', 'var(--ocean-700)', 'var(--sand-500)', 'var(--ocean-400)', 'var(--sand-700)', 'var(--ocean-800)', 'var(--green-500)', 'var(--ocean-300)', 'var(--sand-900)', 'var(--coral-500)', 'var(--ocean-900)'];
const AVATAR_INITIALS = ['RS', 'AM', 'PK', 'SJ', 'NK', 'VD', 'AP', 'MK', 'TS', 'RK', 'JM', 'NR'];
const AVATAR_POSITIONS = [
  { top: '8%', left: '15%' }, { top: '12%', left: '55%' }, { top: '5%', left: '78%' },
  { top: '30%', left: '8%' }, { top: '28%', left: '42%' }, { top: '35%', left: '72%' },
  { top: '52%', left: '20%' }, { top: '50%', left: '60%' }, { top: '55%', left: '85%' },
  { top: '72%', left: '12%' }, { top: '70%', left: '48%' }, { top: '75%', left: '76%' },
];

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState('volunteer');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState('');
  const [errors, setErrors] = useState({});

  const validate = () => {
    const e = {};
    if (!name.trim()) e.name = 'Full name is required.';
    if (!emailRegex.test(email)) e.email = 'Enter a valid email address.';
    if (password.length < 8) e.password = 'Password must be at least 8 characters.';
    if (confirmPassword !== password) e.confirmPassword = 'Passwords do not match.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleRegister = async () => {
    setApiError('');
    if (!validate()) return;
    setLoading(true);
    try {
      const res = await authAPI.register({ name, email, phone, password, role });
      localStorage.setItem('shoreclean_token', res.data.token);
      localStorage.setItem('shoreclean_user', JSON.stringify(res.data.user));
      window.dispatchEvent(new Event('auth-change'));
      router.push(res.data.user.role === 'volunteer' ? '/dashboard' : '/ngo/dashboard');
    } catch (err) { setApiError(err.response?.data?.error || 'Registration failed.'); }
    finally { setLoading(false); }
  };

  return (
    <>
      <div className="auth-layout" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', minHeight: '100vh' }}>
        {/* Left column — community avatars */}
        <div className="auth-left" style={{ background: 'linear-gradient(160deg, var(--ocean-900), var(--ocean-600))', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--sp-12)', color: 'white', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
          {/* Pulsing avatar cluster */}
          <div style={{ position: 'absolute', inset: 0 }}>
            {AVATAR_INITIALS.map((init, i) => (
              <div key={init} className="auth-avatar" style={{ background: AVATAR_COLORS[i], top: AVATAR_POSITIONS[i].top, left: AVATAR_POSITIONS[i].left, animationDelay: `${i * 0.3}s` }}>
                {init}
              </div>
            ))}
          </div>
          <div style={{ position: 'relative', zIndex: 2 }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 32, fontWeight: 700, marginBottom: 'var(--sp-2)' }}>
              Join 2,400+ volunteers
            </h2>
            <p style={{ fontSize: 17, opacity: 0.85, maxWidth: 300, margin: '0 auto' }}>
              already making a difference on India&apos;s coastline.
            </p>
          </div>
        </div>

        {/* Right column — form */}
        <div className="auth-right" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'white', padding: 'var(--sp-8)', overflowY: 'auto' }}>
          <div style={{ maxWidth: 480, width: '100%' }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 30, fontWeight: 700, marginBottom: 'var(--sp-6)' }}>Create your account</h2>

            <div className="form-group">
              <label className="form-label">Full Name*</label>
              <input type="text" className="form-input" value={name} onChange={(e) => setName(e.target.value)} />
              {errors.name && <div className="form-error">{errors.name}</div>}
            </div>
            <div className="form-group">
              <label className="form-label">Email*</label>
              <input type="email" className="form-input" value={email} onChange={(e) => setEmail(e.target.value)} />
              {errors.email && <div className="form-error">{errors.email}</div>}
            </div>
            <div className="form-group">
              <label className="form-label">Phone</label>
              <input type="tel" className="form-input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Optional — for event reminders" />
            </div>
            <div className="form-group">
              <label className="form-label">I am a…</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-3)' }}>
                {[['volunteer', '🙋', 'Volunteer', 'Join cleanups'], ['ngo', '🏢', 'NGO / Organizer', 'Create events']].map(([val, icon, title, sub]) => (
                  <button key={val} type="button" onClick={() => setRole(val)}
                    style={{ border: role === val ? '2px solid var(--ocean-600)' : '1.5px solid var(--color-border)', background: role === val ? 'var(--ocean-100)' : 'var(--white)', borderRadius: 'var(--r-md)', padding: 'var(--sp-4)', cursor: 'pointer', transition: 'var(--t)', textAlign: 'center' }}>
                    <div style={{ fontSize: 28 }}>{icon}</div>
                    <div style={{ fontWeight: 700, fontSize: 15, marginTop: 8 }}>{title}</div>
                    <div className="text-muted text-xs">{sub}</div>
                  </button>
                ))}
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Password*</label>
              <div style={{ position: 'relative' }}>
                <input type={showPassword ? 'text' : 'password'} className="form-input" value={password} onChange={(e) => setPassword(e.target.value)} />
                <button type="button" onClick={() => setShowPassword((p) => !p)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: 'var(--color-text-muted)' }}>{showPassword ? 'Hide' : 'Show'}</button>
              </div>
              {errors.password && <div className="form-error">{errors.password}</div>}
            </div>
            <div className="form-group">
              <label className="form-label">Confirm Password*</label>
              <div style={{ position: 'relative' }}>
                <input type={showConfirmPassword ? 'text' : 'password'} className="form-input" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
                <button type="button" onClick={() => setShowConfirmPassword((p) => !p)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: 'var(--color-text-muted)' }}>{showConfirmPassword ? 'Hide' : 'Show'}</button>
              </div>
              {errors.confirmPassword && <div className="form-error">{errors.confirmPassword}</div>}
            </div>

            {apiError && <div className="alert alert-error" style={{ marginBottom: 'var(--sp-4)' }}>{apiError}</div>}

            <button type="button" className="btn btn-primary btn-full btn-lg" onClick={handleRegister} disabled={loading}>
              {loading ? (<><span className="spinner" /> Creating account…</>) : 'Create Account'}
            </button>

            <p style={{ textAlign: 'center', marginTop: 'var(--sp-6)', fontSize: 14 }}>
              <Link href="/login" style={{ color: 'var(--ocean-600)', fontWeight: 600 }}>Already have an account? Log in →</Link>
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
