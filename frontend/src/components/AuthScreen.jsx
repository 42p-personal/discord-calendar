import { useState } from 'react';
import { api } from '../api.js';

const INPUT = {
  width: '100%',
  background: '#0d0e14',
  border: '0.5px solid #363748',
  borderRadius: 8,
  color: '#e8e9f3',
  padding: '9px 12px',
  fontSize: 13,
  outline: 'none',
};

export default function AuthScreen({ onAuthenticated }) {
  const [mode,     setMode]    = useState('signin'); // signin | signup
  const [screen,   setScreen]  = useState('form');   // form | verify
  const [busy,     setBusy]    = useState(false);
  const [error,    setError]   = useState('');

  // Form fields
  const [name,     setName]     = useState('');
  const [username, setUsername] = useState('');
  const [email,    setEmail]    = useState('');
  const [code,     setCode]     = useState('');

  function switchMode(m) {
    setMode(m);
    setError('');
    setName(''); setUsername(''); setEmail(''); setCode('');
  }

  async function handleSubmit() {
    setError('');
    const trimEmail = email.trim().toLowerCase();

    if (!trimEmail.includes('@') || !trimEmail.includes('.')) {
      setError('Enter a valid email address.');
      return;
    }

    if (mode === 'signup') {
      if (!name.trim())     { setError('Enter your display name.'); return; }
      if (!username.trim()) { setError('Choose a username.'); return; }
      if (!/^[a-zA-Z0-9_]{3,20}$/.test(username.trim())) {
        setError('Username must be 3–20 characters: letters, numbers and _ only.');
        return;
      }
    }

    setBusy(true);
    try {
      await api.auth.requestCode({
        email:    trimEmail,
        name:     name.trim()     || undefined,
        username: username.trim() || undefined,
        isSignup: mode === 'signup',
      });
      setScreen('verify');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleVerify() {
    setError('');
    if (code.trim().length !== 6) { setError('Enter the 6-digit code from your email.'); return; }

    setBusy(true);
    try {
      const user = await api.auth.verify(email.trim().toLowerCase(), code.trim());
      onAuthenticated(user);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#111318', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem 1rem' }}>
      <div style={{ width: '100%', maxWidth: 420 }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 56, height: 56, borderRadius: 16, background: '#6366f1', marginBottom: 12, boxShadow: '0 8px 24px #6366f155' }}>
            <i className="ti ti-calendar-event" style={{ fontSize: 28, color: '#fff' }} aria-hidden="true" />
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#e8e9f3', margin: '0 0 5px', letterSpacing: '-0.02em' }}>
            Discord Calendar
          </h1>
          <p style={{ fontSize: 13, color: '#8b8ca8', margin: 0 }}>Plan events with your friends</p>
        </div>

        {/* Card */}
        <div style={{ background: '#1a1b22', border: '0.5px solid #2a2b36', borderRadius: 16, padding: '1.75rem', boxShadow: '0 20px 60px rgba(0,0,0,0.45)' }}>

          {/* ── Sign in / Sign up form ── */}
          {screen === 'form' && (
            <>
              {/* Tab switcher */}
              <div style={{ display: 'flex', gap: 6, marginBottom: 20, background: '#111318', borderRadius: 10, padding: 4 }}>
                {['signin', 'signup'].map((m) => (
                  <button
                    key={m}
                    onClick={() => switchMode(m)}
                    style={{
                      flex: 1, padding: '8px', borderRadius: 7, border: 'none',
                      fontSize: 13, fontWeight: mode === m ? 600 : 400,
                      background: mode === m ? '#6366f1' : 'transparent',
                      color:      mode === m ? '#fff'    : '#8b8ca8',
                      transition: 'all 0.15s',
                    }}
                  >
                    {m === 'signin' ? 'Sign in' : 'Create account'}
                  </button>
                ))}
              </div>

              {mode === 'signup' && (
                <>
                  <div style={{ marginBottom: 12 }}>
                    <label style={{ fontSize: 12, color: '#8b8ca8', display: 'block', marginBottom: 5 }}>Display name</label>
                    <input
                      value={name} onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Alex" style={INPUT}
                      onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                    />
                  </div>
                  <div style={{ marginBottom: 12 }}>
                    <label style={{ fontSize: 12, color: '#8b8ca8', display: 'block', marginBottom: 5 }}>Username</label>
                    <input
                      value={username} onChange={(e) => setUsername(e.target.value)}
                      placeholder="e.g. alex_g  (letters, numbers, _)"
                      style={INPUT}
                      onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                    />
                    <p style={{ fontSize: 11, color: '#52536a', marginTop: 4 }}>
                      3–20 characters — shown on events you propose.
                    </p>
                  </div>
                </>
              )}

              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 12, color: '#8b8ca8', display: 'block', marginBottom: 5 }}>Email address</label>
                <input
                  type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com" style={INPUT}
                  onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                />
              </div>

              {error && <p style={{ fontSize: 13, color: '#f87171', marginBottom: 12 }}>{error}</p>}

              <button
                onClick={handleSubmit} disabled={busy}
                style={{
                  width: '100%', padding: '10px', borderRadius: 10, border: 'none',
                  background: busy ? '#3730a3' : '#6366f1',
                  cursor: busy ? 'not-allowed' : 'pointer',
                  color: '#fff', fontSize: 14, fontWeight: 600,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  boxShadow: '0 4px 16px #6366f144', transition: 'background 0.2s',
                }}
              >
                <i className={`ti ti-${busy ? 'loader' : 'mail'}`} style={{ fontSize: 16 }} aria-hidden="true" />
                {busy ? 'Sending code…' : mode === 'signin' ? 'Send sign-in code' : 'Send verification code'}
              </button>
            </>
          )}

          {/* ── OTP verification ── */}
          {screen === 'verify' && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: '#6366f122', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <i className="ti ti-mail-check" style={{ fontSize: 18, color: '#a5b4fc' }} aria-hidden="true" />
                </div>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 600, color: '#e8e9f3' }}>Check your inbox</p>
                  <p style={{ fontSize: 12, color: '#8b8ca8' }}>A code was sent to {email}</p>
                </div>
              </div>

              <label style={{ fontSize: 12, color: '#8b8ca8', display: 'block', marginBottom: 6 }}>
                Enter your 6-digit code
              </label>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="123456"
                maxLength={6}
                style={{ ...INPUT, fontSize: 24, letterSpacing: '0.25em', textAlign: 'center', fontWeight: 700, marginBottom: 14 }}
                onKeyDown={(e) => e.key === 'Enter' && handleVerify()}
              />

              {error && <p style={{ fontSize: 13, color: '#f87171', marginBottom: 12 }}>{error}</p>}

              <button
                onClick={handleVerify} disabled={busy}
                style={{
                  width: '100%', padding: '10px', borderRadius: 10, border: 'none',
                  background: busy ? '#3730a3' : '#6366f1',
                  cursor: busy ? 'not-allowed' : 'pointer',
                  color: '#fff', fontSize: 14, fontWeight: 600,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  boxShadow: '0 4px 16px #6366f144', marginBottom: 8,
                }}
              >
                <i className="ti ti-check" style={{ fontSize: 16 }} aria-hidden="true" />
                {busy ? 'Verifying…' : 'Verify & continue'}
              </button>

              <button
                onClick={() => { setScreen('form'); setCode(''); setError(''); }}
                style={{ width: '100%', padding: '8px', borderRadius: 10, border: 'none', background: 'transparent', color: '#8b8ca8', fontSize: 13 }}
              >
                ← Back
              </button>
            </>
          )}

        </div>
      </div>
    </div>
  );
}
