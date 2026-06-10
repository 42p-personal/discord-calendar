import { useState } from 'react';
import { api } from '../api.js';

export default function EventPopover({ popover, currentUser, darkMode, T, onClose, onRemove, onAttendeesChange }) {
  const { ev, rect } = popover;
  const [attendees, setAttendees] = useState(ev.attendees || []);
  const [busy,      setBusy]      = useState(false);

  const safeLeft = Math.min(
    rect.left,
    (typeof window !== 'undefined' ? window.innerWidth : 800) - 240,
  );

  const isAttending  = attendees.some(a => a.id === currentUser.id);
  const isProposer   = ev.proposedBy === currentUser.id;

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
        position: 'fixed',
        left:     safeLeft,
        top:      Math.min(rect.bottom + 8, window.innerHeight - 320),
        width:    234,
        background: darkMode ? '#1a1b22' : '#fff',
        border:   `0.5px solid ${T.borderMd}`,
        borderRadius: 14,
        zIndex:   1000,
        boxShadow: T.shadow,
        overflow: 'hidden',
      }}>

        {/* Activity + date */}
        <div style={{ padding: '14px 16px 12px', borderBottom: `0.5px solid ${T.border}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <span style={{ fontSize: 24 }}>{ev.activityIcon}</span>
            <div>
              <p style={{ margin: 0, fontWeight: 700, fontSize: 14, color: T.text }}>{ev.activityName}</p>
              <p style={{ margin: 0, fontSize: 11, color: T.textSub }}>{ev.date}</p>
            </div>
          </div>

          {/* Time */}
          {(ev.startTime || ev.endTime) && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <i className="ti ti-clock" style={{ fontSize: 13, color: T.textMute }} aria-hidden="true" />
              <span style={{ fontSize: 12, color: T.textSub }}>
                {ev.startTime && ev.endTime
                  ? `${ev.startTime} – ${ev.endTime}`
                  : ev.startTime
                  ? `From ${ev.startTime}`
                  : `Until ${ev.endTime}`}
              </span>
            </div>
          )}
        </div>

        {/* Proposer */}
        <div style={{ padding: '10px 16px', borderBottom: `0.5px solid ${T.border}` }}>
          <p style={{ margin: '0 0 6px', fontSize: 10, color: T.textMute, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Suggested by
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#6366f1', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, flexShrink: 0 }}>
              {(ev.proposedByName ?? '?')[0].toUpperCase()}
            </div>
            <div>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: T.text }}>{ev.proposedByName}</p>
              <p style={{ margin: 0, fontSize: 11, color: T.accentTxt }}>@{ev.proposedByUsername ?? 'unknown'}</p>
            </div>
          </div>
        </div>

        {/* Attendees */}
        <div style={{ padding: '10px 16px', borderBottom: `0.5px solid ${T.border}` }}>
          <p style={{ margin: '0 0 8px', fontSize: 10, color: T.textMute, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Attending ({attendees.length})
          </p>

          {attendees.length === 0 ? (
            <p style={{ fontSize: 12, color: T.textMute, margin: 0 }}>No one yet — be the first!</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {attendees.map(a => (
                <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <div style={{ width: 22, height: 22, borderRadius: '50%', background: a.id === currentUser.id ? '#6366f1' : T.bgHover, color: a.id === currentUser.id ? '#fff' : T.textSub, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, flexShrink: 0, border: `0.5px solid ${T.borderMd}` }}>
                    {(a.name ?? '?')[0].toUpperCase()}
                  </div>
                  <span style={{ fontSize: 12, color: T.text }}>{a.name}</span>
                  {a.id === currentUser.id && (
                    <span style={{ fontSize: 10, color: T.accentTxt, marginLeft: 'auto' }}>you</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div style={{ padding: '10px 16px', display: 'flex', flexDirection: 'column', gap: 7 }}>

          {/* Join / Leave — not shown to proposer since they own it */}
          {!isProposer && (
            isAttending ? (
              <button
                onClick={handleLeave}
                disabled={busy}
                style={{
                  width: '100%', padding: '8px', borderRadius: 8,
                  border: `0.5px solid ${T.borderMd}`,
                  background: 'transparent',
                  color: T.textSub,
                  cursor: busy ? 'not-allowed' : 'pointer',
                  fontSize: 13, fontWeight: 500,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}
              >
                <i className="ti ti-user-minus" aria-hidden="true" />
                {busy ? 'Leaving…' : 'Leave event'}
              </button>
            ) : (
              <button
                onClick={handleJoin}
                disabled={busy}
                style={{
                  width: '100%', padding: '8px', borderRadius: 8,
                  border: `0.5px solid ${T.accent}`,
                  background: T.bgAccent,
                  color: T.accentTxt,
                  cursor: busy ? 'not-allowed' : 'pointer',
                  fontSize: 13, fontWeight: 600,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}
              >
                <i className="ti ti-user-plus" aria-hidden="true" />
                {busy ? 'Joining…' : 'Join event'}
              </button>
            )
          )}

          {/* Remove — proposer only */}
          {isProposer && (
            <button
              onClick={() => onRemove(ev.date, ev.id)}
              style={{
                width: '100%', padding: '7px', borderRadius: 8,
                border: `0.5px solid ${darkMode ? '#ff5555' : '#ffaaaa'}`,
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
