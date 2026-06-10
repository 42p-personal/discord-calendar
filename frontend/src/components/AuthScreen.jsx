import { useState, useEffect } from 'react';
import { api } from '../api.js';

function DiscordLogo({ size = 24 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="#fff" aria-hidden="true">
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/>
    </svg>
  );
}

export default function AuthScreen({ onAuthenticated, apiUrl }) {
  const [error, setError] = useState('');
  const [busy,  setBusy]  = useState(false);

  // Handle Discord OAuth callback
  useEffect(() => {
    const params    = new URLSearchParams(window.location.search);
    const authResult = params.get('auth');
    const authError  = params.get('auth_error');

    if (authResult === 'success') {
      window.history.replaceState({}, '', window.location.pathname);
      setBusy(true);
      api.auth.me()
        .then(user => onAuthenticated(user))
        .catch(() => {
          setBusy(false);
          setError('Sign-in succeeded but session could not be loaded. Please try again.');
        });
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
      background: '#111318',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem 1rem',
    }}>
      <div style={{ width: '100%', maxWidth: 400 }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 64, height: 64, borderRadius: 18,
            background: '#6366f1', marginBottom: 16,
            boxShadow: '0 8px 32px #6366f166',
          }}>
            <i className="ti ti-calendar-event" style={{ fontSize: 32, color: '#fff' }} aria-hidden="true" />
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#e8e9f3', margin: '0 0 6px', letterSpacing: '-0.02em' }}>
            Discord Calendar
          </h1>
          <p style={{ fontSize: 14, color: '#8b8ca8', margin: 0 }}>
            Plan events with your friends
          </p>
        </div>

        {/* Card */}
        <div style={{
          background: '#1a1b22',
          border: '0.5px solid #2a2b36',
          borderRadius: 18,
          padding: '2rem',
          boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
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
              background: busy ? '#3a3d8a' : '#5865f2',
              cursor: busy ? 'not-allowed' : 'pointer',
              color: '#fff',
              fontSize: 15,
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              boxShadow: '0 4px 20px #5865f266',
              transition: 'background 0.2s, transform 0.1s',
              transform: busy ? 'scale(0.98)' : 'scale(1)',
            }}
            onMouseEnter={e => { if (!busy) e.currentTarget.style.background = '#4752c4'; }}
            onMouseLeave={e => { if (!busy) e.currentTarget.style.background = '#5865f2'; }}
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

          {/* Error message */}
          {error && (
            <div style={{
              marginTop: 16,
              padding: '10px 14px',
              borderRadius: 8,
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

          {/* Footer note */}
          <p style={{ fontSize: 11, color: '#52536a', textAlign: 'center', margin: '20px 0 0', lineHeight: 1.5 }}>
            By continuing you agree to share your Discord username<br />and profile with Discord Calendar.
          </p>
        </div>

        <style>{`
          @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        `}</style>
      </div>
    </div>
  );
}
