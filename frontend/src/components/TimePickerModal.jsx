/**
 * TimePickerModal
 * Shown when an activity is dropped onto a day.
 * Asks the proposer for an optional start and end time before saving.
 */
export default function TimePickerModal({ activity, dateKey, darkMode, T, onConfirm, onCancel }) {
  const bg     = darkMode ? '#1a1b22' : '#fff';
  const input  = {
    background:   darkMode ? '#0d0e14' : '#f4f5fb',
    border:       `0.5px solid ${T.borderMd}`,
    borderRadius: 8,
    color:        T.text,
    padding:      '8px 12px',
    fontSize:     15,
    outline:      'none',
    width:        '100%',
    boxSizing:    'border-box',
  };

  function handleSubmit(e) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    onConfirm({
      startTime: fd.get('startTime') || null,
      endTime:   fd.get('endTime')   || null,
    });
  }

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onCancel}
        style={{ position: 'fixed', inset: 0, zIndex: 1100, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(2px)' }}
      />

      {/* Modal */}
      <div style={{
        position: 'fixed', top: '50%', left: '50%',
        transform: 'translate(-50%,-50%)',
        width: 340, zIndex: 1200,
        background: bg,
        border: `0.5px solid ${T.borderMd}`,
        borderRadius: 16,
        boxShadow: T.shadow,
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 18px',
          borderBottom: `0.5px solid ${T.border}`,
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10,
            background: activity.color + '22',
            border: `0.5px solid ${activity.color}55`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 20, flexShrink: 0,
          }}>
            {activity.icon}
          </div>
          <div>
            <p style={{ margin: 0, fontWeight: 600, fontSize: 15, color: T.text }}>{activity.name}</p>
            <p style={{ margin: 0, fontSize: 12, color: T.textSub }}>{dateKey}</p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ padding: '18px 18px 20px' }}>
          <p style={{ margin: '0 0 14px', fontSize: 13, color: T.textSub }}>
            Set a time for this event <span style={{ color: T.textMute }}>(optional)</span>
          </p>

          <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 11, color: T.textMute, display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Start time
              </label>
              <input name="startTime" type="time" style={input} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 11, color: T.textMute, display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                End time
              </label>
              <input name="endTime" type="time" style={input} />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button
              type="submit"
              style={{
                flex: 1, padding: '10px', borderRadius: 9, border: 'none',
                background: T.accent, color: '#fff',
                fontWeight: 600, fontSize: 14, cursor: 'pointer',
              }}
            >
              Propose event
            </button>
            <button
              type="button"
              onClick={onCancel}
              style={{
                padding: '10px 16px', borderRadius: 9,
                border: `0.5px solid ${T.borderMd}`,
                background: 'transparent', color: T.textSub,
                fontSize: 14, cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
