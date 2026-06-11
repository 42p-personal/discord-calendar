import { useState, useEffect, useRef } from 'react';
import { api } from './api.js';

const API_URL = import.meta.env.VITE_API_URL ?? '';

// ─── 42p Logo ────────────────────────────────────────────────
function Logo42p({ size = 40 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none"
      style={{ transform: 'rotate(-8deg)', filter: 'drop-shadow(0 2px 8px #7c3aed66)' }}>
      <rect x="2" y="2" width="60" height="60" rx="18" fill="url(#lg1)"/>
      <rect x="2" y="2" width="60" height="60" rx="18" stroke="url(#lg2)" strokeWidth="1.5" fill="none"/>
      <text x="4" y="44" fontFamily="'Arial Black',Arial,sans-serif" fontWeight="900" fontSize="34" fill="#ffffff" letterSpacing="-2">4</text>
      <text x="26" y="44" fontFamily="'Arial Black',Arial,sans-serif" fontWeight="900" fontSize="34" fill="url(#lg3)" letterSpacing="-2">2</text>
      <text x="46" y="52" fontFamily="'Arial Black',Arial,sans-serif" fontWeight="900" fontSize="20" fill="#c4b5fd">p</text>
      <defs>
        <linearGradient id="lg1" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#4c1d95"/><stop offset="100%" stopColor="#7c3aed"/>
        </linearGradient>
        <linearGradient id="lg2" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#a78bfa" stopOpacity="0.6"/><stop offset="100%" stopColor="#7c3aed" stopOpacity="0"/>
        </linearGradient>
        <linearGradient id="lg3" x1="26" y1="10" x2="44" y2="44" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#e9d5ff"/><stop offset="100%" stopColor="#a78bfa"/>
        </linearGradient>
      </defs>
    </svg>
  );
}

// ─── Auth screen ──────────────────────────────────────────────
function AuthScreen() {
  const [error, setBusy_error] = useState('');
  const [busy,  setBusy]       = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('auth') === 'success') {
      window.history.replaceState({}, '', window.location.pathname);
    }
    if (params.get('auth_error')) {
      window.history.replaceState({}, '', window.location.pathname);
      setBusy_error('Discord sign-in failed. Please try again.');
    }
  }, []);

  return (
    <div style={{ minHeight: '100vh', background: 'radial-gradient(ellipse at 60% 20%, #2e1065 0%, #0f1015 60%)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem 1rem' }}>
      <div style={{ width: '100%', maxWidth: 400, textAlign: 'center' }}>
        <div style={{ display: 'inline-block', marginBottom: 20 }}>
          <Logo42p size={64} />
        </div>
        <h1 style={{ fontSize: 26, fontWeight: 900, color: '#f5f3ff', margin: '0 0 6px', letterSpacing: '-0.03em' }}>
          42p Games
        </h1>
        <p style={{ fontSize: 13, color: '#a78bfa', margin: '0 0 32px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          Upcoming Releases
        </p>

        <div style={{ background: 'rgba(26,27,34,0.85)', border: '0.5px solid #3b1f6e', borderRadius: 20, padding: '2rem', boxShadow: '0 24px 64px rgba(124,58,237,0.2)', backdropFilter: 'blur(12px)' }}>
          <p style={{ fontSize: 13, color: '#8b8ca8', margin: '0 0 20px' }}>
            Sign in with Discord to manage game releases and see what's coming up.
          </p>

          <button
            onClick={() => { setBusy(true); window.location.href = `${API_URL}/auth/discord`; }}
            disabled={busy}
            style={{ width: '100%', padding: '13px', borderRadius: 12, border: 'none', background: busy ? '#3a3d8a' : 'linear-gradient(135deg,#5865f2,#7c3aed)', color: '#fff', fontSize: 15, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, boxShadow: '0 4px 20px rgba(88,101,242,0.4)', transition: 'all 0.2s' }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="#fff"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/></svg>
            {busy ? 'Connecting…' : 'Continue with Discord'}
          </button>

          {error && <p style={{ fontSize: 13, color: '#f87171', marginTop: 14 }}>{error}</p>}
        </div>

        <a href="https://calendar.42p.uk" style={{ display: 'inline-block', marginTop: 20, fontSize: 12, color: '#6b6b7a', textDecoration: 'none' }}>
          ← Back to Discord Calendar
        </a>
      </div>
    </div>
  );
}

// ─── Game card ────────────────────────────────────────────────
function GameCard({ game, onRemove }) {
  const releaseDate = game.releaseDate ? new Date(game.releaseDate) : null;
  const today       = new Date();
  const daysUntil   = releaseDate ? Math.ceil((releaseDate - today) / (1000 * 60 * 60 * 24)) : null;

  return (
    <div style={{ background: '#1a1b22', border: '0.5px solid #2a2b36', borderRadius: 14, overflow: 'hidden', display: 'flex', flexDirection: 'column', animation: 'fadeIn 0.3s ease', transition: 'transform 0.15s', position: 'relative' }}
      onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
      onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
    >
      {/* Cover art */}
      <div style={{ position: 'relative', paddingTop: '56.25%', background: '#111116', overflow: 'hidden' }}>
        {game.coverUrl ? (
          <img src={game.coverUrl} alt={game.name} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36, background: 'linear-gradient(135deg,#1e1f28,#2a1f4e)' }}>🎮</div>
        )}
        {/* Days until badge */}
        {daysUntil !== null && (
          <div style={{ position: 'absolute', top: 8, right: 8, borderRadius: 8, padding: '4px 8px', fontSize: 11, fontWeight: 700,
            background: daysUntil <= 7 ? '#ef4444' : daysUntil <= 30 ? '#f97316' : '#6366f1',
            color: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.4)' }}>
            {daysUntil <= 0 ? 'OUT NOW' : daysUntil === 1 ? 'TOMORROW' : `${daysUntil}d`}
          </div>
        )}
        {/* Auto/Manual badge */}
        <div style={{ position: 'absolute', top: 8, left: 8, borderRadius: 6, padding: '3px 7px', fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em',
          background: game.isManual ? '#16a34a22' : '#6366f122',
          border: game.isManual ? '0.5px solid #16a34a55' : '0.5px solid #6366f155',
          color: game.isManual ? '#86efac' : '#a5b4fc' }}>
          {game.isManual ? 'Manual' : 'Auto'}
        </div>
      </div>

      {/* Info */}
      <div style={{ padding: '12px 14px', flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <p style={{ margin: 0, fontWeight: 700, fontSize: 14, color: '#e8e9f3', lineHeight: 1.3 }}>{game.name}</p>

        <p style={{ margin: 0, fontSize: 12, color: game.releaseDate ? '#a78bfa' : '#6b6b7a', fontWeight: game.releaseDate ? 600 : 400 }}>
          {game.releaseDate
            ? releaseDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
            : 'Release date TBC'}
        </p>

        {game.platforms && (
          <p style={{ margin: 0, fontSize: 11, color: '#4a4a5a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {game.platforms}
          </p>
        )}

        {game.calendarEventId && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
            <span style={{ fontSize: 11 }}>📅</span>
            <span style={{ fontSize: 11, color: '#6b6b7a' }}>Added to calendar</span>
          </div>
        )}
      </div>

      {/* Remove button */}
      <button
        onClick={() => onRemove(game.id)}
        title="Remove from watchlist"
        style={{ margin: '0 14px 12px', padding: '6px', borderRadius: 8, border: '0.5px solid #ff555533', background: 'transparent', color: '#ff7070', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, transition: 'background 0.1s' }}
        onMouseEnter={e => e.currentTarget.style.background = '#ff000015'}
        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
      >
        <i className="ti ti-trash" style={{ fontSize: 13 }} aria-hidden="true" />
        Remove
      </button>
    </div>
  );
}

// ─── Search bar ───────────────────────────────────────────────
function SearchBar({ onAdd, existingRawgIds }) {
  const [query,   setQuery]   = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');
  const [addingId,setAddingId]= useState(null);
  const timeout               = useRef(null);

  function handleInput(e) {
    const q = e.target.value;
    setQuery(q);
    setError('');
    clearTimeout(timeout.current);
    if (q.trim().length < 2) { setResults([]); return; }
    timeout.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await api.games.search(q.trim());
        setResults(res);
      } catch (err) {
        setError('Search failed: ' + err.message);
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 500);
  }

  async function handleAdd(game) {
    setAddingId(game.rawgId);
    try {
      const saved = await api.games.add(game);
      onAdd(saved);
      setQuery('');
      setResults([]);
    } catch (err) {
      alert(err.message);
    } finally {
      setAddingId(null);
    }
  }

  return (
    <div style={{ position: 'relative' }}>
      <div style={{ position: 'relative' }}>
        <i className="ti ti-search" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#6b6b7a', fontSize: 16, pointerEvents: 'none' }} aria-hidden="true" />
        <input
          value={query}
          onChange={handleInput}
          placeholder="Search for any game to add manually…"
          style={{ width: '100%', background: '#1a1b22', border: '0.5px solid #3a3a42', borderRadius: 12, color: '#e8e9f3', padding: '12px 14px 12px 40px', fontSize: 14 }}
        />
        {loading && <i className="ti ti-loader" style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', color: '#6b6b7a', fontSize: 16, animation: 'spin 1s linear infinite' }} aria-hidden="true" />}
      </div>

      {error && <p style={{ fontSize: 12, color: '#f87171', margin: '6px 0 0 4px' }}>{error}</p>}

      {results.length > 0 && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100, marginTop: 6, background: '#1a1b22', border: '0.5px solid #3a3a42', borderRadius: 12, boxShadow: '0 8px 32px rgba(0,0,0,0.5)', maxHeight: 300, overflowY: 'auto' }} className="scroll-thin">
          {results.map(g => {
            const already = existingRawgIds.has(g.rawgId);
            return (
              <div key={g.rawgId} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderBottom: '0.5px solid #2a2b36' }}>
                {g.coverUrl
                  ? <img src={g.coverUrl} alt={g.name} style={{ width: 40, height: 40, borderRadius: 6, objectFit: 'cover', flexShrink: 0 }} />
                  : <div style={{ width: 40, height: 40, borderRadius: 6, background: '#2a2a32', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 18 }}>🎮</div>
                }
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#e8e9f3', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.name}</p>
                  <p style={{ margin: 0, fontSize: 11, color: '#6b6b7a' }}>
                    {g.releaseDate ? new Date(g.releaseDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'TBC'}
                    {g.platforms ? ' · ' + g.platforms : ''}
                  </p>
                </div>
                <button
                  onClick={() => handleAdd(g)}
                  disabled={already || addingId === g.rawgId}
                  style={{ padding: '6px 12px', borderRadius: 8, border: 'none', background: already ? '#2a2a32' : '#6366f1', color: already ? '#4a4a5a' : '#fff', cursor: already ? 'default' : 'pointer', fontSize: 12, fontWeight: 600, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 4 }}
                >
                  {addingId === g.rawgId
                    ? <i className="ti ti-loader" style={{ fontSize: 12, animation: 'spin 1s linear infinite' }} aria-hidden="true" />
                    : already ? 'Added'
                    : <><i className="ti ti-plus" style={{ fontSize: 12 }} aria-hidden="true" />Add</>}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────
export default function App() {
  const [appState, setAppState] = useState('loading');
  const [user,     setUser]     = useState(null);
  const [games,    setGames]    = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [syncing,  setSyncing]  = useState(false);
  const [syncMsg,  setSyncMsg]  = useState('');
  const [filter,   setFilter]   = useState('all'); // all | upcoming | tbc

  // Bootstrap
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('auth') === 'success') {
      window.history.replaceState({}, '', window.location.pathname);
    }

    api.auth.me()
      .then(u => {
        setUser(u);
        return api.games.list();
      })
      .then(g => {
        setGames(g);
        setAppState('games');
      })
      .catch(() => setAppState('auth'))
      .finally(() => setLoading(false));
  }, []);

  async function handleSync() {
    setSyncing(true); setSyncMsg('');
    try {
      const res     = await api.games.sync();
      const updated = await api.games.list();
      setGames(updated);
      setSyncMsg(res.message || 'Sync complete.');
    } catch (err) {
      setSyncMsg('Sync failed: ' + err.message);
    } finally {
      setSyncing(false);
    }
  }

  async function handleRemove(id) {
    try {
      await api.games.remove(id);
      setGames(prev => prev.filter(g => g.id !== id));
    } catch (err) {
      alert(err.message);
    }
  }

  function handleAdd(saved) {
    setGames(prev => [...prev, saved]);
  }

  async function handleSignOut() {
    await api.auth.logout().catch(() => {});
    setAppState('auth');
    setUser(null);
  }

  // ── Loading ──
  if (appState === 'loading') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, color: '#6b6b7a', fontSize: 14 }}>
        <i className="ti ti-loader" style={{ fontSize: 20, color: '#6366f1', animation: 'spin 1s linear infinite' }} aria-hidden="true" />
        Loading…
      </div>
    );
  }

  // ── Auth ──
  if (appState === 'auth') return <AuthScreen />;

  // ── Filter games ──
  const today       = new Date();
  const filteredGames = games.filter(g => {
    if (filter === 'upcoming') return g.releaseDate && new Date(g.releaseDate) > today;
    if (filter === 'tbc')      return !g.releaseDate;
    return true;
  });

  const existingRawgIds = new Set(games.map(g => g.rawgId).filter(Boolean));

  return (
    <div style={{ minHeight: '100vh', background: '#0f1015' }}>

      {/* Top bar */}
      <header style={{ background: '#111116', borderBottom: '0.5px solid #2a2b36', padding: '12px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Logo42p size={36} />
          <div>
            <p style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#f5f3ff', letterSpacing: '-0.02em' }}>42p Games</p>
            <p style={{ margin: 0, fontSize: 11, color: '#6b6b7a' }}>Upcoming survival multiplayer releases</p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Sync button */}
          <button
            onClick={handleSync} disabled={syncing}
            style={{ padding: '7px 14px', borderRadius: 9, border: '0.5px solid #6366f155', background: '#6366f122', color: '#a5b4fc', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <i className={syncing ? 'ti ti-loader' : 'ti ti-refresh'} style={{ fontSize: 14, animation: syncing ? 'spin 1s linear infinite' : 'none' }} aria-hidden="true" />
            {syncing ? 'Syncing…' : 'Sync now'}
          </button>

          {/* Calendar link */}
          <a href="https://calendar.42p.uk" style={{ padding: '7px 14px', borderRadius: 9, border: '0.5px solid #2a2b36', background: 'transparent', color: '#8b8ca8', fontSize: 12, fontWeight: 600, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6 }}>
            <i className="ti ti-calendar-event" style={{ fontSize: 14 }} aria-hidden="true" />
            Calendar
          </a>

          {/* User */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '6px 12px', borderRadius: 9, background: '#6366f115', border: '0.5px solid #6366f133' }}>
            <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#6366f1', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700 }}>
              {user.avatar || user.name?.[0]?.toUpperCase()}
            </div>
            <span style={{ fontSize: 12, color: '#a5b4fc', fontWeight: 600 }}>@{user.username}</span>
          </div>

          <button onClick={handleSignOut} style={{ padding: '7px 12px', borderRadius: 9, border: '0.5px solid #2a2b36', background: 'transparent', color: '#6b6b7a', fontSize: 12 }}>
            Sign out
          </button>
        </div>
      </header>

      <main style={{ maxWidth: 1200, margin: '0 auto', padding: '28px 24px' }}>

        {/* Sync message */}
        {syncMsg && (
          <div style={{ marginBottom: 20, padding: '10px 16px', borderRadius: 10, background: '#6366f115', border: '0.5px solid #6366f144', fontSize: 13, color: '#a5b4fc' }}>
            {syncMsg}
          </div>
        )}

        {/* Search */}
        <div style={{ marginBottom: 28, position: 'relative' }}>
          <SearchBar onAdd={handleAdd} existingRawgIds={existingRawgIds} />
        </div>

        {/* Stats + filter row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
          <div style={{ display: 'flex', gap: 16 }}>
            {[
              { label: 'Total tracked', value: games.length },
              { label: 'Upcoming', value: games.filter(g => g.releaseDate && new Date(g.releaseDate) > today).length },
              { label: 'This month', value: games.filter(g => { if (!g.releaseDate) return false; const d = new Date(g.releaseDate); return d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear(); }).length },
            ].map(s => (
              <div key={s.label} style={{ textAlign: 'center' }}>
                <p style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#a5b4fc' }}>{s.value}</p>
                <p style={{ margin: 0, fontSize: 11, color: '#6b6b7a' }}>{s.label}</p>
              </div>
            ))}
          </div>

          {/* Filter tabs */}
          <div style={{ display: 'flex', gap: 4, background: '#1a1b22', borderRadius: 10, padding: 4 }}>
            {[['all', 'All'], ['upcoming', 'Upcoming'], ['tbc', 'TBC']].map(([val, label]) => (
              <button key={val} onClick={() => setFilter(val)}
                style={{ padding: '6px 14px', borderRadius: 7, border: 'none', fontSize: 12, fontWeight: filter === val ? 600 : 400, background: filter === val ? '#6366f1' : 'transparent', color: filter === val ? '#fff' : '#8b8ca8', transition: 'all 0.15s' }}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Games grid */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#6b6b7a' }}>
            <i className="ti ti-loader" style={{ fontSize: 32, animation: 'spin 1s linear infinite', color: '#6366f1' }} aria-hidden="true" />
          </div>
        ) : filteredGames.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#6b6b7a' }}>
            <p style={{ fontSize: 40, margin: '0 0 12px' }}>🎮</p>
            <p style={{ fontSize: 16, color: '#8b8ca8', margin: '0 0 6px' }}>No games here yet</p>
            <p style={{ fontSize: 13 }}>Click <strong style={{ color: '#a5b4fc' }}>Sync now</strong> to pull upcoming survival multiplayer releases, or search above to add one manually.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
            {filteredGames.map(g => (
              <GameCard key={g.id} game={g} onRemove={handleRemove} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
