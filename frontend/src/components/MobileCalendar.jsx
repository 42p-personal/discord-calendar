import { useState, useEffect, useCallback } from 'react';
import { api } from '../api.js';
import { MONTHS, DAYS, isoDate, getMonthMeta, uid } from '../constants.js';
import { ActivityIcon } from './ActivityManager.jsx';
import { TimeWheelPicker } from './WheelTimePicker.jsx';

/* ---- design tokens (Aria look) injected once ---- */
(function injectAria() {
  if (typeof document === 'undefined' || document.getElementById('aria-mob-css')) return;
  const s = document.createElement('style');
  s.id = 'aria-mob-css';
  s.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Inter+Tight:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap');
    .aria-mob {
      --accent:    #5865f2;
      --accent-dk: #4049c8;
      --accent-tint: #eef0ff;
      --ring:      rgba(88,101,242,0.20);
      --paper:     #ffffff;
      --sunken:    #f7f8fa;
      --ink:       #1b1d22;
      --ink2:      #3a3d46;
      --dim:       #6b6f7b;
      --mute:      #9b9fab;
      --faint:     #c2c5cf;
      --line:      #e9eaef;
      --line-soft: #f0f1f4;
      --sh1:       0 1px 2px rgba(20,22,30,.04),0 1px 3px rgba(20,22,30,.03);
      --sh2:       0 2px 8px rgba(20,22,30,.07),0 8px 28px -8px rgba(20,22,30,.10);
      --r-sm: 9px; --r: 13px; --r-lg: 18px;
      height: 100%; display: flex; flex-direction: column;
      background: var(--paper); color: var(--ink);
      font-family: 'Inter Tight', system-ui, -apple-system, sans-serif;
      -webkit-font-smoothing: antialiased;
      overflow: hidden;
    }
    .aria-mob.dark {
      --paper: #111318; --sunken: #1a1b22; --ink: #e8e9f3; --ink2: #b0b1c8;
      --dim: #8b8ca8; --mute: #52536a; --line: #2a2b36; --line-soft: #22232c;
      --accent: #6366f1; --accent-dk: #a5b4fc; --accent-tint: #6366f118;
    }
    .aria-mob * { box-sizing: border-box; }
    .aria-mob button { font: inherit; color: inherit; border: none; background: none; cursor: pointer; }

    /* scrollbar */
    .aria-scroll { overflow-x: auto; scrollbar-width: none; }
    .aria-scroll::-webkit-scrollbar { display: none; }
    .aria-vscroll { overflow-y: auto; }
    .aria-vscroll::-webkit-scrollbar { width: 0; }

    /* header */
    .aria-hdr { flex: none; padding: 6px 20px 10px; display: flex; align-items: flex-end; gap: 12px; }
    .aria-hdr .big { font-weight: 700; font-size: 28px; letter-spacing: -0.022em; line-height: 1.06; }
    .aria-hdr .yr  { color: var(--mute); font-weight: 500; }

    /* body */
    .aria-body { flex: 1; overflow-y: auto; }

    /* tab bar */
    .aria-tab { flex: none; display: flex; align-items: center; justify-content: space-around;
      height: 64px; padding: 6px 18px 4px; border-top: 1px solid var(--line);
      background: color-mix(in srgb, var(--paper) 90%, transparent);
      backdrop-filter: blur(14px); }
    .aria-tab .ti  { display: flex; flex-direction: column; align-items: center; gap: 3px;
      color: var(--mute); font-size: 10px; font-weight: 600; padding: 4px 8px; border-radius: 10px; }
    .aria-tab .ti.on { color: var(--accent); }
    .aria-tab .fab { width: 50px; height: 50px; border-radius: 16px; background: var(--accent); color: #fff;
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 8px 20px -6px var(--ring), 0 2px 6px rgba(0,0,0,.12);
      margin-top: -16px; font-size: 24px; }

    /* mini month */
    .aria-mm { display: grid; grid-template-columns: repeat(7,1fr); gap: 2px; padding: 0 14px; }
    .aria-mm .wd  { text-align: center; font-size: 10px; font-weight: 700; letter-spacing: .06em;
      text-transform: uppercase; color: var(--mute); padding-bottom: 6px; }
    .aria-mm .day { aspect-ratio: 1/1.05; display: flex; flex-direction: column; align-items: center;
      justify-content: center; gap: 3px; border-radius: 12px; font-size: 14px; font-weight: 600;
      color: var(--ink2); position: relative; cursor: pointer; }
    .aria-mm .day.out   { color: var(--faint); pointer-events: none; }
    .aria-mm .day.today { background: var(--accent); color: #fff; font-weight: 700; }
    .aria-mm .day.sel   { background: var(--accent-tint); color: var(--accent-dk); font-weight: 700; }
    .aria-mm .day .dots { display: flex; gap: 2px; height: 5px; }
    .aria-mm .day .dots i { width: 5px; height: 5px; border-radius: 99px; display: block; }
    .aria-mm .day.today .dots i { box-shadow: 0 0 0 1px rgba(255,255,255,.5); }

    /* agenda card */
    .agcard { display: flex; align-items: center; gap: 12px; padding: 13px 14px;
      border-radius: var(--r-lg); background: var(--paper);
      box-shadow: inset 0 0 0 1px var(--line), var(--sh1); cursor: pointer; }
    .agcard:active { opacity: 0.85; }
    .ag-sec { font-size: 11px; font-weight: 700; letter-spacing: .10em; text-transform: uppercase;
      color: var(--mute); padding: 0 2px 8px; }

    /* propose */
    .actcard { width: 118px; flex: none; border-radius: var(--r-lg); padding: 14px;
      box-shadow: inset 0 0 0 1px var(--line); background: var(--paper);
      display: flex; flex-direction: column; gap: 10px; cursor: pointer; }
    .actcard.on { box-shadow: inset 0 0 0 2px var(--accent); background: var(--accent-tint); }
    .actcard .sw { width: 38px; height: 38px; border-radius: 11px; display: flex;
      align-items: center; justify-content: center; font-size: 20px; }

    /* day strip */
    .daystrip { width: 56px; flex: none; border-radius: 14px; padding: 10px 0; text-align: center;
      background: var(--paper); box-shadow: inset 0 0 0 1px var(--line);
      color: var(--ink2); cursor: pointer; }
    .daystrip.on { background: var(--accent); box-shadow: none; color: #fff; }
    .daystrip .ds-dow { font-size: 11px; font-weight: 700; opacity: 0.7; }
    .daystrip .ds-d   { font-size: 20px; font-weight: 700; margin-top: 3px; }
    .daystrip .ds-t   { font-size: 9px; font-weight: 700; margin-top: 2px; opacity: 0.8; }

    /* time chip */
    .tchip { height: 38px; padding: 0 16px; border-radius: 99px; font-size: 14px; font-weight: 700;
      color: var(--dim); box-shadow: inset 0 0 0 1px var(--line); background: var(--paper); flex: none; }
    .tchip.on { background: var(--accent); color: #fff; box-shadow: none; }

    /* CTA bar */
    .aria-cta { flex: none; padding: 12px 16px 8px; border-top: 1px solid var(--line); display: flex; gap: 10px; }
    .btn-primary { background: var(--accent); color: #fff; border-radius: 14px; font-size: 15px;
      font-weight: 700; height: 48px; display: flex; align-items: center; justify-content: center;
      gap: 8px; flex: 1; }
    .btn-ghost { background: var(--paper); color: var(--ink2); border-radius: 14px; font-size: 14px;
      font-weight: 600; height: 48px; width: 44px; flex: none;
      box-shadow: inset 0 0 0 1px var(--line); display: flex; align-items: center; justify-content: center; }

    /* event detail overlay */
    .ev-detail { position: fixed; inset: 0; z-index: 2000; display: flex; flex-direction: column;
      background: var(--paper); }
    .ev-band { flex: none; padding: 8px 18px 16px; }
    .seg-rsvp { display: grid; grid-template-columns: repeat(3,1fr); gap: 6px; padding: 5px;
      border-radius: 14px; background: var(--sunken); box-shadow: inset 0 0 0 1px var(--line); }
    .seg-rsvp button { height: 42px; border-radius: 10px; font-weight: 700; font-size: 13.5px;
      color: var(--dim); display: flex; align-items: center; justify-content: center; gap: 6px; }
    .seg-rsvp button.on-in  { background: #3aa55c; color: #fff; box-shadow: var(--sh1); }
    .seg-rsvp button.on-maybe { background: #d8a32a; color: #fff; box-shadow: var(--sh1); }
    .seg-rsvp button.on-cant  { background: #e0566d; color: #fff; box-shadow: var(--sh1); }
  `;
  document.head.appendChild(s);
})();

function fmtTime(t) {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const ap = h >= 12 ? 'pm' : 'am';
  const hh = h % 12 || 12;
  return m ? `${hh}:${String(m).padStart(2,'0')}${ap}` : `${hh}${ap}`;
}

function todayIso() {
  const d = new Date();
  return isoDate(d.getFullYear(), d.getMonth(), d.getDate());
}

/* ---- SVG icon helpers ---- */
const Ico = {
  cal:    () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4.5" width="18" height="17" rx="2.5"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4"/></svg>,
  list:   () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></svg>,
  sparkle:() => <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l1.9 5.6L19.5 9.5 13.9 11.4 12 17l-1.9-5.6L4.5 9.5 10.1 7.6 12 2z"/></svg>,
  users:  () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  chevL:  () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>,
  chevR:  () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6"/></svg>,
  mic:    () => <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="2" width="6" height="11" rx="3"/><path d="M5 10a7 7 0 0 0 14 0M12 17v4"/></svg>,
  check:  () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 13l4 4L19 6"/></svg>,
};

/* ---- Tab bar ---- */
function TabBar({ tab, setTab }) {
  const item = (key, icon, label) => (
    <div key={key} className={`ti ${tab === key ? 'on' : ''}`} onClick={() => setTab(key)} style={{ cursor: 'pointer' }}>
      {icon()}<span>{label}</span>
    </div>
  );
  return (
    <div className="aria-tab">
      {item('cal', Ico.cal, 'Calendar')}
      {item('agenda', Ico.list, 'Agenda')}
      <div className="fab" onClick={() => setTab('propose')}>＋</div>
      {item('free', Ico.sparkle, 'Free')}
      {item('squad', Ico.users, 'Squad')}
    </div>
  );
}

/* ---- Mini month grid ---- */
function MiniMonth({ viewYear, viewMonth, events, selectedDate, onSelectDate, onPrevMonth, onNextMonth }) {
  const { firstDay, daysInMonth } = getMonthMeta(viewYear, viewMonth);
  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const todayD = new Date();
  const isCurrentMonth = todayD.getFullYear() === viewYear && todayD.getMonth() === viewMonth;

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', padding: '0 14px 8px', gap: 8 }}>
        <button onClick={onPrevMonth} style={{ color: 'var(--dim)', padding: '4px', borderRadius: 8, display:'flex' }}>{Ico.chevL()}</button>
        <span style={{ flex: 1, textAlign: 'center', fontWeight: 700, fontSize: 16, letterSpacing: '-0.01em' }}>
          {MONTHS[viewMonth]} <span style={{ color: 'var(--mute)', fontWeight: 500 }}>{viewYear}</span>
        </span>
        <button onClick={onNextMonth} style={{ color: 'var(--dim)', padding: '4px', borderRadius: 8, display:'flex' }}>{Ico.chevR()}</button>
      </div>
      <div className="aria-mm">
        {DAYS.map(d => <div key={d} className="wd">{d[0]}</div>)}
        {cells.map((dayNum, i) => {
          if (!dayNum) return <div key={i} className="day out" />;
          const dk = isoDate(viewYear, viewMonth, dayNum);
          const dayEvs = events[dk] || [];
          const isToday = isCurrentMonth && dayNum === todayD.getDate();
          const isSel = dk === selectedDate && !isToday;
          return (
            <div key={i} className={`day ${isToday ? 'today' : ''} ${isSel ? 'sel' : ''}`} onClick={() => onSelectDate(dk)}>
              <span>{dayNum}</span>
              <span className="dots">
                {dayEvs.slice(0, 3).map((ev, ei) => (
                  <i key={ei} style={{ background: isToday ? 'rgba(255,255,255,0.7)' : ev.activityColor }} />
                ))}
              </span>
            </div>
          );
        })}
      </div>
    </>
  );
}

/* ---- Agenda list ---- */
function AgendaList({ events, selectedDate, onOpenEvent }) {
  const today = todayIso();

  // collect all events from today onwards, sorted by date
  const allEvents = [];
  Object.entries(events).forEach(([dk, evts]) => {
    if (dk >= today) evts.forEach(ev => allEvents.push({ ...ev, _dk: dk }));
  });
  allEvents.sort((a, b) => a._dk.localeCompare(b._dk) || (a.startTime || '').localeCompare(b.startTime || ''));

  // if a date is selected, filter to that date
  const filtered = selectedDate && selectedDate >= today
    ? allEvents.filter(ev => ev._dk === selectedDate)
    : allEvents;

  if (filtered.length === 0) {
    return (
      <div style={{ padding: '28px 20px', textAlign: 'center', color: 'var(--mute)', fontSize: 13 }}>
        {selectedDate ? 'No events on this day.' : 'No upcoming events.'}
      </div>
    );
  }

  let lastSection = null;
  return (
    <div style={{ padding: '0 16px 24px', display: 'flex', flexDirection: 'column', gap: 8 }}>
      {filtered.map((ev, i) => {
        const section = ev._dk === today ? 'Today' : ev._dk;
        const showSection = section !== lastSection;
        lastSection = section;
        return (
          <div key={ev.id}>
            {showSection && (
              <div className="ag-sec" style={{ paddingTop: i > 0 ? 12 : 0 }}>
                {section === 'Today' ? 'Today' : (() => {
                  const d = new Date(ev._dk + 'T00:00:00');
                  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
                })()}
              </div>
            )}
            <div className="agcard" onClick={() => onOpenEvent(ev)}>
              <div style={{ width: 42, height: 42, borderRadius: 12, background: ev.activityColor, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none', fontSize: 18 }}>
                <ActivityIcon icon={ev.activityIcon} size={22} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-0.01em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.activityName}</div>
                <div style={{ fontSize: 12.5, color: 'var(--dim)', fontWeight: 600, marginTop: 2 }}>
                  {ev.startTime ? fmtTime(ev.startTime) : 'All day'}
                  {ev.endTime ? ` – ${fmtTime(ev.endTime)}` : ''}
                </div>
              </div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--mute)', flex: 'none' }}>
                {ev.attendees.length} going
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ---- MonthAgenda screen ---- */
function MonthAgendaScreen({ events, viewYear, viewMonth, setViewYear, setViewMonth, onOpenEvent, darkMode, currentUser, onToggleDark, onSignOut }) {
  const [selectedDate, setSelectedDate] = useState(null);

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  }

  return (
    <>
      <div className="aria-hdr">
        <div>
          <div className="big" style={{ whiteSpace: 'nowrap' }}>Calendar</div>
        </div>
        <div style={{ flex: 1 }} />
        <button onClick={onToggleDark} style={{ color: 'var(--mute)', padding: 6, borderRadius: 10, display: 'flex', fontSize: 18 }}>
          {darkMode ? '☀️' : '🌙'}
        </button>
        <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--accent)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700 }}>
          {(currentUser.name || currentUser.username || '?')[0].toUpperCase()}
        </div>
      </div>
      <div className="aria-body aria-vscroll">
        <MiniMonth
          viewYear={viewYear} viewMonth={viewMonth}
          events={events}
          selectedDate={selectedDate}
          onSelectDate={dk => setSelectedDate(prev => prev === dk ? null : dk)}
          onPrevMonth={prevMonth}
          onNextMonth={nextMonth}
        />
        <div style={{ height: 1, background: 'var(--line)', margin: '10px 20px 14px' }} />
        <AgendaList events={events} selectedDate={selectedDate} onOpenEvent={onOpenEvent} />
      </div>
    </>
  );
}

/* ---- Propose screen ---- */
function ProposeScreen({ activities, onPropose, setTab }) {
  const today = new Date();
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    return { d, dk: isoDate(d.getFullYear(), d.getMonth(), d.getDate()), isToday: i === 0 };
  });

  const [activity, setActivity] = useState(activities[0] || null);
  const [day, setDay] = useState(days[0]);
  const [time, setTime] = useState('20:00');
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!activity || !day) return;
    setBusy(true);
    try {
      await onPropose(activity, day.dk, time);
      setTab('cal');
    } finally {
      setBusy(false);
    }
  }

  const dowLabel = (d) => ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d.getDay()];

  return (
    <>
      <div className="aria-hdr" style={{ paddingTop: 8 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.10em', textTransform: 'uppercase', color: 'var(--accent)' }}>Propose a night</div>
          <div style={{ fontWeight: 700, fontSize: 22, marginTop: 4, letterSpacing: '-0.02em' }}>What are we playing?</div>
        </div>
        <div style={{ flex: 1 }} />
        <button onClick={() => setTab('cal')} style={{ color: 'var(--mute)', fontSize: 22, padding: 4 }}>✕</button>
      </div>

      <div className="aria-body aria-vscroll">
        {/* Activity picker */}
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.10em', textTransform: 'uppercase', color: 'var(--mute)', padding: '8px 18px 6px' }}>
          Activity
        </div>
        <div className="aria-scroll" style={{ display: 'flex', gap: 10, padding: '0 16px 4px' }}>
          {activities.map(act => (
            <div key={act.id} className={`actcard ${act.id === activity?.id ? 'on' : ''}`} onClick={() => setActivity(act)}>
              <div className="sw" style={{ background: act.color + '22' }}>
                <ActivityIcon icon={act.icon} size={22} />
              </div>
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 700, letterSpacing: '-0.01em', lineHeight: 1.2 }}>{act.name}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Day strip */}
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.10em', textTransform: 'uppercase', color: 'var(--mute)', padding: '16px 18px 6px' }}>
          Which day
        </div>
        <div className="aria-scroll" style={{ display: 'flex', gap: 8, padding: '0 16px 4px' }}>
          {days.map(dd => (
            <div key={dd.dk} className={`daystrip ${dd.dk === day?.dk ? 'on' : ''}`} onClick={() => setDay(dd)}>
              <div className="ds-dow">{dowLabel(dd.d)}</div>
              <div className="ds-d">{dd.d.getDate()}</div>
              {dd.isToday && <div className="ds-t">TODAY</div>}
            </div>
          ))}
        </div>

        {/* Time wheel */}
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.10em', textTransform: 'uppercase', color: 'var(--mute)', padding: '16px 18px 6px' }}>
          Start time
        </div>
        <div style={{ padding: '0 16px 16px' }}>
          <TimeWheelPicker value={time} onChange={setTime}
            bg="var(--paper)" accent="var(--accent)" ink="var(--mute)" />
        </div>
      </div>

      <div className="aria-cta">
        <button className="btn-primary" onClick={submit} disabled={!activity || !day || busy} style={{ opacity: (!activity || !day) ? 0.5 : 1 }}>
          {busy ? 'Proposing…' : `Propose ${activity?.name || ''}`.trim()}
        </button>
      </div>
    </>
  );
}

/* ---- Event detail overlay ---- */
function EventDetailOverlay({ ev, currentUser, onClose, onAttendeesChange }) {
  const [attendees, setAttendees] = useState(ev.attendees || []);
  const [busy, setBusy] = useState(false);
  const myId = currentUser.userId || currentUser.id;
  const isAttending = attendees.some(a => a.id === myId);

  async function join() {
    setBusy(true);
    try {
      const res = await api.events.join(ev.id);
      setAttendees(res.attendees);
      onAttendeesChange(ev.id, res.attendees);
    } catch (err) { console.error(err); }
    finally { setBusy(false); }
  }

  async function leave() {
    setBusy(true);
    try {
      const res = await api.events.leave(ev.id);
      setAttendees(res.attendees);
      onAttendeesChange(ev.id, res.attendees);
    } catch (err) { console.error(err); }
    finally { setBusy(false); }
  }

  const dateLabel = (() => {
    const d = new Date(ev.date + 'T00:00:00');
    return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
  })();

  const isGameEvent = ev.proposedByUsername === 'game-release';

  return (
    <div className="ev-detail aria-mob">
      {/* Colour band header */}
      <div className="ev-band" style={{ background: ev.activityColor + '18', borderBottom: `1px solid ${ev.activityColor}33` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, paddingTop: 4 }}>
          <button onClick={onClose} style={{ background: 'var(--paper)', borderRadius: 10, width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'inset 0 0 0 1px var(--line)', color: 'var(--ink2)' }}>
            {Ico.chevL()}
          </button>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, height: 28, padding: '0 11px', borderRadius: 99, background: 'var(--paper)', boxShadow: 'inset 0 0 0 1px var(--line)' }}>
            <span style={{ width: 8, height: 8, borderRadius: 99, background: ev.activityColor }} />
            <span style={{ fontSize: 12.5, fontWeight: 700, color: ev.activityColor }}>{ev.activityName}</span>
          </div>
        </div>
        <div style={{ fontWeight: 700, fontSize: 24, letterSpacing: '-0.022em', lineHeight: 1.1, marginBottom: 10 }}>{ev.activityName}</div>
        <div style={{ display: 'flex', gap: 14, color: 'var(--ink2)', fontSize: 13, fontWeight: 600 }}>
          <span>📅 {dateLabel}</span>
        </div>
        {(ev.startTime || ev.endTime) && (
          <div style={{ marginTop: 6, color: 'var(--ink2)', fontSize: 13, fontWeight: 600 }}>
            🕐 {fmtTime(ev.startTime)}{ev.endTime ? ` – ${fmtTime(ev.endTime)}` : ''}
          </div>
        )}
        <div style={{ marginTop: 6, color: 'var(--ink2)', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span>{isGameEvent ? '🎮 Added from 42p Games' : `👤 Proposed by ${ev.proposedByName || ev.proposedByUsername}`}</span>
          {isGameEvent && ev.steamUrl && (
            <a href={ev.steamUrl} target="_blank" rel="noopener noreferrer"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 9px', borderRadius: 7, background: '#1b2838', border: '0.5px solid #4c6b8a', textDecoration: 'none', flexShrink: 0 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="#c7d5e0">
                <path d="M11.979 0C5.678 0 .511 4.86.022 11.037l6.432 2.658c.545-.371 1.203-.59 1.912-.59.063 0 .125.004.188.006l2.861-4.142V8.91c0-2.495 2.028-4.524 4.524-4.524 2.494 0 4.524 2.031 4.524 4.527s-2.03 4.525-4.524 4.525h-.105l-4.076 2.911c0 .052.004.105.004.159 0 1.875-1.515 3.396-3.39 3.396-1.635 0-3.016-1.173-3.331-2.727L.436 15.27C1.862 20.307 6.486 24 11.979 24c6.624 0 11.998-5.375 11.998-12S18.603 0 11.979 0zM7.54 18.21l-1.473-.61c.262.543.714.999 1.314 1.25 1.297.539 2.793-.076 3.332-1.375.263-.63.264-1.319.005-1.949s-.75-1.121-1.377-1.383c-.624-.26-1.29-.249-1.878-.03l1.523.63c.956.4 1.409 1.5 1.009 2.455-.397.957-1.497 1.41-2.455 1.012H7.54zm11.415-9.303c0-1.662-1.353-3.015-3.015-3.015-1.665 0-3.015 1.353-3.015 3.015 0 1.665 1.35 3.015 3.015 3.015 1.662 0 3.015-1.35 3.015-3.015zm-5.273-.005c0-1.252 1.013-2.266 2.265-2.266 1.249 0 2.266 1.014 2.266 2.266 0 1.251-1.017 2.265-2.266 2.265-1.252 0-2.265-1.014-2.265-2.265z"/>
              </svg>
              <span style={{ fontSize: 11, fontWeight: 600, color: '#c7d5e0' }}>Steam</span>
            </a>
          )}
        </div>
      </div>

      <div className="aria-vscroll" style={{ flex: 1, padding: '16px 16px 8px' }}>
        {/* RSVP segmented */}
        <div className="seg-rsvp">
          <button className={isAttending ? 'on-in' : ''} onClick={isAttending ? leave : join} disabled={busy}>
            {Ico.check()} {isAttending ? 'Going ✓' : 'In'}
          </button>
          <button disabled style={{ opacity: 0.5 }}>Maybe</button>
          <button onClick={isAttending ? leave : undefined} disabled={busy || !isAttending}>
            Can't
          </button>
        </div>

        {/* Attendees */}
        <div style={{ marginTop: 22 }}>
          <div className="ag-sec">Going · {attendees.length}</div>
          {attendees.length === 0 && (
            <div style={{ fontSize: 13, color: 'var(--mute)', padding: '4px 2px' }}>No one yet — be the first!</div>
          )}
          {attendees.map(a => (
            <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 13 }}>
              <div style={{ width: 34, height: 34, borderRadius: '50%', background: a.id === myId ? 'var(--accent)' : 'var(--sunken)', color: a.id === myId ? '#fff' : 'var(--dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, boxShadow: 'inset 0 0 0 1px var(--line)' }}>
                {(a.name || '?')[0].toUpperCase()}
              </div>
              <div>
                <div style={{ fontSize: 14.5, fontWeight: 700 }}>{a.name}{a.id === myId && <span style={{ fontSize: 11, color: 'var(--accent)', marginLeft: 7, fontWeight: 700 }}>you</span>}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="aria-cta">
        {isAttending ? (
          <button className="btn-primary" onClick={leave} disabled={busy} style={{ background: 'var(--mute)' }}>
            {busy ? 'Leaving…' : 'Leave event'}
          </button>
        ) : (
          <button className="btn-primary" onClick={join} disabled={busy}>
            {Ico.mic()} {busy ? 'Joining…' : 'Join event'}
          </button>
        )}
      </div>
    </div>
  );
}

/* ---- Free/availability screen (shows upcoming events attendance) ---- */
function FreeScreen({ events }) {
  const today = todayIso();
  const upcoming = [];
  Object.entries(events).forEach(([dk, evts]) => {
    if (dk >= today) evts.forEach(ev => upcoming.push({ ...ev, _dk: dk }));
  });
  upcoming.sort((a, b) => a._dk.localeCompare(b._dk));

  return (
    <>
      <div className="aria-hdr" style={{ paddingTop: 8 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.10em', textTransform: 'uppercase', color: 'var(--accent)' }}>Attendance</div>
          <div style={{ fontWeight: 700, fontSize: 26, marginTop: 4, letterSpacing: '-0.02em' }}>Who's going</div>
        </div>
      </div>
      <div className="aria-body aria-vscroll" style={{ padding: '0 16px 24px' }}>
        {upcoming.length === 0 && (
          <div style={{ textAlign: 'center', color: 'var(--mute)', fontSize: 13, padding: 28 }}>No upcoming events.</div>
        )}
        {upcoming.map(ev => {
          const d = new Date(ev._dk + 'T00:00:00');
          const dateStr = d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
          return (
            <div key={ev.id} style={{ marginBottom: 16, padding: 14, borderRadius: 'var(--r-lg)', boxShadow: 'inset 0 0 0 1px var(--line)', background: 'var(--paper)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: ev.activityColor + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flex: 'none' }}>
                  <ActivityIcon icon={ev.activityIcon} size={20} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{ev.activityName}</div>
                  <div style={{ fontSize: 12, color: 'var(--mute)', fontWeight: 600 }}>{dateStr}{ev.startTime ? ` · ${fmtTime(ev.startTime)}` : ''}</div>
                </div>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--mute)' }}>{ev.attendees.length} going</div>
              </div>
              {ev.attendees.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {ev.attendees.map(a => (
                    <div key={a.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, height: 26, padding: '0 10px', borderRadius: 99, background: 'var(--sunken)', fontSize: 12, fontWeight: 600, color: 'var(--ink2)' }}>
                      {(a.name || '?')[0].toUpperCase()} {a.name}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}

/* ---- Squad / profile screen ---- */
function SquadScreen({ currentUser, currentGuild, guilds, onGuildSwitch, onSignOut }) {
  return (
    <>
      <div className="aria-hdr" style={{ paddingTop: 8 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.10em', textTransform: 'uppercase', color: 'var(--accent)' }}>Your account</div>
          <div style={{ fontWeight: 700, fontSize: 26, marginTop: 4, letterSpacing: '-0.02em' }}>Squad</div>
        </div>
      </div>
      <div className="aria-body aria-vscroll" style={{ padding: '0 16px 24px' }}>
        {/* User card */}
        <div style={{ padding: 16, borderRadius: 'var(--r-lg)', background: 'var(--accent-tint)', boxShadow: 'inset 0 0 0 1px var(--ring)', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 46, height: 46, borderRadius: '50%', background: 'var(--accent)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 700 }}>
              {(currentUser.name || currentUser.username || '?')[0].toUpperCase()}
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 16 }}>{currentUser.name}</div>
              <div style={{ fontSize: 12, color: 'var(--mute)', fontWeight: 600 }}>@{currentUser.username}</div>
            </div>
          </div>
        </div>

        {/* Guild / server */}
        {currentGuild && (
          <>
            <div className="ag-sec">Current server</div>
            <div style={{ padding: '10px 14px', borderRadius: 'var(--r)', background: 'var(--paper)', boxShadow: 'inset 0 0 0 1px var(--line)', marginBottom: 12, fontWeight: 600, fontSize: 14 }}>
              {currentGuild.name}
            </div>
          </>
        )}

        {guilds.length > 1 && (
          <>
            <div className="ag-sec" style={{ paddingTop: 8 }}>Switch server</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {guilds.filter(g => g.id !== currentGuild?.id).map(g => (
                <button key={g.id} onClick={() => onGuildSwitch(g)}
                  style={{ textAlign: 'left', padding: '10px 14px', borderRadius: 'var(--r)', background: 'var(--paper)', boxShadow: 'inset 0 0 0 1px var(--line)', fontWeight: 600, fontSize: 14, color: 'var(--ink)' }}>
                  {g.name}
                </button>
              ))}
            </div>
          </>
        )}

        <div style={{ marginTop: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.10em', textTransform: 'uppercase', color: 'var(--mute)', marginBottom: 10 }}>More sites</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <a href="https://games.42p.uk" target="_blank" rel="noopener noreferrer"
              style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 'var(--r)', background: 'var(--paper)', boxShadow: 'inset 0 0 0 1px var(--line)', textDecoration: 'none', color: 'var(--ink)', fontWeight: 600, fontSize: 14 }}>
              🎮 <span>42p Games</span>
            </a>
            <a href="https://votes.42p.uk" target="_blank" rel="noopener noreferrer"
              style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 'var(--r)', background: 'var(--paper)', boxShadow: 'inset 0 0 0 1px var(--line)', textDecoration: 'none', color: 'var(--ink)', fontWeight: 600, fontSize: 14 }}>
              🗳️ <span>42p Votes</span>
            </a>
          </div>
        </div>

        <div style={{ marginTop: 16 }}>
          <button onClick={onSignOut}
            style={{ width: '100%', height: 44, borderRadius: 'var(--r)', background: 'transparent', boxShadow: 'inset 0 0 0 1px var(--line)', color: 'var(--mute)', fontWeight: 600, fontSize: 14 }}>
            Sign out
          </button>
        </div>
      </div>
    </>
  );
}

/* ---- Root mobile component ---- */
export default function MobileCalendar({
  events, activities, currentUser, darkMode,
  viewYear, viewMonth, setViewYear, setViewMonth,
  onPropose, onAttendeesChange,
  onToggleDark, onSignOut,
  currentGuild, guilds, onGuildSwitch,
}) {
  const [tab, setTab] = useState('cal');
  const [detailEvent, setDetailEvent] = useState(null);

  function openEvent(ev) { setDetailEvent(ev); }
  function closeEvent() { setDetailEvent(null); }

  return (
    <div className={`aria-mob${darkMode ? ' dark' : ''}`} style={{ height: '100dvh' }}>
      {tab === 'cal' && (
        <MonthAgendaScreen
          events={events}
          viewYear={viewYear} viewMonth={viewMonth}
          setViewYear={setViewYear} setViewMonth={setViewMonth}
          onOpenEvent={openEvent}
          darkMode={darkMode}
          currentUser={currentUser}
          onToggleDark={onToggleDark}
          onSignOut={onSignOut}
        />
      )}
      {tab === 'agenda' && (
        <>
          <div className="aria-hdr" style={{ paddingTop: 8 }}>
            <div className="big">Agenda</div>
          </div>
          <div className="aria-body">
            <AgendaList events={events} selectedDate={null} onOpenEvent={openEvent} />
          </div>
        </>
      )}
      {tab === 'propose' && (
        <ProposeScreen activities={activities} onPropose={onPropose} setTab={setTab} />
      )}
      {tab === 'free' && (
        <FreeScreen events={events} />
      )}
      {tab === 'squad' && (
        <SquadScreen
          currentUser={currentUser} currentGuild={currentGuild}
          guilds={guilds} onGuildSwitch={onGuildSwitch} onSignOut={onSignOut}
        />
      )}

      <TabBar tab={tab} setTab={setTab} />

      {detailEvent && (
        <EventDetailOverlay
          ev={detailEvent}
          currentUser={currentUser}
          onClose={closeEvent}
          onAttendeesChange={(evId, atts) => {
            onAttendeesChange(evId, atts);
            setDetailEvent(prev => prev?.id === evId ? { ...prev, attendees: atts } : prev);
          }}
        />
      )}
    </div>
  );
}
