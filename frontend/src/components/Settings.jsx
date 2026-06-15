import { useState, useEffect } from 'react';
import { api } from '../api.js';

const TIMEZONES = [
  'Europe/London', 'Europe/Dublin', 'Europe/Paris', 'Europe/Berlin', 'Europe/Madrid',
  'Europe/Athens', 'America/New_York', 'America/Chicago', 'America/Denver',
  'America/Los_Angeles', 'America/Sao_Paulo', 'Asia/Dubai', 'Asia/Kolkata',
  'Asia/Singapore', 'Asia/Tokyo', 'Australia/Sydney', 'Pacific/Auckland', 'UTC',
];

export default function Settings({ T, darkMode, onClose }) {
  const [timezone,    setTimezone]    = useState('Europe/London');
  const [discordSync, setDiscordSync] = useState(false);
  const [botReady,    setBotReady]    = useState(false);
  const [loading,     setLoading]     = useState(true);
  const [saving,      setSaving]      = useState(false);
  const [saved,       setSaved]       = useState(false);

  useEffect(function() {
    api.settings.get()
      .then(function(s) {
        setTimezone(s.timezone || 'Europe/London');
        setDiscordSync(!!s.discordSync);
        setBotReady(!!s.botConfigured);
      })
      .catch(function() {})
      .finally(function() { setLoading(false); });
  }, []);

  function save(next) {
    var payload = Object.assign({ timezone: timezone, discordSync: discordSync }, next || {});
    setTimezone(payload.timezone);
    setDiscordSync(payload.discordSync);
    setSaving(true); setSaved(false);
    api.settings.save(payload)
      .then(function(s) {
        setTimezone(s.timezone); setDiscordSync(!!s.discordSync); setBotReady(!!s.botConfigured);
        setSaved(true);
        setTimeout(function() { setSaved(false); }, 1800);
      })
      .catch(function() {})
      .finally(function() { setSaving(false); });
  }

  var tzList = TIMEZONES.indexOf(timezone) === -1 ? [timezone].concat(TIMEZONES) : TIMEZONES;

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)', zIndex: 1100 }} />
      <div style={{
        position: 'fixed', left: '50%', top: '50%', transform: 'translate(-50%,-50%)',
        width: 'min(440px, calc(100vw - 24px))', maxHeight: 'calc(100dvh - 48px)', overflowY: 'auto',
        background: darkMode ? '#16171f' : '#fff', border: '0.5px solid ' + T.borderMd,
        borderRadius: 18, zIndex: 1101, boxShadow: T.shadow, padding: '20px',
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: T.text }}>Settings</h2>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: T.textSub }}>Per-server preferences.</p>
          </div>
          <button onClick={onClose} aria-label="Close"
            style={{ background: 'transparent', border: 'none', color: T.textSub, cursor: 'pointer', fontSize: 20, lineHeight: 1, padding: 4 }}>✕</button>
        </div>

        {loading ? (
          <div style={{ padding: '40px 0', textAlign: 'center', color: T.textSub }}>
            <i className="ti ti-loader" style={{ fontSize: 22, animation: 'spin 1s linear infinite' }} />
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>

            {/* Timezone */}
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: T.text, marginBottom: 6 }}>Timezone</label>
              <p style={{ margin: '0 0 8px', fontSize: 12, color: T.textSub }}>Used to place event times correctly on Discord.</p>
              <select value={timezone} onChange={function(e) { save({ timezone: e.target.value }); }}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '0.5px solid ' + T.borderMd, background: darkMode ? '#0f1015' : '#fff', color: T.text, fontSize: 14, cursor: 'pointer' }}>
                {tzList.map(function(tz) {
                  return <option key={tz} value={tz}>{tz.replace(/_/g, ' ')}</option>;
                })}
              </select>
            </div>

            {/* Discord sync */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <div style={{ minWidth: 0 }}>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: T.text }}>Sync to Discord events</label>
                  <p style={{ margin: '2px 0 0', fontSize: 12, color: T.textSub }}>Mirror calendar events into your server's built-in Events.</p>
                </div>
                <button onClick={function() { save({ discordSync: !discordSync }); }} disabled={saving}
                  aria-pressed={discordSync}
                  style={{
                    flexShrink: 0, width: 46, height: 26, borderRadius: 99, border: 'none', cursor: saving ? 'wait' : 'pointer',
                    background: discordSync ? T.accent : (darkMode ? '#2a2b3d' : '#d6d6e0'),
                    position: 'relative', transition: 'background 0.18s',
                  }}>
                  <span style={{ position: 'absolute', top: 3, left: discordSync ? 23 : 3, width: 20, height: 20, borderRadius: '50%', background: '#fff', transition: 'left 0.18s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }} />
                </button>
              </div>

              {/* Bot status */}
              <div style={{ marginTop: 10, padding: '10px 12px', borderRadius: 10, background: botReady ? (darkMode ? '#16a34a18' : '#16a34a12') : (darkMode ? '#f59e0b18' : '#f59e0b12'), border: '0.5px solid ' + (botReady ? '#16a34a44' : '#f59e0b44'), display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <i className={botReady ? 'ti ti-circle-check' : 'ti ti-info-circle'} style={{ fontSize: 15, color: botReady ? '#22c55e' : '#f59e0b', flexShrink: 0, marginTop: 1 }} />
                <p style={{ margin: 0, fontSize: 12, color: T.textSub, lineHeight: 1.5 }}>
                  {botReady
                    ? 'The 42p bot is connected. New and moved events will appear in Discord automatically.'
                    : 'A Discord bot needs to be added to your server before sync can run. You can enable this now — it will activate as soon as the bot is connected.'}
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 11, color: T.textMute }}>{saving ? 'Saving…' : saved ? 'Saved ✓' : ''}</span>
              <button onClick={onClose}
                style={{ padding: '8px 18px', borderRadius: 9, border: 'none', background: T.accent, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
