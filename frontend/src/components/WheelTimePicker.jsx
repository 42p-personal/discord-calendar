import { useState, useRef, useEffect } from 'react';

const ITEM_H  = 44;
const HOURS   = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

function pad(n) { return String(n).padStart(2, '0'); }

function DrumColumn({ items, selected, onSelect, bg, accent, ink }) {
  const ref      = useRef(null);
  const timerRef = useRef(null);
  const init     = useRef(false);

  useEffect(() => {
    const idx = items.indexOf(selected);
    if (ref.current && idx >= 0) {
      ref.current.scrollTop = idx * ITEM_H;
    }
    init.current = true;
  }, []);

  function handleScroll() {
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(function() {
      if (!ref.current) return;
      var idx     = Math.round(ref.current.scrollTop / ITEM_H);
      var clamped = Math.max(0, Math.min(items.length - 1, idx));
      if (items[clamped] !== selected) onSelect(items[clamped]);
    }, 80);
  }

  return (
    <div style={{ position: 'relative', width: 58, height: ITEM_H * 5, flexShrink: 0 }}>
      <style>{`.dcol-scroll::-webkit-scrollbar{display:none}`}</style>
      {/* Centre highlight band */}
      <div style={{
        position: 'absolute', top: ITEM_H * 2, height: ITEM_H,
        left: 0, right: 0, zIndex: 1, pointerEvents: 'none',
        background: accent + '1a',
        borderTop: '1px solid ' + accent + '55',
        borderBottom: '1px solid ' + accent + '55',
        borderRadius: 8,
      }} />
      {/* Fade top */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: ITEM_H * 2,
        background: 'linear-gradient(to bottom,' + bg + ',' + bg + 'bb,transparent)',
        pointerEvents: 'none', zIndex: 2,
      }} />
      {/* Fade bottom */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, height: ITEM_H * 2,
        background: 'linear-gradient(to top,' + bg + ',' + bg + 'bb,transparent)',
        pointerEvents: 'none', zIndex: 2,
      }} />
      {/* Scrollable drum */}
      <div ref={ref} className="dcol-scroll" onScroll={handleScroll}
        style={{
          height: '100%', overflowY: 'scroll',
          scrollSnapType: 'y mandatory',
          scrollbarWidth: 'none',
        }}>
        <div style={{ height: ITEM_H * 2 }} />
        {items.map(function(item) {
          var active = item === selected;
          return (
            <div key={item} style={{
              height: ITEM_H,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              scrollSnapAlign: 'center',
              fontSize: 22, fontVariantNumeric: 'tabular-nums',
              fontWeight: active ? 700 : 400,
              color: active ? accent : ink,
              userSelect: 'none',
              cursor: 'default',
            }}>
              {pad(item)}
            </div>
          );
        })}
        <div style={{ height: ITEM_H * 2 }} />
      </div>
    </div>
  );
}

/**
 * TimeWheelPicker
 *
 * Props:
 *   value      — "HH:MM" string or null (default 19:00)
 *   onChange   — called with "HH:MM" whenever selection changes
 *   bg         — background colour (for fade gradients)
 *   accent     — highlight / selected colour
 *   ink        — unselected item text colour
 */
export function TimeWheelPicker({ value, onChange, bg = '#1a1b22', accent = '#6366f1', ink = '#8b8ca8' }) {
  var defaultH = value ? parseInt(value.split(':')[0]) : 19;
  var defaultM = value ? Math.round(parseInt(value.split(':')[1]) / 5) * 5 % 60 : 0;
  var [h, setH] = useState(defaultH);
  var [m, setM] = useState(defaultM);

  function setHour(newH) { setH(newH); onChange(pad(newH) + ':' + pad(m)); }
  function setMin(newM)  { setM(newM); onChange(pad(h)    + ':' + pad(newM)); }

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
      <DrumColumn items={HOURS}   selected={h} onSelect={setHour} bg={bg} accent={accent} ink={ink} />
      <span style={{ fontSize: 24, fontWeight: 700, color: ink, lineHeight: 1, flexShrink: 0, paddingBottom: 2 }}>:</span>
      <DrumColumn items={MINUTES} selected={m} onSelect={setMin}  bg={bg} accent={accent} ink={ink} />
    </div>
  );
}
