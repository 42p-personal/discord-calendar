/**
 * GuildPicker
 * Shown after sign-in when no server has been selected yet.
 * Also used by the GuildSwitcher dropdown in the top bar.
 */
export default function GuildPicker({ guilds, loading, error, onSelect, currentGuildId }) {
  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#111318', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, color: '#8b8ca8', fontSize: 14 }}>
        <i className="ti ti-loader" style={{ fontSize: 20, color: '#6366f1', animation: 'spin 1s linear infinite' }} aria-hidden="true" />
        Loading your servers…
        <style>{`@keyframes spin { from { transform:rotate(0deg); } to { transform:rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'radial-gradient(ellipse at 60% 20%, #2e1065 0%, #111318 60%)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem 1rem' }}>
      <div style={{ width: '100%', maxWidth: 500 }}>

        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>🖥️</div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#e8e9f3', margin: '0 0 6px', letterSpacing: '-0.02em' }}>
            Select a server
          </h1>
          <p style={{ fontSize: 13, color: '#8b8ca8', margin: 0 }}>
            Each server has its own private calendar. Pick which one to view.
          </p>
        </div>

        {error && (
          <div style={{ marginBottom: 16, padding: '10px 14px', borderRadius: 10, background: '#ff000015', border: '0.5px solid #ff000044', fontSize: 13, color: '#f87171', textAlign: 'center' }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {guilds.map(function(guild) {
            var isActive = guild.id === currentGuildId;
            return (
              <button
                key={guild.id}
                onClick={function() { onSelect(guild); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  padding: '14px 16px', borderRadius: 14,
                  border: isActive ? '1px solid #6366f1' : '0.5px solid #2a2b36',
                  background: isActive ? '#6366f115' : '#1a1b22',
                  cursor: 'pointer', textAlign: 'left',
                  transition: 'all 0.15s',
                  boxShadow: isActive ? '0 0 0 1px #6366f144' : 'none',
                }}
                onMouseEnter={function(e) { if (!isActive) e.currentTarget.style.background = '#22232c'; e.currentTarget.style.borderColor = '#363748'; }}
                onMouseLeave={function(e) { if (!isActive) { e.currentTarget.style.background = '#1a1b22'; e.currentTarget.style.borderColor = '#2a2b36'; } }}
              >
                {/* Server icon */}
                {guild.iconUrl ? (
                  <img src={guild.iconUrl} alt={guild.name}
                    style={{ width: 46, height: 46, borderRadius: 14, objectFit: 'cover', flexShrink: 0 }} />
                ) : (
                  <div style={{ width: 46, height: 46, borderRadius: 14, background: '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                    {guild.name.charAt(0).toUpperCase()}
                  </div>
                )}

                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: '#e8e9f3', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {guild.name}
                  </p>
                  {guild.owner && (
                    <p style={{ margin: '2px 0 0', fontSize: 11, color: '#6b6b7a' }}>Owner</p>
                  )}
                </div>

                {isActive && (
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#6366f1', flexShrink: 0 }} />
                )}

                <i className="ti ti-chevron-right" style={{ fontSize: 16, color: '#52536a', flexShrink: 0 }} aria-hidden="true" />
              </button>
            );
          })}
        </div>

        {guilds.length === 0 && !error && (
          <p style={{ textAlign: 'center', fontSize: 13, color: '#6b6b7a', marginTop: 20 }}>
            No Discord servers found. Make sure you are a member of at least one server.
          </p>
        )}
      </div>

      <style>{`@keyframes spin { from { transform:rotate(0deg); } to { transform:rotate(360deg); } }`}</style>
    </div>
  );
}
