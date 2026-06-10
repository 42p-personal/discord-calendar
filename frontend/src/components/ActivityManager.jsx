import { useState, useRef } from 'react';
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

// Resize an image file to maxSize x maxSize and return a base64 data URL
function resizeImage(file, maxSize) {
  return new Promise(function(resolve, reject) {
    var img    = new Image();
    var reader = new FileReader();
    reader.onload = function(e) {
      img.src = e.target.result;
    };
    img.onload = function() {
      var canvas = document.createElement('canvas');
      var size   = Math.min(img.width, img.height);
      // Crop to square from centre, then scale to maxSize
      var sx = (img.width  - size) / 2;
      var sy = (img.height - size) / 2;
      canvas.width  = maxSize;
      canvas.height = maxSize;
      var ctx = canvas.getContext('2d');
      ctx.drawImage(img, sx, sy, size, size, 0, 0, maxSize, maxSize);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = reject;
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Renders either an image (if icon is a data URL / http URL) or emoji text
export function ActivityIcon({ icon, size }) {
  size = size || 16;
  if (icon && (icon.startsWith('data:') || icon.startsWith('http'))) {
    return (
      <img
        src={icon}
        alt=""
        style={{ width: size, height: size, borderRadius: 3, objectFit: 'cover', flexShrink: 0 }}
      />
    );
  }
  return <span style={{ fontSize: size, lineHeight: 1 }}>{icon}</span>;
}

function ColorPicker({ value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
      {ACTIVITY_COLORS.map(function(c) {
        return (
          <div
            key={c}
            onClick={function() { onChange(c); }}
            style={{
              width: 22, height: 22, borderRadius: '50%', background: c,
              cursor: 'pointer', boxSizing: 'border-box',
              border:    value === c ? '3px solid #fff'  : '2px solid transparent',
              transform: value === c ? 'scale(1.2)'      : 'scale(1)',
              transition: 'transform 0.1s',
            }}
          />
        );
      })}
    </div>
  );
}

// Icon picker — emoji input OR image upload
function IconPicker({ value, onChange }) {
  var fileRef   = useRef(null);
  var isImage   = value && (value.startsWith('data:') || value.startsWith('http'));
  var [err, setErr] = useState('');

  async function handleFile(e) {
    var file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { setErr('Please select an image file.'); return; }
    if (file.size > 2 * 1024 * 1024) { setErr('Image must be under 2MB.'); return; }
    setErr('');
    try {
      // Resize to 32×32 for calendar chips, stored as PNG data URL
      var dataUrl = await resizeImage(file, 32);
      onChange(dataUrl);
    } catch (e) {
      setErr('Could not process image. Try a different file.');
    }
    // Reset input so the same file can be re-selected
    e.target.value = '';
  }

  return (
    <div>
      <p style={{ fontSize: 11, color: '#6b6b7a', margin: '0 0 6px' }}>Icon</p>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: err ? 6 : 0 }}>
        {/* Emoji input */}
        <input
          value={isImage ? '' : (value || '')}
          onChange={function(e) { onChange(e.target.value); }}
          placeholder="😀"
          style={{ ...DARK_INPUT, width: 46, fontSize: 20, textAlign: 'center', padding: '5px' }}
          title="Type or paste an emoji"
        />

        {/* OR divider */}
        <span style={{ fontSize: 11, color: '#4a4a5a' }}>or</span>

        {/* Image upload button */}
        <button
          type="button"
          onClick={function() { fileRef.current.click(); }}
          style={{
            padding: '6px 10px', borderRadius: 7,
            border: '0.5px solid #3a3a42',
            background: isImage ? '#6366f122' : '#28282f',
            color: isImage ? '#a5b4fc' : '#b0b0bc',
            cursor: 'pointer', fontSize: 11, whiteSpace: 'nowrap',
            display: 'flex', alignItems: 'center', gap: 5,
          }}
        >
          <i className="ti ti-upload" style={{ fontSize: 12 }} aria-hidden="true" />
          {isImage ? 'Change image' : 'Upload image'}
        </button>

        {/* Preview if image */}
        {isImage && (
          <div style={{ position: 'relative' }}>
            <img src={value} alt="" style={{ width: 32, height: 32, borderRadius: 5, objectFit: 'cover', border: '0.5px solid #3a3a42' }} />
            <button
              type="button"
              onClick={function() { onChange('⭐'); }}
              title="Remove image"
              style={{ position: 'absolute', top: -6, right: -6, width: 16, height: 16, borderRadius: '50%', background: '#ff5555', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
            >
              ✕
            </button>
          </div>
        )}

        <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFile} />
      </div>
      {err && <p style={{ fontSize: 11, color: '#f87171', margin: '4px 0 0' }}>{err}</p>}
      <p style={{ fontSize: 10, color: '#4a4a5a', margin: '4px 0 0' }}>
        Images are cropped to a square and resized to 32×32px automatically.
      </p>
    </div>
  );
}

function ActivityRow({ act, users, onEdit, onDelete }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', borderRadius: 9, border: '0.5px solid #2e2e36', background: '#222228' }}>
      <ActivityIcon icon={act.icon} size={18} />
      <div style={{ width: 9, height: 9, borderRadius: '50%', background: act.color, flexShrink: 0 }} />
      <span style={{ fontSize: 13, flex: 1, color: '#e8e9f3', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {act.name}
      </span>
      {act.createdBy && (
        <span style={{ fontSize: 10, color: '#4a4a5a', flexShrink: 0 }}>
          @{users[act.createdBy]?.username ?? '?'}
        </span>
      )}
      <button onClick={function() { onEdit(act); }} style={{ padding: '4px 8px', borderRadius: 7, border: '0.5px solid #3a3a42', background: '#28282f', color: '#b0b0bc', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center' }}>
        <i className="ti ti-settings" style={{ fontSize: 12 }} aria-hidden="true" />
      </button>
      <button onClick={function() { onDelete(act.id); }} style={{ padding: '4px 8px', borderRadius: 7, border: '0.5px solid #ff5555', background: 'transparent', color: '#ff7070', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center' }}>
        <i className="ti ti-trash" style={{ fontSize: 12 }} aria-hidden="true" />
      </button>
    </div>
  );
}

function EditForm({ act, onSave, onCancel }) {
  var [draft, setDraft] = useState({ ...act });

  return (
    <div style={{ background: '#111116', border: '0.5px solid #3a3a42', borderRadius: 10, padding: '14px 16px' }}>
      <p style={{ margin: '0 0 12px', fontSize: 10, fontWeight: 600, color: '#a5b4fc', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
        Editing
      </p>

      <div style={{ marginBottom: 12 }}>
        <IconPicker value={draft.icon} onChange={function(v) { setDraft(function(d) { return { ...d, icon: v }; }); }} />
      </div>

      <div style={{ marginBottom: 12 }}>
        <p style={{ fontSize: 11, color: '#6b6b7a', margin: '0 0 4px' }}>Name</p>
        <input
          value={draft.name}
          onChange={function(e) { setDraft(function(d) { return { ...d, name: e.target.value }; }); }}
          placeholder="Activity name"
          style={DARK_INPUT}
          onKeyDown={function(e) { if (e.key === 'Enter') onSave(draft); }}
        />
      </div>

      <p style={{ fontSize: 11, color: '#6b6b7a', margin: '0 0 8px' }}>Colour</p>
      <div style={{ marginBottom: 14 }}>
        <ColorPicker value={draft.color} onChange={function(c) { setDraft(function(d) { return { ...d, color: c }; }); }} />
      </div>

      {/* Preview */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 8, background: draft.color + '22', border: '0.5px solid ' + draft.color + '55', marginBottom: 14 }}>
        <ActivityIcon icon={draft.icon} size={18} />
        <span style={{ fontSize: 13, color: '#e8e9f3', flex: 1 }}>{draft.name || 'Unnamed'}</span>
        <span style={{ fontSize: 10, color: '#6b6b7a' }}>preview</span>
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={function() { onSave(draft); }} style={{ flex: 1, padding: '8px', borderRadius: 8, border: '0.5px solid #6366f155', background: '#6366f122', color: '#a5b4fc', cursor: 'pointer', fontWeight: 600, fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
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
  var [editing,     setEditing]     = useState(null);
  var [newActName,  setNewActName]  = useState('');
  var [newActIcon,  setNewActIcon]  = useState('⭐');
  var [newActColor, setNewActColor] = useState(ACTIVITY_COLORS[0]);

  function handleAdd() {
    if (!newActName.trim()) return;
    onAdd({ id: uid(), name: newActName.trim(), icon: newActIcon, color: newActColor });
    setNewActName(''); setNewActIcon('⭐'); setNewActColor(ACTIVITY_COLORS[0]);
  }

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 800, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(3px)' }} />

      <div className="scroll-thin" style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 460, maxHeight: '82vh', overflowY: 'auto', background: '#1a1a1f', border: '0.5px solid #3a3a42', borderRadius: 14, zIndex: 900, display: 'flex', flexDirection: 'column', boxShadow: '0 24px 64px rgba(0,0,0,0.7)' }}>

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
            {activities.map(function(act) {
              return (
                <div key={act.id}>
                  {editing && editing.id === act.id ? (
                    <EditForm
                      act={editing}
                      onSave={function(updated) { onUpdate(updated); setEditing(null); }}
                      onCancel={function() { setEditing(null); }}
                    />
                  ) : (
                    <ActivityRow
                      act={act}
                      users={users}
                      onEdit={function(a) { setEditing({ ...a }); }}
                      onDelete={onDelete}
                    />
                  )}
                </div>
              );
            })}
          </div>

          <hr style={{ border: 'none', borderTop: '0.5px solid #2e2e36', margin: '16px 0' }} />

          <p style={{ fontSize: 10, fontWeight: 600, color: '#6b6b7a', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 10px' }}>
            Add new activity
          </p>

          <div style={{ marginBottom: 12 }}>
            <IconPicker value={newActIcon} onChange={setNewActIcon} />
          </div>

          <div style={{ marginBottom: 12 }}>
            <p style={{ fontSize: 11, color: '#6b6b7a', margin: '0 0 4px' }}>Name</p>
            <input
              value={newActName} onChange={function(e) { setNewActName(e.target.value); }}
              placeholder="e.g. Bowling night" style={DARK_INPUT}
              onKeyDown={function(e) { if (e.key === 'Enter') handleAdd(); }}
            />
          </div>

          <p style={{ fontSize: 11, color: '#6b6b7a', margin: '0 0 8px' }}>Colour</p>
          <div style={{ marginBottom: 14 }}>
            <ColorPicker value={newActColor} onChange={setNewActColor} />
          </div>

          {/* Preview */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 8, background: newActColor + '22', border: '0.5px solid ' + newActColor + '55', marginBottom: 14 }}>
            <ActivityIcon icon={newActIcon} size={18} />
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
