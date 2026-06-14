import { useState } from 'react';
import { api } from '../api.js';
import { ActivityIcon } from './ActivityManager.jsx';

export default function EventPopover({ popover, currentUser, darkMode, T, onClose, onRemove, onAttendeesChange }) {
  const { ev, rect } = popover;

  // Use attendees from the event prop directly so it always reflects latest state
  const [attendees, setAttendees] = useState(ev.attendees || []);
  const [busy,      setBusy]      = useState(false);

  const safeLeft = Math.min(
    rect.left,
    (typeof window !== 'undefined' ? window.innerWidth : 800) - 240,
  );

  // currentUser may have .userId (from session) or .id — handle both
  const myId        = currentUser.userId || currentUser.id;
  const isAttending = attendees.some(function(a) { return a.id === myId; });
  const isProposer  = ev.proposedBy === myId;
  const isRelease   = ev.proposedByUsername === 'game-release';

  async function handleJoin() {
    setBusy(true);
    try {
      const res = await api.events.join(ev.id);
      setAttendees(res.attendees);
      onAttendeesChange(ev.id, res.attendees);
    } catch (err) {
      console.error('Join failed:', err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleLeave() {
    setBusy(true);
    try {
      const res = await api.events.leave(ev.id);
      setAttendees(res.attendees);
      onAttendeesChange(ev.id, res.attendees);
    } catch (err) {
      console.error('Leave failed:', err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 900 }} />

      <div style={{
        position:  'fixed',
        left:      safeLeft,
        top:       Math.min(rect.bottom + 8, window.innerHeight - 320),
        width:     234,
        background: darkMode ? '#1a1b22' : '#fff',
        border:    '0.5px solid ' + T.borderMd,
        borderRadius: 14,
        zIndex:    1000,
        boxShadow: T.shadow,
        overflow:  'hidden',
      }}>

        {/* Activity + date + time */}
        <div style={{ padding: '14px 16px 12px', borderBottom: '0.5px solid ' + T.border }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <span style={{ fontSize: 24 }}><ActivityIcon icon={ev.activityIcon} size={28} /></span>
            <div>
              <p style={{ margin: 0, fontWeight: 700, fontSize: 14, color: T.text }}>{ev.activityName}</p>
              <p style={{ margin: 0, fontSize: 11, color: T.textSub }}>{ev.date}</p>
            </div>
          </div>
          {(ev.startTime || ev.endTime) && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <i className="ti ti-clock" style={{ fontSize: 13, color: T.textMute }} aria-hidden="true" />
              <span style={{ fontSize: 12, color: T.textSub }}>
                {ev.startTime && ev.endTime
                  ? ev.startTime + ' \u2013 ' + ev.endTime
                  : ev.startTime ? 'From ' + ev.startTime : 'Until ' + ev.endTime}
              </span>
            </div>
          )}
        </div>

        {/* Proposer / game source */}
        <div style={{ padding: '10px 16px', borderBottom: '0.5px solid ' + T.border }}>
          {ev.proposedByUsername === 'game-release' ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#7c3aed', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, flexShrink: 0 }}>
                🎮
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: T.text }}>Game Release</p>
                <p style={{ margin: 0, fontSize: 11, color: T.accentTxt }}>Added from 42p Games</p>
              </div>
              {ev.steamUrl && (
                <a href={ev.steamUrl} target="_blank" rel="noopener noreferrer"
                  title="View on Steam"
                  style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px', borderRadius: 7, background: '#1b2838', border: '0.5px solid #4c6b8a', textDecoration: 'none', flexShrink: 0 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="#c7d5e0">
                    <path d="M11.979 0C5.678 0 .511 4.86.022 11.037l6.432 2.658c.545-.371 1.203-.59 1.912-.59.063 0 .125.004.188.006l2.861-4.142V8.91c0-2.495 2.028-4.524 4.524-4.524 2.494 0 4.524 2.031 4.524 4.527s-2.03 4.525-4.524 4.525h-.105l-4.076 2.911c0 .052.004.105.004.159 0 1.875-1.515 3.396-3.39 3.396-1.635 0-3.016-1.173-3.331-2.727L.436 15.27C1.862 20.307 6.486 24 11.979 24c6.624 0 11.998-5.375 11.998-12S18.603 0 11.979 0zM7.54 18.21l-1.473-.61c.262.543.714.999 1.314 1.25 1.297.539 2.793-.076 3.332-1.375.263-.63.264-1.319.005-1.949s-.75-1.121-1.377-1.383c-.624-.26-1.29-.249-1.878-.03l1.523.63c.956.4 1.409 1.5 1.009 2.455-.397.957-1.497 1.41-2.455 1.012H7.54zm11.415-9.303c0-1.662-1.353-3.015-3.015-3.015-1.665 0-3.015 1.353-3.015 3.015 0 1.665 1.35 3.015 3.015 3.015 1.662 0 3.015-1.35 3.015-3.015zm-5.273-.005c0-1.252 1.013-2.266 2.265-2.266 1.249 0 2.266 1.014 2.266 2.266 0 1.251-1.017 2.265-2.266 2.265-1.252 0-2.265-1.014-2.265-2.265z"/>
                  </svg>
                  <span style={{ fontSize: 11, fontWeight: 600, color: '#c7d5e0' }}>Steam</span>
                </a>
              )}
            </div>
          ) : (
            <>
              <p style={{ margin: '0 0 6px', fontSize: 10, color: T.textMute, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Suggested by
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#6366f1', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, flexShrink: 0 }}>
                  {(ev.proposedByName || '?')[0].toUpperCase()}
                </div>
                <div>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: T.text }}>{ev.proposedByName}</p>
                  <p style={{ margin: 0, fontSize: 11, color: T.accentTxt }}>@{ev.proposedByUsername || 'unknown'}</p>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Attendees */}
        <div style={{ padding: '10px 16px', borderBottom: '0.5px solid ' + T.border }}>
          <p style={{ margin: '0 0 8px', fontSize: 10, color: T.textMute, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            {isRelease ? 'Playing on launch' : 'Attending'} ({attendees.length})
          </p>
          {attendees.length === 0 ? (
            <p style={{ fontSize: 12, color: T.textMute, margin: 0 }}>
              {isRelease ? 'No one yet — RSVP if you’ll grab it!' : 'No one yet — be the first!'}
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {attendees.map(function(a) {
                return (
                  <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <div style={{ width: 22, height: 22, borderRadius: '50%', background: a.id === myId ? '#6366f1' : T.bgHover, color: a.id === myId ? '#fff' : T.textSub, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, flexShrink: 0, border: '0.5px solid ' + T.borderMd }}>
                      {(a.name || '?')[0].toUpperCase()}
                    </div>
                    <span style={{ fontSize: 12, color: T.text }}>{a.name}</span>
                    {a.id === myId && (
                      <span style={{ fontSize: 10, color: T.accentTxt, marginLeft: 'auto' }}>you</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Actions */}
        <div style={{ padding: '10px 16px', display: 'flex', flexDirection: 'column', gap: 7 }}>

          {/* Join / Leave — shown to everyone except the proposer */}
          {!isProposer && (
            isAttending ? (
              <button
                onClick={handleLeave}
                disabled={busy}
                style={{
                  width: '100%', padding: '8px', borderRadius: 8,
                  border: '0.5px solid ' + T.borderMd,
                  background: 'transparent', color: T.textSub,
                  cursor: busy ? 'not-allowed' : 'pointer',
                  fontSize: 13, fontWeight: 500,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}
              >
                <i className="ti ti-user-minus" aria-hidden="true" />
                {busy ? (isRelease ? 'Updating\u2026' : 'Leaving\u2026') : (isRelease ? 'Cancel RSVP' : 'Leave event')}
              </button>
            ) : (
              <button
                onClick={handleJoin}
                disabled={busy}
                style={{
                  width: '100%', padding: '8px', borderRadius: 8,
                  border: '0.5px solid ' + T.accent,
                  background: T.bgAccent, color: T.accentTxt,
                  cursor: busy ? 'not-allowed' : 'pointer',
                  fontSize: 13, fontWeight: 600,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}
              >
                <i className="ti ti-user-plus" aria-hidden="true" />
                {busy ? (isRelease ? 'Updating\u2026' : 'Joining\u2026') : (isRelease ? 'RSVP \u2014 I\u2019ll play' : 'Join event')}
              </button>
            )
          )}

          {/* Remove — proposer only */}
          {isProposer && (
            <button
              onClick={function() { onRemove(ev.date, ev.id); }}
              style={{
                width: '100%', padding: '7px', borderRadius: 8,
                border: '0.5px solid ' + (darkMode ? '#ff5555' : '#ffaaaa'),
                background: 'transparent',
                color: darkMode ? '#ff7070' : '#cc3333',
                cursor: 'pointer', fontSize: 12,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
              }}
            >
              <i className="ti ti-trash" aria-hidden="true" /> Remove event
            </button>
          )}
        </div>
      </div>
    </>
  );
}
