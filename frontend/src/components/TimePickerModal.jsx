import { useState } from 'react';
import { ActivityIcon } from './ActivityManager.jsx';
import { TimeWheelPicker } from './WheelTimePicker.jsx';

export default function TimePickerModal({ activity, dateKey, darkMode, T, onConfirm, onCancel }) {
  var bg = darkMode ? '#1a1b22' : '#fff';

  var [startEnabled, setStartEnabled] = useState(true);
  var [endEnabled,   setEndEnabled]   = useState(false);
  var [startTime,    setStartTime]    = useState('19:00');
  var [endTime,      setEndTime]      = useState('21:00');

  function handleConfirm() {
    onConfirm({
      startTime: startEnabled ? startTime : null,
      endTime:   endEnabled   ? endTime   : null,
    });
  }

  var labelStyle = {
    fontSize: 11, color: T.textMute,
    textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 700,
  };
  var toggleStyle = {
    display: 'flex', alignItems: 'center', gap: 6,
    cursor: 'pointer', marginBottom: 12,
  };

  return (
    <>
      {/* Backdrop */}
      <div onClick={onCancel} style={{
        position: 'fixed', inset: 0, zIndex: 1100,
        background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(2px)',
      }} />

      {/* Modal */}
      <div style={{
        position: 'fixed', top: '50%', left: '50%',
        transform: 'translate(-50%,-50%)',
        width: 360, zIndex: 1200,
        background: bg,
        border: '0.5px solid ' + T.borderMd,
        borderRadius: 16,
        boxShadow: T.shadow,
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 18px',
          borderBottom: '0.5px solid ' + T.border,
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10,
            background: activity.color + '22',
            border: '0.5px solid ' + activity.color + '55',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 20, flexShrink: 0,
          }}>
            <ActivityIcon icon={activity.icon} size={20} />
          </div>
          <div>
            <p style={{ margin: 0, fontWeight: 600, fontSize: 15, color: T.text }}>{activity.name}</p>
            <p style={{ margin: 0, fontSize: 12, color: T.textSub }}>{dateKey}</p>
          </div>
        </div>

        {/* Wheels */}
        <div style={{ display: 'flex', padding: '18px 0 6px' }}>
          {/* Start time */}
          <div style={{ flex: 1, padding: '0 16px' }}>
            <label style={toggleStyle}>
              <input type="checkbox" checked={startEnabled}
                onChange={function(e) { setStartEnabled(e.target.checked); }}
                style={{ width: 14, height: 14, accentColor: T.accent, cursor: 'pointer' }} />
              <span style={labelStyle}>Start time</span>
            </label>
            {startEnabled
              ? <TimeWheelPicker value={startTime} onChange={setStartTime}
                  bg={bg} accent={T.accent} ink={darkMode ? '#6b6b7a' : '#9ca3af'} />
              : <div style={{ height: ITEM_H * 5, display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.textMute, fontSize: 13 }}>
                  All day
                </div>
            }
          </div>

          {/* Divider */}
          <div style={{ width: '0.5px', background: T.border, margin: '0 0' }} />

          {/* End time */}
          <div style={{ flex: 1, padding: '0 16px' }}>
            <label style={toggleStyle}>
              <input type="checkbox" checked={endEnabled}
                onChange={function(e) { setEndEnabled(e.target.checked); }}
                style={{ width: 14, height: 14, accentColor: T.accent, cursor: 'pointer' }} />
              <span style={labelStyle}>End time</span>
            </label>
            {endEnabled
              ? <TimeWheelPicker value={endTime} onChange={setEndTime}
                  bg={bg} accent={T.accent} ink={darkMode ? '#6b6b7a' : '#9ca3af'} />
              : <div style={{ height: ITEM_H * 5, display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.textMute, fontSize: 13 }}>
                  No end
                </div>
            }
          </div>
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: 10, padding: '12px 18px 20px' }}>
          <button onClick={handleConfirm}
            style={{
              flex: 1, padding: 10, borderRadius: 9, border: 'none',
              background: T.accent, color: '#fff',
              fontWeight: 600, fontSize: 14, cursor: 'pointer',
            }}>
            Propose event
          </button>
          <button onClick={onCancel}
            style={{
              padding: '10px 16px', borderRadius: 9,
              border: '0.5px solid ' + T.borderMd,
              background: 'transparent', color: T.textSub,
              fontSize: 14, cursor: 'pointer',
            }}>
            Cancel
          </button>
        </div>
      </div>
    </>
  );
}

var ITEM_H = 44; // used for the "no time" placeholder height
