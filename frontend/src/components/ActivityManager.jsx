import { useState } from 'react';
import { ACTIVITY_COLORS } from '../constants.js';
import { uid } from '../constants.js';

const DARK_INPUT = {
  background: '#0d0e14',
  border: '0.5px solid #3a3a42',
  borderRadius: 8,
  color: '#e8e9f3',
  padding: '8px 10px',
  fontSize: 13,
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box',
};

function ColorPicker({ value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
      {ACTIVITY_COLORS.map((c) => (
        <div
          key={c}
          onClick={() => onChange(c)}
          style={{
            width: 22, height: 22, borderRadius: '50%', background: c,
            cursor: 'pointer', boxSizing: 'border-box',
            border:     value === c ? '3px solid #fff'          : '2px solid transparent',
            transform:  value === c ? 'scale(1.2)'              : 'scale(1)',
            transition: 'transform 0.1s',
          }}
        />
      ))}
    </div>
  );
}

function ActivityRow({ act, users, onEdit, onDelete }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', borderRadius: 9, border: '0.5px solid #2e2e36', background: '#222228' }}>
      <span style={{ fontSize: 15 }}>{act.icon}</span>
      <div style={{ width: 9, height: 9, borderRadius: '50%', background: act.color, flexShrink: 0 }} />
      <span style={{ fontSize: 13, flex: 1, color: '#e8e9f3', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {act.name}
      </span>
      {act.createdBy && (
        <span style={{ fontSize: 10, color: '#4a4a5a', flexShrink: 0 }}>
          @{users[act.createdBy]?.username ?? '?'}
        </span>
      )}
      <button onClick={() => onEdit(act)} style={{ padding: '4px 8px', borderRadius: 7, border: '0.5px solid #3a3a42', background: '#28282f', color: '#b0b0bc', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center' }}>
        <i className="ti ti-settings" style={{ fontSize: 12 }} aria-hidden="true" />
      </button>
      <button onClick={() => onDelete(act.id)} style={{ padding: '4px 8px', borderRadius: 7, border: '0.5px solid #ff5555', background: 'transparent', color: '#ff7070', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center' }}>
        <i className="ti ti-trash" style={{ fontSize: 12 }} aria-hidden="true" />
      </button>
    </div>
  );
}

function EditForm({ act, onSave, onCancel }) {
  const [draft, setDraft] = useState({ ...act });

  return (
    <div style={{ background: '#111116', border: '0.5px solid #3a3a42', borderRadius: 10, padding: '14px 16px' }}>
      <p style={{ margin: '0 0 12px', fontSize: 10, fontWeight: 600, color: '#a5b4fc', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
        Editing
      </p>

      <div style={{ display: 'flex', gap: 10, marginBottom: 12, alignItems: 'flex-end' }}>
        <div>
          <p style={{ fontSize: 11, color: '#6b6b7a', margin: '0 0 4px' }}>Icon</p>
          <input
            value={draft.icon}
            onChange={(e) => setDraft((d) => ({ ...d, icon: e.target.value }))}
            style={{ ...DARK_INPUT, width: 46, fontSize: 20, textAlign: 'center', padding: '5px' }}
            title="Paste an emoji"
          />
        </div>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: 11, color: '#6b6b7a', margin: '0 0 4px' }}>Name</p>
          <input
            value={draft.name}
            onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
            placeholder="Activity name"
            style={DARK_INPUT}
            onKeyDown={(e) => e.key === 'Enter' && onSave(draft)}
          />
        </div>
      </div>

      <p style={{ fontSize: 11, color: '#6b6b7a', margin: '0 0 8px' }}>Colour</p>
      <div style={{ marginBottom: 14 }}>
        <ColorPicker value={draft.color} onChange={(c) => setDraft((d) => ({ ...d, color: c }))} />
      </div>

      {/* Preview chip */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 8, background: draft.color + '22', border: `0.5px solid ${draft.color}55`, marginBottom: 14 }}>
        <span style={{ fontSize: 16 }}>{draft.icon}</span>
        <span style={{ fontSize: 13, color: '#e8e9f3', flex: 1 }}>{draft.name || 'Unnamed'}</span>
        <span style={{ fontSize: 10, color: '#6b6b7a' }}>preview</span>
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={() => onSave(draft)} style={{ flex: 1, padding: '8px', borderRadius: 8, border: '0.5px solid #6366f155', background: '#6366f122', color: '#a5b4fc', cursor: 'pointer', fontWeight: 600, fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
          <i className="ti ti-check" aria-hidden="true" /> Save
        </button>
        <button onClick={onCancel} style={{ padding: '8px 14px', borderRadius: 8, border: '0.5px solid #3a3a42', background: '#28282f', color: '#b0b0bc', cursor: 'pointer', fontSize: 13 }}>
          Cancel
        </button>
      </div>
    </div>
  );
}

export default function ActivityManager({ activities, users, onAdd, onUpdate, onDelete, onClose }) {
  const [editing,      setEditing]      = useState(null);
  const [newActName,   setNewActName]   = useState('');
  const [newActIcon,   setNewActIcon]   = useState('⭐');
  const [newActColor,  setNewActColor]  = useState(ACTIVITY_COLORS[0]);

  function handleAdd() {
    if (!newActName.trim()) return;
    onAdd({ id: uid(), name: newActName.trim(), icon: newActIcon, color: newActColor });
    setNewActName(''); setNewActIcon('⭐'); setNewActColor(ACTIVITY_COLORS[0]);
  }

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, zIndex: 800, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(3px)' }}
      />

      {/* Panel */}
      <div
        style={{
          position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
          width: 440, maxHeight: '82vh', overflowY: 'auto',
          background: '#1a1a1f', border: '0.5px solid #3a3a42', borderRadius: 14,
          zIndex: 900, display: 'flex', flexDirection: 'column',
          boxShadow: '0 24px 64px rgba(0,0,0,0.7)',
        }}
        className="scroll-thin"
      >
        {/* Header */}
        <div style={{ background: '#141417', borderBottom: '0.5px solid #2e2e36', borderRadius: '14px 14px 0 0', padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 30, height: 30, borderRadius: 8, background: '#2a2a32', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <i className="ti ti-settings" style={{ fontSize: 15, color: '#a5b4fc' }} aria-hidden="true" />
            </div>
            <div>
              <p style={{ fontSize: 14, fontWeight: 600, color: '#e8e9f3', margin: 0 }}>Activity settings</p>
              <p style={{ fontSize: 11, color: '#6b6b7a', margin: 0 }}>{activities.length} {activities.length === 1 ? 'activity' : 'activities'}</p>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b6b7a', fontSize: 18, padding: 0, lineHeight: 1 }}>
            <i className="ti ti-x" aria-hidden="true" />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column' }}>

          <p style={{ fontSize: 10, fontWeight: 600, color: '#6b6b7a', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 10px' }}>
            All activities
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 4 }}>
            {activities.length === 0 && (
              <p style={{ fontSize: 13, color: '#6b6b7a', textAlign: 'center', padding: '14px 0', margin: 0 }}>
                No activities yet — add one below.
              </p>
            )}
            {activities.map((act) => (
              <div key={act.id}>
                {editing?.id === act.id ? (
                  <EditForm
                    act={editing}
                    onSave={(updated) => { onUpdate(updated); setEditing(null); }}
                    onCancel={() => setEditing(null)}
                  />
                ) : (
                  <ActivityRow
                    act={act}
                    users={users}
                    onEdit={(a) => setEditing({ ...a })}
                    onDelete={onDelete}
                  />
                )}
              </div>
            ))}
          </div>

          <hr style={{ border: 'none', borderTop: '0.5px solid #2e2e36', margin: '16px 0' }} />

          {/* Add new */}
          <p style={{ fontSize: 10, fontWeight: 600, color: '#6b6b7a', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 10px' }}>
            Add new activity
          </p>

          <div style={{ display: 'flex', gap: 10, marginBottom: 12, alignItems: 'flex-end' }}>
            <div>
              <p style={{ fontSize: 11, color: '#6b6b7a', margin: '0 0 4px' }}>Icon</p>
              <input
                value={newActIcon} onChange={(e) => setNewActIcon(e.target.value)}
                style={{ ...DARK_INPUT, width: 46, fontSize: 20, textAlign: 'center', padding: '5px' }}
                title="Paste an emoji"
              />
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 11, color: '#6b6b7a', margin: '0 0 4px' }}>Name</p>
              <input
                value={newActName} onChange={(e) => setNewActName(e.target.value)}
                placeholder="e.g. Bowling night" style={DARK_INPUT}
                onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              />
            </div>
          </div>

          <p style={{ fontSize: 11, color: '#6b6b7a', margin: '0 0 8px' }}>Colour</p>
          <div style={{ marginBottom: 14 }}>
            <ColorPicker value={newActColor} onChange={setNewActColor} />
          </div>

          {/* Preview */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 8, background: newActColor + '22', border: `0.5px solid ${newActColor}55`, marginBottom: 14 }}>
            <span style={{ fontSize: 16 }}>{newActIcon}</span>
            <span style={{ fontSize: 13, color: '#e8e9f3', flex: 1 }}>{newActName || 'Your new activity'}</span>
            <span style={{ fontSize: 10, color: '#6b6b7a' }}>preview</span>
          </div>

          <button
            onClick={handleAdd}
            style={{ width: '100%', padding: '9px', borderRadius: 9, border: '0.5px solid #6366f155', background: '#6366f122', color: '#a5b4fc', cursor: 'pointer', fontWeight: 600, fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
          >
            <i className="ti ti-plus" aria-hidden="true" /> Add activity
          </button>
        </div>
      </div>
    </>
  );
}
