import { useState, useEffect, useCallback } from 'react';
import { api } from './api.js';
import { DEFAULT_ACTIVITIES, MONTHS, DAYS, buildTheme, uid, isoDate, getMonthMeta } from './constants.js';
import AuthScreen       from './components/AuthScreen.jsx';
import ActivityManager  from './components/ActivityManager.jsx';
import EventPopover     from './components/EventPopover.jsx';
import TimePickerModal  from './components/TimePickerModal.jsx';

// ─── helper: convert flat events array from API into { dateKey: [events] } ───
function indexEvents(arr) {
  return arr.reduce((map, ev) => {
    const key = ev.date;
    if (!map[key]) map[key] = [];
    map[key].push(ev);
    return map;
  }, {});
}

export default function App() {
  // ── global state ──────────────────────────────────────────────
  const [appState,    setAppState]    = useState('loading'); // loading | auth | calendar
  const [currentUser, setCurrentUser] = useState(null);
  const [users,       setUsers]       = useState({});
  const [events,      setEvents]      = useState({});        // { dateKey: [event] }
  const [activities,  setActivities]  = useState(DEFAULT_ACTIVITIES);

  // ── ui prefs ──────────────────────────────────────────────────
  const [darkMode,  setDarkMode]  = useState(() => localStorage.getItem('theme') === 'dark');
  const [calView,   setCalView]   = useState('month');
  const [viewYear,  setViewYear]  = useState(() => new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(() => new Date().getMonth());
  const [viewDay,   setViewDay]   = useState(() => new Date().getDate());

  // ── drag ──────────────────────────────────────────────────────
  const [dragActivity, setDragActivity] = useState(null);
  const [dragEvent,    setDragEvent]    = useState(null);
  const [draggingFrom, setDraggingFrom] = useState(null);
  const [dragOver,     setDragOver]     = useState(null);

  // ── activity manager ──────────────────────────────────────────
  const [showMgr, setShowMgr] = useState(false);

  // ── event popover ─────────────────────────────────────────────
  const [popover, setPopover] = useState(null);

  // ── time picker modal (shown on activity drop) ────────────────
  const [timePicker, setTimePicker] = useState(null); // { activity, dateKey }

  const today = new Date();
  const T     = buildTheme(darkMode);

  // ── bootstrap: check session then load data ───────────────────
  useEffect(() => {
    (async () => {
      try {
        const user = await api.auth.me();
        setCurrentUser(user);

        const [acts, evts] = await Promise.all([
          api.activities.list(),
          api.events.list(),
        ]);

        setActivities(acts.length ? acts : DEFAULT_ACTIVITIES);
        setEvents(indexEvents(evts));
        setAppState('calendar');
      } catch {
        setAppState('auth');
      }
    })();
  }, []);

  // ── theme persistence ─────────────────────────────────────────
  function toggleDark() {
    const next = !darkMode;
    setDarkMode(next);
    localStorage.setItem('theme', next ? 'dark' : 'light');
  }

  // ── sign out ──────────────────────────────────────────────────
  async function handleSignOut() {
    await api.auth.logout().catch(() => {});
    setCurrentUser(null);
    setAppState('auth');
  }

  // ── drag helpers ──────────────────────────────────────────────
  const startDragActivity = (act) => { setDragActivity(act); setDragEvent(null); setDraggingFrom(null); };
  const startDragEvent    = (ev, dk) => { setDragEvent(ev); setDragActivity(null); setDraggingFrom(dk); };

  async function dropOnDay(dateKey) {
    setDragOver(null);

    if (dragActivity) {
      // Show time picker before saving
      setTimePicker({ activity: dragActivity, dateKey });
      setDragActivity(null); setDragEvent(null); setDraggingFrom(null);
      return;
    }

    if (dragEvent && draggingFrom && draggingFrom !== dateKey) {
      try {
        await api.events.move(dragEvent.id, dateKey);
        setEvents((prev) => {
          const upd  = { ...prev };
          const src  = (upd[draggingFrom] ?? []).filter((e) => e.id !== dragEvent.id);
          if (!src.length) delete upd[draggingFrom]; else upd[draggingFrom] = src;
          upd[dateKey] = [...(upd[dateKey] ?? []), { ...dragEvent, date: dateKey }];
          return upd;
        });
      } catch (err) {
        console.error('Failed to move event:', err.message);
      }
    }

    setDragActivity(null); setDragEvent(null); setDraggingFrom(null);
  }

  // Called when the time picker confirms
  async function handleTimePickerConfirm({ startTime, endTime }) {
    if (!timePicker) return;
    const { activity, dateKey } = timePicker;
    setTimePicker(null);

    const ev = {
      id:                 uid(),
      activityId:         activity.id,
      activityName:       activity.name,
      activityColor:      activity.color,
      activityIcon:       activity.icon,
      date:               dateKey,
      startTime:          startTime || null,
      endTime:            endTime   || null,
      proposedBy:         currentUser.id,
      proposedByName:     currentUser.name,
      proposedByUsername: currentUser.username,
      attendees:          [],
      createdAt:          Date.now(),
    };
    try {
      const saved = await api.events.create(ev);
      setEvents((prev) => ({ ...prev, [dateKey]: [...(prev[dateKey] ?? []), saved] }));
    } catch (err) {
      console.error('Failed to save event:', err.message);
    }
  }

  async function removeEvent(dateKey, evId) {
    try {
      await api.events.remove(evId);
      setEvents((prev) => {
        const upd = { ...prev };
        upd[dateKey] = (upd[dateKey] ?? []).filter((e) => e.id !== evId);
        if (!upd[dateKey].length) delete upd[dateKey];
        return upd;
      });
      setPopover(null);
    } catch (err) {
      console.error('Failed to remove event:', err.message);
    }
  }

  function handleAttendeesChange(evId, newAttendees) {
    setEvents((prev) => {
      const next = {};
      for (const [k, evs] of Object.entries(prev)) {
        next[k] = evs.map(e => e.id === evId ? { ...e, attendees: newAttendees } : e);
      }
      return next;
    });
  }

  // ── activity mutations ────────────────────────────────────────
  async function handleAddActivity(act) {
    try {
      const saved = await api.activities.create({ ...act, createdBy: currentUser.id });
      setActivities((prev) => [...prev, saved]);
    } catch (err) {
      console.error('Failed to add activity:', err.message);
    }
  }

  async function handleUpdateActivity(updated) {
    try {
      await api.activities.update(updated.id, { name: updated.name, icon: updated.icon, color: updated.color });
      setActivities((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
      // Propagate rename/recolour to loaded events in state
      setEvents((prev) => {
        const next = {};
        for (const [k, evs] of Object.entries(prev)) {
          next[k] = evs.map((e) =>
            e.activityId === updated.id
              ? { ...e, activityName: updated.name, activityColor: updated.color, activityIcon: updated.icon }
              : e,
          );
        }
        return next;
      });
    } catch (err) {
      console.error('Failed to update activity:', err.message);
    }
  }

  async function handleDeleteActivity(id) {
    try {
      await api.activities.remove(id);
      setActivities((prev) => prev.filter((a) => a.id !== id));
    } catch (err) {
      console.error('Failed to delete activity:', err.message);
    }
  }

  // ── calendar navigation ───────────────────────────────────────
  function prevPeriod() {
    if (calView === 'month') {
      if (viewMonth === 0) { setViewMonth(11); setViewYear((y) => y - 1); }
      else setViewMonth((m) => m - 1);
    } else if (calView === 'week') {
      const d = new Date(viewYear, viewMonth, viewDay - 7);
      setViewYear(d.getFullYear()); setViewMonth(d.getMonth()); setViewDay(d.getDate());
    } else {
      const d = new Date(viewYear, viewMonth, viewDay - 1);
      setViewYear(d.getFullYear()); setViewMonth(d.getMonth()); setViewDay(d.getDate());
    }
  }

  function nextPeriod() {
    if (calView === 'month') {
      if (viewMonth === 11) { setViewMonth(0); setViewYear((y) => y + 1); }
      else setViewMonth((m) => m + 1);
    } else if (calView === 'week') {
      const d = new Date(viewYear, viewMonth, viewDay + 7);
      setViewYear(d.getFullYear()); setViewMonth(d.getMonth()); setViewDay(d.getDate());
    } else {
      const d = new Date(viewYear, viewMonth, viewDay + 1);
      setViewYear(d.getFullYear()); setViewMonth(d.getMonth()); setViewDay(d.getDate());
    }
  }

  function goToday() {
    setViewYear(today.getFullYear()); setViewMonth(today.getMonth()); setViewDay(today.getDate());
  }

  function periodLabel() {
    if (calView === 'month') return `${MONTHS[viewMonth]} ${viewYear}`;
    if (calView === 'day')   return `${DAYS[new Date(viewYear, viewMonth, viewDay).getDay()]}, ${MONTHS[viewMonth]} ${viewDay} ${viewYear}`;
    const startD = new Date(viewYear, viewMonth, viewDay);
    const mon    = new Date(startD); mon.setDate(startD.getDate() - startD.getDay());
    const sun    = new Date(mon);    sun.setDate(mon.getDate() + 6);
    const fmt    = (d) => `${MONTHS[d.getMonth()].slice(0, 3)} ${d.getDate()}`;
    return `${fmt(mon)} – ${fmt(sun)}, ${sun.getFullYear()}`;
  }

  function weekStart() {
    const d = new Date(viewYear, viewMonth, viewDay);
    d.setDate(d.getDate() - d.getDay());
    return d;
  }

  // ── shared button style ───────────────────────────────────────
  const btn = (extra = {}) => ({
    borderRadius: 8, border: `0.5px solid ${T.borderMd}`, background: 'transparent',
    cursor: 'pointer', color: T.text, fontSize: 13, padding: '6px 12px',
    display: 'inline-flex', alignItems: 'center', gap: 5, lineHeight: 1,
    transition: 'background 0.12s', ...extra,
  });

  // ── event chip renderer (reused in all three views) ───────────
  const EventChip = useCallback(({ ev, dateKey, compact = false }) => (
    <div
      draggable
      onDragStart={() => startDragEvent(ev, dateKey)}
      onClick={(e) => {
        e.stopPropagation();
        const rect = e.currentTarget.getBoundingClientRect();
        setPopover((p) => (p?.ev?.id === ev.id ? null : { ev, rect }));
      }}
      style={{
        display: 'flex', alignItems: 'center', gap: compact ? 3 : 5,
        padding: compact ? '2px 5px' : '5px 8px',
        borderRadius: compact ? 4 : 7,
        background: ev.activityColor + '22',
        border: `0.5px solid ${ev.activityColor}55`,
        cursor: 'pointer', userSelect: 'none',
      }}
    >
      <span style={{ fontSize: compact ? 9 : 13 }}>{ev.activityIcon}</span>
      <span style={{ fontSize: compact ? 9 : 11, color: T.text, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {ev.activityName}
      </span>
    </div>
  ), [T.text]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─────────────────────────────────────────────────────────────
  // LOADING
  // ─────────────────────────────────────────────────────────────
  if (appState === 'loading') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#111318', color: '#8b8ca8', fontSize: 14, gap: 10 }}>
        <i className="ti ti-calendar" style={{ fontSize: 22, color: '#6366f1' }} aria-hidden="true" />
        Loading…
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // AUTH
  // ─────────────────────────────────────────────────────────────
  if (appState === 'auth') {
    return (
      <AuthScreen
        apiUrl={import.meta.env.VITE_API_URL ?? ''}
        onAuthenticated={(user) => {
          setCurrentUser(user);
          // Reload data after sign-in
          Promise.all([api.activities.list(), api.events.list()]).then(([acts, evts]) => {
            setActivities(acts.length ? acts : DEFAULT_ACTIVITIES);
            setEvents(indexEvents(evts));
            setAppState('calendar');
          });
        }}
      />
    );
  }

  // ─────────────────────────────────────────────────────────────
  // CALENDAR
  // ─────────────────────────────────────────────────────────────
  const { firstDay, daysInMonth } = getMonthMeta(viewYear, viewMonth);
  const totalCells = Math.ceil((firstDay + daysInMonth) / 7) * 7;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: T.bg, color: T.text, transition: 'background 0.2s, color 0.2s' }}>
      <h1 className="sr-only">Discord Calendar</h1>

      <style>{`
        .act-cog  { opacity: 0; transition: opacity 0.15s, background 0.15s; }
        .act-chip:hover .act-cog { opacity: 1; }
        .dc-hover:hover { background: ${T.bgHover} !important; }
        .scroll-thin::-webkit-scrollbar { width: 5px; }
        .scroll-thin::-webkit-scrollbar-track { background: ${T.bgCard}; }
        .scroll-thin::-webkit-scrollbar-thumb { background: ${T.borderMd}; border-radius: 99px; }
        .view-btn { padding: 5px 12px; border-radius: 7px; border: 0.5px solid ${T.borderMd}; background: transparent; cursor: pointer; font-size: 12px; color: ${T.textSub}; transition: all 0.12s; }
        .view-btn.active { background: ${T.accent}; border-color: ${T.accent}; color: #fff; font-weight: 600; }
        .view-btn:hover:not(.active) { background: ${T.bgHover}; color: ${T.text}; }
      `}</style>

      {/* ── Top bar ── */}
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', borderBottom: `0.5px solid ${T.border}`, background: T.bgCard, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 2px 8px ${T.accent}44` }}>
            <i className="ti ti-calendar-event" style={{ fontSize: 16, color: '#fff' }} aria-hidden="true" />
          </div>
          <span style={{ fontWeight: 700, fontSize: 15, letterSpacing: '-0.01em' }}>Discord Calendar</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={toggleDark} className="dc-hover" title={darkMode ? 'Light mode' : 'Dark mode'} style={btn({ padding: '6px 10px', color: T.textSub })}>
            <i className={`ti ti-${darkMode ? 'sun' : 'moon'}`} style={{ fontSize: 15 }} aria-hidden="true" />
          </button>

          <div style={{ display: 'flex', gap: 3, background: T.bgHover, borderRadius: 8, padding: 3, border: `0.5px solid ${T.border}` }}>
            {['day', 'week', 'month'].map((v) => (
              <button key={v} className={`view-btn${calView === v ? ' active' : ''}`} onClick={() => setCalView(v)}>
                {v.charAt(0).toUpperCase() + v.slice(1)}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '5px 10px', borderRadius: 8, background: T.bgAccent, border: `0.5px solid ${T.accent}44` }}>
            <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#6366f1', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, flexShrink: 0 }}>
              {currentUser.avatar}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1 }}>
              <span style={{ fontSize: 12, color: T.accentTxt, fontWeight: 600 }}>{currentUser.name}</span>
              <span style={{ fontSize: 10, color: T.textMute }}>@{currentUser.username}</span>
            </div>
          </div>

          <button onClick={handleSignOut} className="dc-hover" style={btn({ fontSize: 12, padding: '5px 10px', color: T.textSub })}>
            Sign out
          </button>
        </div>
      </header>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* ── Sidebar ── */}
        <aside style={{ width: 200, flexShrink: 0, borderRight: `0.5px solid ${T.border}`, padding: '14px 10px', display: 'flex', flexDirection: 'column', gap: 5, overflowY: 'auto', background: T.bgCard }} className="scroll-thin">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: T.textMute, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Activities</span>
            <button onClick={() => setShowMgr(true)} style={btn({ padding: '3px 8px', fontSize: 11, color: T.textSub, gap: 4 })}>
              <i className="ti ti-settings" style={{ fontSize: 12 }} aria-hidden="true" />Manage
            </button>
          </div>

          <p style={{ fontSize: 10, color: T.textMute, marginBottom: 5, lineHeight: 1.4 }}>Drag onto a day to propose</p>

          {activities.map((act) => (
            <div key={act.id} className="act-chip" style={{ display: 'flex', alignItems: 'center', borderRadius: 8, border: `0.5px solid ${act.color}55`, background: act.color + '18', overflow: 'hidden' }}>
              <div
                draggable
                onDragStart={() => startDragActivity(act)}
                style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '7px 9px', flex: 1, cursor: 'grab', userSelect: 'none', minWidth: 0 }}
              >
                <span style={{ fontSize: 14, lineHeight: 1 }}>{act.icon}</span>
                <span style={{ fontSize: 12, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{act.name}</span>
              </div>
              <button
                className="act-cog"
                onClick={() => setShowMgr(true)}
                title={`Configure "${act.name}"`}
                style={{ background: 'transparent', border: 'none', borderLeft: `0.5px solid ${act.color}22`, cursor: 'pointer', color: T.textSub, fontSize: 13, padding: '0 7px', alignSelf: 'stretch', display: 'flex', alignItems: 'center', lineHeight: 1 }}
              >
                <i className="ti ti-settings" aria-hidden="true" />
              </button>
            </div>
          ))}

          {activities.length === 0 && (
            <p style={{ fontSize: 11, color: T.textMute, textAlign: 'center', marginTop: 12 }}>
              No activities.<br />Click Manage to add one.
            </p>
          )}
        </aside>

        {/* ── Activity manager modal ── */}
        {showMgr && (
          <ActivityManager
            activities={activities}
            users={users}
            onAdd={handleAddActivity}
            onUpdate={handleUpdateActivity}
            onDelete={handleDeleteActivity}
            onClose={() => setShowMgr(false)}
          />
        )}

        {/* ── Calendar area ── */}
        <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

          {/* Period nav bar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderBottom: `0.5px solid ${T.border}`, background: T.bgCard, flexShrink: 0 }}>
            <button onClick={prevPeriod} className="dc-hover" style={btn({ padding: '5px 9px' })}>
              <i className="ti ti-chevron-left" aria-hidden="true" />
            </button>
            <span style={{ fontWeight: 600, fontSize: 15, minWidth: 180 }}>{periodLabel()}</span>
            <button onClick={nextPeriod} className="dc-hover" style={btn({ padding: '5px 9px' })}>
              <i className="ti ti-chevron-right" aria-hidden="true" />
            </button>
            <button onClick={goToday} className="dc-hover" style={btn({ fontSize: 12, padding: '5px 10px', marginLeft: 'auto', color: T.textSub })}>
              Today
            </button>
          </div>

          {/* ═══ MONTH VIEW ═══ */}
          {calView === 'month' && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', borderBottom: `0.5px solid ${T.border}`, background: T.bgCard, flexShrink: 0 }}>
                {DAYS.map((d) => (
                  <div key={d} style={{ padding: '8px 0', textAlign: 'center', fontSize: 11, fontWeight: 600, color: T.textMute, letterSpacing: '0.04em' }}>{d}</div>
                ))}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gridTemplateRows: `repeat(${totalCells / 7},minmax(80px,1fr))`, flex: 1, overflowY: 'auto' }} className="scroll-thin">
                {Array.from({ length: totalCells }).map((_, i) => {
                  const dayNum  = i - firstDay + 1;
                  const isValid = dayNum >= 1 && dayNum <= daysInMonth;
                  const dk      = isValid ? isoDate(viewYear, viewMonth, dayNum) : null;
                  const dayEvs  = dk ? (events[dk] ?? []) : [];
                  const isToday = isValid && viewYear === today.getFullYear() && viewMonth === today.getMonth() && dayNum === today.getDate();
                  const isPast  = isValid && new Date(viewYear, viewMonth, dayNum) < new Date(today.getFullYear(), today.getMonth(), today.getDate());
                  const isOver  = dragOver === dk;

                  return (
                    <div
                      key={i}
                      className={isValid ? 'dc-hover' : ''}
                      onClick={() => isValid && setViewDay(dayNum)}
                      onDragOver={isValid ? (e) => { e.preventDefault(); setDragOver(dk); } : undefined}
                      onDragLeave={isValid ? () => setDragOver((d) => d === dk ? null : d) : undefined}
                      onDrop={isValid ? () => dropOnDay(dk) : undefined}
                      style={{
                        borderRight:  (i + 1) % 7 !== 0 ? `0.5px solid ${T.border}` : 'none',
                        borderBottom: `0.5px solid ${T.border}`,
                        padding: '4px 5px',
                        background:   isOver ? T.dragOver : isValid ? (isToday ? T.today : T.bgCard) : `${T.bg}88`,
                        opacity:      isPast && !isToday ? 0.5 : 1,
                        transition:   'background 0.1s',
                        cursor:       isValid ? 'pointer' : 'default',
                      }}
                    >
                      {isValid && (
                        <>
                          <div style={{ marginBottom: 2 }}>
                            {isToday
                              ? <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 20, height: 20, borderRadius: '50%', background: T.accent, color: '#fff', fontSize: 10, fontWeight: 700 }}>{dayNum}</span>
                              : <span style={{ fontSize: 11, color: T.textSub }}>{dayNum}</span>}
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            {dayEvs.map((ev) => <EventChip key={ev.id} ev={ev} dateKey={dk} compact />)}
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* ═══ WEEK VIEW ═══ */}
          {calView === 'week' && (() => {
            const ws       = weekStart();
            const weekDays = Array.from({ length: 7 }, (_, i) => { const d = new Date(ws); d.setDate(ws.getDate() + i); return d; });
            return (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', borderBottom: `0.5px solid ${T.border}`, background: T.bgCard, flexShrink: 0 }}>
                  {weekDays.map((d, i) => {
                    const isTod = d.toDateString() === today.toDateString();
                    return (
                      <div key={i} style={{ padding: '10px 0', textAlign: 'center', borderRight: i < 6 ? `0.5px solid ${T.border}` : 'none' }}>
                        <p style={{ fontSize: 10, fontWeight: 600, color: T.textMute, margin: '0 0 3px', letterSpacing: '0.04em' }}>{DAYS[d.getDay()]}</p>
                        <div style={{ width: 28, height: 28, borderRadius: '50%', margin: '0 auto', background: isTod ? T.accent : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <span style={{ fontSize: 13, fontWeight: isTod ? 700 : 400, color: isTod ? '#fff' : T.text }}>{d.getDate()}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', flex: 1, overflowY: 'auto' }} className="scroll-thin">
                  {weekDays.map((d, i) => {
                    const dk     = isoDate(d.getFullYear(), d.getMonth(), d.getDate());
                    const dayEvs = events[dk] ?? [];
                    const isOver = dragOver === dk;
                    return (
                      <div
                        key={i}
                        className="dc-hover"
                        onDragOver={(e) => { e.preventDefault(); setDragOver(dk); }}
                        onDragLeave={() => setDragOver((dv) => dv === dk ? null : dv)}
                        onDrop={() => dropOnDay(dk)}
                        style={{ borderRight: i < 6 ? `0.5px solid ${T.border}` : 'none', padding: '8px 6px', minHeight: 200, background: isOver ? T.dragOver : T.bgCard, transition: 'background 0.1s' }}
                      >
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          {dayEvs.map((ev) => <EventChip key={ev.id} ev={ev} dateKey={dk} />)}
                          {dayEvs.length === 0 && <p style={{ fontSize: 10, color: T.textMute, textAlign: 'center', marginTop: 16 }}>—</p>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            );
          })()}

          {/* ═══ DAY VIEW ═══ */}
          {calView === 'day' && (() => {
            const dk     = isoDate(viewYear, viewMonth, viewDay);
            const dayEvs = events[dk] ?? [];
            const isOver = dragOver === dk;
            return (
              <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }} className="scroll-thin">
                <div
                  className="dc-hover"
                  onDragOver={(e) => { e.preventDefault(); setDragOver(dk); }}
                  onDragLeave={() => setDragOver(null)}
                  onDrop={() => dropOnDay(dk)}
                  style={{ minHeight: 300, borderRadius: 12, border: `0.5px solid ${isOver ? T.accent : T.border}`, background: isOver ? T.dragOver : T.bgCard, padding: '16px 18px', transition: 'all 0.1s' }}
                >
                  {dayEvs.length === 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 200, gap: 10, color: T.textMute }}>
                      <i className="ti ti-calendar-off" style={{ fontSize: 32 }} aria-hidden="true" />
                      <p style={{ fontSize: 13 }}>No events planned — drag an activity here to propose one</p>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {dayEvs.map((ev) => (
                        <div
                          key={ev.id}
                          draggable
                          onDragStart={() => startDragEvent(ev, dk)}
                          onClick={(e) => { const rect = e.currentTarget.getBoundingClientRect(); setPopover((p) => p?.ev?.id === ev.id ? null : { ev, rect }); }}
                          style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderRadius: 10, background: ev.activityColor + '18', border: `0.5px solid ${ev.activityColor}55`, cursor: 'pointer', userSelect: 'none' }}
                        >
                          <span style={{ fontSize: 24 }}>{ev.activityIcon}</span>
                          <div style={{ flex: 1 }}>
                            <p style={{ fontWeight: 600, fontSize: 14 }}>{ev.activityName}</p>
                            <p style={{ fontSize: 12, color: T.textSub, marginTop: 2 }}>Suggested by {ev.proposedByName} (@{ev.proposedByUsername})</p>
                          </div>
                          <div style={{ width: 8, height: 8, borderRadius: '50%', background: ev.activityColor }} />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

        </main>
      </div>

      {/* ── Event popover ── */}
      {popover && (
        <EventPopover
          popover={popover}
          currentUser={currentUser}
          darkMode={darkMode}
          T={T}
          onClose={() => setPopover(null)}
          onRemove={removeEvent}
          onAttendeesChange={handleAttendeesChange}
        />
      )}

      {/* ── Time picker modal ── */}
      {timePicker && (
        <TimePickerModal
          activity={timePicker.activity}
          dateKey={timePicker.dateKey}
          darkMode={darkMode}
          T={T}
          onConfirm={handleTimePickerConfirm}
          onCancel={() => { setTimePicker(null); setDragActivity(null); setDragEvent(null); setDraggingFrom(null); }}
        />
      )}
    </div>
  );
}
