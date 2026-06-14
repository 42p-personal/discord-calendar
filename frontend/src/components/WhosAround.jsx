import { useState, useEffect } from 'react';
import { api } from '../api.js';

// Weekday labels (0=Sun). Displayed Mon→Sun.
const DAY_LABEL = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
const BUCKETS = [
  { key: 'morn', label: 'Morning', hint: '6–12' },
  { key: 'aft',  label: 'Afternoon', hint: '12–5' },
  { key: 'eve',  label: 'Evening', hint: '5–9' },
  { key: 'late', label: 'Late', hint: '9–late' },
];

function slotKey(day, bucket) { return day + '-' + bucket; }

export default function WhosAround({ currentUser, T, darkMode, onClose }) {
  const myId = currentUser.userId || currentUser.id;
  const myName = currentUser.name || currentUser.username || 'You';

  const [rows,    setRows]    = useState([]);
  const [mine,    setMine]    = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);

  useEffect(function() {
    api.availability.list()
      .then(function(data) {
        setRows(data || []);
        var me = (data || []).find(function(r) { return r.userId === myId; });
        setMine(new Set(me ? me.slots : []));
      })
      .catch(function() {})
      .finally(function() { setLoading(false); });
  }, []);

  // Everyone's availability with my (possibly unsaved) selection merged in,
  // so counts update instantly as I toggle.
  var others = rows.filter(function(r) { return r.userId !== myId; });
  var effective = others.concat([{ userId: myId, userName: myName + ' (you)', slots: [].concat([...mine]) }]);
  var people = effective.filter(function(r) { return r.slots && r.slots.length > 0; });
  var maxCount = people.length;

  function countFor(key) {
    return effective.reduce(function(n, r) { return n + (r.slots.indexOf(key) !== -1 ? 1 : 0); }, 0);
  }
  function namesFor(key) {
    return effective.filter(function(r) { return r.slots.indexOf(key) !== -1; }).map(function(r) { return r.userName; });
  }

  function toggle(key) {
    var next = new Set(mine);
    if (next.has(key)) next.delete(key); else next.add(key);
    setMine(next);
    var arr = [...next];
    setSaving(true);
    api.availability.save(arr)
      .then(function() {
        setRows(function(rs) {
          return rs.filter(function(r) { return r.userId !== myId; })
                   .concat([{ userId: myId, userName: myName, slots: arr }]);
        });
      })
      .catch(function() {})
      .finally(function() { setSaving(false); });
  }

  // Best overlap across the week (top slots with the most people)
  var best = null;
  if (maxCount > 0) {
    DAY_ORDER.forEach(function(d) {
      BUCKETS.forEach(function(b) {
        var k = slotKey(d, b.key);
        var c = countFor(k);
        if (c >= 2 && (!best || c > best.count)) best = { day: d, bucket: b, count: c };
      });
    });
  }

  function cellBg(c) {
    if (c === 0) return 'transparent';
    var ratio = maxCount > 0 ? c / maxCount : 0;
    return '#6366f1' + Math.round(20 + ratio * 70).toString(16).padStart(2, '0');
  }

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)', zIndex: 1100 }} />
      <div style={{
        position: 'fixed', left: '50%', top: '50%', transform: 'translate(-50%,-50%)',
        width: 'min(560px, calc(100vw - 24px))', maxHeight: 'calc(100dvh - 48px)', overflowY: 'auto',
        background: darkMode ? '#16171f' : '#fff', border: '0.5px solid ' + T.borderMd,
        borderRadius: 18, zIndex: 1101, boxShadow: T.shadow, padding: '20px',
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 4 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: T.text }}>Who's Around</h2>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: T.textSub }}>Tap the times you're usually free to play.</p>
          </div>
          <button onClick={onClose} aria-label="Close"
            style={{ background: 'transparent', border: 'none', color: T.textSub, cursor: 'pointer', fontSize: 20, lineHeight: 1, padding: 4 }}>✕</button>
        </div>

        {best && (
          <div style={{ margin: '14px 0', padding: '10px 14px', borderRadius: 10, background: T.bgAccent, border: '0.5px solid ' + T.accent, display: 'flex', alignItems: 'center', gap: 8 }}>
            <i className="ti ti-sparkles" style={{ color: T.accentTxt }} />
            <span style={{ fontSize: 13, color: T.accentTxt, fontWeight: 600 }}>
              Best overlap: {DAY_LABEL[best.day]} {best.bucket.label.toLowerCase()} — {best.count} around
            </span>
          </div>
        )}

        {loading ? (
          <div style={{ padding: '50px 0', textAlign: 'center', color: T.textSub }}>
            <i className="ti ti-loader" style={{ fontSize: 22, animation: 'spin 1s linear infinite' }} />
          </div>
        ) : (
          <div style={{ marginTop: 14, overflowX: 'auto' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '46px repeat(4, 1fr)', gap: 6, minWidth: 360 }}>
              {/* Header row */}
              <div />
              {BUCKETS.map(function(b) {
                return (
                  <div key={b.key} style={{ textAlign: 'center', paddingBottom: 4 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: T.text }}>{b.label}</div>
                    <div style={{ fontSize: 9, color: T.textMute }}>{b.hint}</div>
                  </div>
                );
              })}

              {/* One row per day */}
              {DAY_ORDER.map(function(d) {
                return [
                  <div key={'lbl-' + d} style={{ display: 'flex', alignItems: 'center', fontSize: 12, fontWeight: 700, color: T.textSub }}>
                    {DAY_LABEL[d]}
                  </div>
                ].concat(BUCKETS.map(function(b) {
                  var k     = slotKey(d, b.key);
                  var c     = countFor(k);
                  var meIn  = mine.has(k);
                  return (
                    <button key={k} onClick={function() { toggle(k); }}
                      title={c > 0 ? namesFor(k).join(', ') : 'No one yet'}
                      style={{
                        height: 44, borderRadius: 9, cursor: 'pointer',
                        border: '1px solid ' + (meIn ? T.accent : T.border),
                        background: cellBg(c),
                        color: c > 0 ? (darkMode ? '#fff' : '#1a1b22') : T.textMute,
                        fontSize: 13, fontWeight: 700, position: 'relative',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'background 0.15s, border-color 0.15s',
                      }}>
                      {c > 0 ? c : ''}
                      {meIn && <span style={{ position: 'absolute', top: 3, right: 5, fontSize: 8, color: T.accentTxt, fontWeight: 800 }}>✓</span>}
                    </button>
                  );
                }));
              })}
            </div>
          </div>
        )}

        <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 11, color: T.textMute }}>
            {people.length} {people.length === 1 ? 'person has' : 'people have'} shared · {saving ? 'saving…' : 'saved'}
          </span>
          <button onClick={onClose}
            style={{ padding: '8px 18px', borderRadius: 9, border: 'none', background: T.accent, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            Done
          </button>
        </div>
      </div>
    </>
  );
}
