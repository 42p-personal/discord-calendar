import { useState, useEffect } from 'react';
import { api } from '../api.js';

function DiscordLogo({ size = 24 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="#fff" aria-hidden="true">
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/>
    </svg>
  );
}

/* Sleek slanted 42p logo */
function Logo42p({ size = 64 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"
      style={{ transform: 'rotate(-8deg)', filter: 'drop-shadow(0 4px 16px #7c3aed88)' }}>
      {/* Background pill */}
      <rect x="2" y="2" width="60" height="60" rx="18" fill="url(#g1)"/>
      {/* Subtle inner glow ring */}
      <rect x="2" y="2" width="60" height="60" rx="18" stroke="url(#g2)" strokeWidth="1.5" fill="none"/>
      {/* "4" */}
      <text x="4" y="44" fontFamily="'Arial Black', Arial, sans-serif" fontWeight="900"
        fontSize="34" fill="#ffffff" letterSpacing="-2">4</text>
      {/* "2" */}
      <text x="26" y="44" fontFamily="'Arial Black', Arial, sans-serif" fontWeight="900"
        fontSize="34" fill="url(#g3)" letterSpacing="-2">2</text>
      {/* "p" — smaller, bottom right, accent colour */}
      <text x="46" y="52" fontFamily="'Arial Black', Arial, sans-serif" fontWeight="900"
        fontSize="20" fill="#c4b5fd">p</text>
      <defs>
        <linearGradient id="g1" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#4c1d95"/>
          <stop offset="100%" stopColor="#7c3aed"/>
        </linearGradient>
        <linearGradient id="g2" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#a78bfa" stopOpacity="0.6"/>
          <stop offset="100%" stopColor="#7c3aed" stopOpacity="0"/>
        </linearGradient>
        <linearGradient id="g3" x1="26" y1="10" x2="44" y2="44" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#e9d5ff"/>
          <stop offset="100%" stopColor="#a78bfa"/>
        </linearGradient>
      </defs>
    </svg>
  );
}

export default function AuthScreen({ onAuthenticated, apiUrl }) {
  const [error, setError] = useState('');
  const [busy,  setBusy]  = useState(false);

  useEffect(() => {
    const params     = new URLSearchParams(window.location.search);
    const authResult = params.get('auth');
    const authError  = params.get('auth_error');

    if (authResult === 'success') {
      window.history.replaceState({}, '', window.location.pathname);
      setBusy(true);
      api.auth.me()
        .then(user => onAuthenticated(user))
        .catch(() => { setBusy(false); setError('Sign-in succeeded but session could not be loaded. Please try again.'); });
    }

    if (authError) {
      window.history.replaceState({}, '', window.location.pathname);
      const messages = {
        discord_denied: 'Discord authorisation was cancelled.',
        token_exchange: 'Failed to connect to Discord. Please try again.',
        profile_fetch:  'Could not retrieve your Discord profile. Please try again.',
        server_error:   'An unexpected error occurred. Please try again.',
      };
      setError(messages[authError] ?? 'Discord sign-in failed. Please try again.');
    }
  }, []);

  function handleDiscordLogin() {
    window.location.href = `${apiUrl}/auth/discord`;
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'radial-gradient(ellipse at 60% 20%, #2e1065 0%, #111318 60%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem 1rem',
    }}>
      <div style={{ width: '100%', maxWidth: 420 }}>

        {/* Logo + title */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ display: 'inline-block', marginBottom: 18 }}>
            <Logo42p size={72} />
          </div>

          <h1 style={{
            fontSize: 28,
            fontWeight: 900,
            color: '#f5f3ff',
            margin: '0 0 8px',
            letterSpacing: '-0.03em',
            lineHeight: 1.1,
          }}>
            42p Game Calendar
          </h1>

          <p style={{
            fontSize: 13,
            fontWeight: 700,
            color: '#a78bfa',
            margin: 0,
            textTransform: 'uppercase',
            letterSpacing: '0.12em',
          }}>
            The squad's gaming hub
          </p>
        </div>

        {/* Card */}
        <div style={{
          background: 'rgba(26, 27, 34, 0.85)',
          border: '0.5px solid #3b1f6e',
          borderRadius: 20,
          padding: '2rem',
          boxShadow: '0 24px 64px rgba(124,58,237,0.25), 0 4px 16px rgba(0,0,0,0.5)',
          backdropFilter: 'blur(12px)',
        }}>
          <p style={{ fontSize: 13, color: '#8b8ca8', textAlign: 'center', margin: '0 0 20px' }}>
            Sign in with your Discord account to continue
          </p>

          {/* Discord button */}
          <button
            onClick={handleDiscordLogin}
            disabled={busy}
            style={{
              width: '100%',
              padding: '13px',
              borderRadius: 12,
              border: 'none',
              background: busy
                ? '#3a3d8a'
                : 'linear-gradient(135deg, #5865f2 0%, #7c3aed 100%)',
              cursor: busy ? 'not-allowed' : 'pointer',
              color: '#fff',
              fontSize: 15,
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              boxShadow: busy ? 'none' : '0 4px 20px rgba(88,101,242,0.5)',
              transition: 'all 0.2s',
              transform: busy ? 'scale(0.98)' : 'scale(1)',
            }}
            onMouseEnter={e => { if (!busy) { e.currentTarget.style.background = 'linear-gradient(135deg, #4752c4 0%, #6d28d9 100%)'; e.currentTarget.style.boxShadow = '0 6px 24px rgba(88,101,242,0.65)'; }}}
            onMouseLeave={e => { if (!busy) { e.currentTarget.style.background = 'linear-gradient(135deg, #5865f2 0%, #7c3aed 100%)'; e.currentTarget.style.boxShadow = '0 4px 20px rgba(88,101,242,0.5)'; }}}
          >
            {busy ? (
              <>
                <i className="ti ti-loader" style={{ fontSize: 18, animation: 'spin 1s linear infinite' }} aria-hidden="true" />
                Signing in…
              </>
            ) : (
              <>
                <DiscordLogo size={20} />
                Continue with Discord
              </>
            )}
          </button>

          {/* Error */}
          {error && (
            <div style={{
              marginTop: 16,
              padding: '10px 14px',
              borderRadius: 9,
              background: '#ff000015',
              border: '0.5px solid #ff000044',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}>
              <i className="ti ti-alert-circle" style={{ fontSize: 15, color: '#f87171', flexShrink: 0 }} aria-hidden="true" />
              <p style={{ fontSize: 13, color: '#f87171', margin: 0 }}>{error}</p>
            </div>
          )}

          <p style={{ fontSize: 11, color: '#52536a', textAlign: 'center', margin: '20px 0 0', lineHeight: 1.5 }}>
            By continuing you agree to share your Discord username<br />and profile with Discord Games Calendar.
          </p>
        </div>
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
