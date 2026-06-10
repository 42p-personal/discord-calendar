/**
 * EventPopover
 * Shows event details when a user clicks an event chip.
 * Anchors below the clicked element; owner can delete their own events.
 */
export default function EventPopover({ popover, currentUser, darkMode, T, onClose, onRemove }) {
  const { ev, rect } = popover;

  const safeLeft = Math.min(
    rect.left,
    (typeof window !== 'undefined' ? window.innerWidth : 800) - 224,
  );

  return (
    <>
      {/* Invisible backdrop to close on outside click */}
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, zIndex: 900 }}
      />

      <div style={{
        position: 'fixed',
        left: safeLeft,
        top:  rect.bottom + 8,
        width: 214,
        background: darkMode ? '#1a1b22' : '#fff',
        border: `0.5px solid ${T.borderMd}`,
        borderRadius: 12,
        padding: '14px 16px',
        zIndex: 1000,
        boxShadow: T.shadow,
      }}>
        {/* Activity name + date */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <span style={{ fontSize: 22 }}>{ev.activityIcon}</span>
          <div>
            <p style={{ margin: 0, fontWeight: 600, fontSize: 14, color: T.text }}>{ev.activityName}</p>
            <p style={{ margin: 0, fontSize: 11, color: T.textSub }}>{ev.date}</p>
          </div>
        </div>

        {/* Proposer */}
        <div style={{ borderTop: `0.5px solid ${T.border}`, paddingTop: 10, marginBottom: 10 }}>
          <p style={{ margin: '0 0 6px', fontSize: 11, color: T.textMute }}>Suggested by</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <div style={{ width: 26, height: 26, borderRadius: '50%', background: '#6366f1', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
              {(ev.proposedByName ?? '?')[0].toUpperCase()}
            </div>
            <div>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: T.text }}>{ev.proposedByName}</p>
              <p style={{ margin: 0, fontSize: 11, color: T.accentTxt }}>@{ev.proposedByUsername ?? 'unknown'}</p>
            </div>
          </div>
        </div>

        {/* Delete — only for the event owner */}
        {ev.proposedBy === currentUser.id && (
          <button
            onClick={() => onRemove(ev.date, ev.id)}
            style={{
              width: '100%', padding: '6px', borderRadius: 8,
              border: `0.5px solid ${darkMode ? '#ff5555' : '#ffaaaa'}`,
              background: 'transparent',
              color:  darkMode ? '#ff7070' : '#cc3333',
              cursor: 'pointer', fontSize: 12,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
            }}
          >
            <i className="ti ti-trash" aria-hidden="true" /> Remove event
          </button>
        )}
      </div>
    </>
  );
}
