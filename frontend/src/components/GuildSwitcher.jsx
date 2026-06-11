import { useState } from 'react';

export default function GuildSwitcher({ currentGuild, guilds, onSwitch, T }) {
  var [open, setOpen] = useState(false);

  if (!currentGuild) return null;

  return (
    <div style={{ position: 'relative' }}>
      {/* Current server button */}
      <button
        onClick={function() { setOpen(function(o) { return !o; }); }}
        style={{
          display: 'flex', alignItems: 'center', gap: 7,
          padding: '5px 10px', borderRadius: 8,
          border: '0.5px solid ' + T.borderMd,
          background: open ? T.bgHover : 'transparent',
          cursor: 'pointer', transition: 'background 0.12s',
          maxWidth: 180,
        }}
      >
        {/* Server icon */}
        {currentGuild.iconUrl ? (
          <img src={currentGuild.iconUrl} alt={currentGuild.name}
            style={{ width: 20, height: 20, borderRadius: 5, objectFit: 'cover', flexShrink: 0 }} />
        ) : (
          <div style={{ width: 20, height: 20, borderRadius: 5, background: '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
            {currentGuild.name.charAt(0).toUpperCase()}
          </div>
        )}
        <span style={{ fontSize: 12, fontWeight: 500, color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {currentGuild.name}
        </span>
        <i className={'ti ti-chevron-' + (open ? 'up' : 'down')} style={{ fontSize: 12, color: T.textMute, flexShrink: 0 }} aria-hidden="true" />
      </button>

      {/* Dropdown */}
      {open && (
        <>
          <div onClick={function() { setOpen(false); }} style={{ position: 'fixed', inset: 0, zIndex: 200 }} />
          <div style={{
            position: 'absolute', top: '100%', right: 0, marginTop: 6,
            width: 220, zIndex: 300,
            background: T.bgCard, border: '0.5px solid ' + T.borderMd,
            borderRadius: 12, boxShadow: T.shadow, overflow: 'hidden',
          }}>
            <p style={{ fontSize: 10, fontWeight: 600, color: T.textMute, textTransform: 'uppercase', letterSpacing: '0.07em', padding: '10px 12px 6px', margin: 0 }}>
              Switch server
            </p>
            {guilds.map(function(guild) {
              var isCurrent = guild.id === currentGuild.id;
              return (
                <button
                  key={guild.id}
                  onClick={function() { if (!isCurrent) { onSwitch(guild); } setOpen(false); }}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                    padding: '9px 12px', border: 'none',
                    background: isCurrent ? T.bgAccent : 'transparent',
                    cursor: isCurrent ? 'default' : 'pointer',
                    textAlign: 'left', transition: 'background 0.1s',
                  }}
                  onMouseEnter={function(e) { if (!isCurrent) e.currentTarget.style.background = T.bgHover; }}
                  onMouseLeave={function(e) { if (!isCurrent) e.currentTarget.style.background = 'transparent'; }}
                >
                  {guild.iconUrl ? (
                    <img src={guild.iconUrl} alt={guild.name}
                      style={{ width: 28, height: 28, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />
                  ) : (
                    <div style={{ width: 28, height: 28, borderRadius: 8, background: '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                      {guild.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <span style={{ fontSize: 13, color: T.text, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: isCurrent ? 600 : 400 }}>
                    {guild.name}
                  </span>
                  {isCurrent && (
                    <i className="ti ti-check" style={{ fontSize: 13, color: T.accentTxt, flexShrink: 0 }} aria-hidden="true" />
                  )}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
