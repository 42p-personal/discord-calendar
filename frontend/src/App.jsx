import { useState, useEffect } from 'react';
import { api, setGuildId } from './api.js';
import { DEFAULT_ACTIVITIES, MONTHS, DAYS, buildTheme, uid, isoDate, getMonthMeta } from './constants.js';
import AuthScreen       from './components/AuthScreen.jsx';
import ActivityManager, { ActivityIcon } from './components/ActivityManager.jsx';
import EventPopover     from './components/EventPopover.jsx';
import TimePickerModal  from './components/TimePickerModal.jsx';
import GuildPicker      from './components/GuildPicker.jsx';
import GuildSwitcher    from './components/GuildSwitcher.jsx';
import MobileCalendar   from './components/MobileCalendar.jsx';

const GUILD_STORAGE_KEY = 'dc_guild';

function indexEvents(arr) {
  return arr.reduce(function(map, ev) {
    if (!map[ev.date]) map[ev.date] = [];
    map[ev.date].push(ev);
    return map;
  }, {});
}

export default function App() {
  // ── app state ─────────────────────────────────────────────
  // loading | auth | guild-pick | calendar
  var [appState,    setAppState]    = useState('loading');
  var [currentUser, setCurrentUser] = useState(null);

  // ── guild state ───────────────────────────────────────────
  var [guilds,       setGuilds]       = useState([]);
  var [guildsLoading,setGuildsLoading]= useState(false);
  var [guildsError,  setGuildsError]  = useState('');
  var [currentGuild, setCurrentGuild] = useState(null);

  // ── calendar data ─────────────────────────────────────────
  var [events,     setEvents]     = useState({});
  var [activities, setActivities] = useState(DEFAULT_ACTIVITIES);

  // ── ui prefs ──────────────────────────────────────────────
  var [darkMode,  setDarkMode]  = useState(function() { return localStorage.getItem('theme') === 'dark'; });
  var [calView,   setCalView]   = useState('month');
  var [viewYear,  setViewYear]  = useState(function() { return new Date().getFullYear(); });
  var [viewMonth, setViewMonth] = useState(function() { return new Date().getMonth(); });
  var [viewDay,   setViewDay]   = useState(function() { return new Date().getDate(); });

  // ── drag ──────────────────────────────────────────────────
  var [dragActivity, setDragActivity] = useState(null);
  var [dragEvent,    setDragEvent]    = useState(null);
  var [draggingFrom, setDraggingFrom] = useState(null);
  var [dragOver,     setDragOver]     = useState(null);

  // ── activity manager ──────────────────────────────────────
  var [showMgr, setShowMgr] = useState(false);

  // ── time picker ───────────────────────────────────────────
  var [timePicker, setTimePicker] = useState(null);

  // ── event popover ─────────────────────────────────────────
  var [popover, setPopover] = useState(null);

  // ── mobile detection ──────────────────────────────────────
  var [isMobile, setIsMobile] = useState(function() { return window.innerWidth < 768; });
  useEffect(function() {
    function onResize() { setIsMobile(window.innerWidth < 768); }
    window.addEventListener('resize', onResize);
    return function() { window.removeEventListener('resize', onResize); };
  }, []);

  var today = new Date();
  var T     = buildTheme(darkMode);

  // ── auto-refresh ──────────────────────────────────────────
  useEffect(function() {
    if (appState !== 'calendar' || !currentGuild) return;
    var refreshing = false;

    async function refreshEvents() {
      if (document.visibilityState !== 'visible' || refreshing) return;
      refreshing = true;
      try {
        var evts = await api.events.list();
        setEvents(indexEvents(evts));
      } catch (e) { /* silent */ }
      finally { refreshing = false; }
    }

    // Activities change rarely — poll every 5 minutes
    async function refreshActivities() {
      if (document.visibilityState !== 'visible') return;
      try {
        var acts = await api.activities.list();
        if (acts.length) setActivities(acts);
      } catch (e) {}
    }

    var evtInterval = setInterval(refreshEvents, 30000);
    var actInterval = setInterval(refreshActivities, 300000);
    document.addEventListener('visibilitychange', refreshEvents);
    return function() {
      clearInterval(evtInterval);
      clearInterval(actInterval);
      document.removeEventListener('visibilitychange', refreshEvents);
    };
  }, [appState, currentGuild]);

  // ── bootstrap ─────────────────────────────────────────────
  useEffect(function() {
    api.auth.me()
      .then(function(user) {
        setCurrentUser(user);
        // Check for saved guild in localStorage
        var savedGuild = null;
        try { savedGuild = JSON.parse(localStorage.getItem(GUILD_STORAGE_KEY)); } catch (e) {}
        if (savedGuild) {
          selectGuild(savedGuild, user);
        } else {
          loadGuilds();
        }
      })
      .catch(function() { setAppState('auth'); });
  }, []);

  async function loadGuilds() {
    setGuildsLoading(true);
    setGuildsError('');
    setAppState('guild-pick');
    try {
      var g = await api.guilds.list();
      setGuilds(g);
    } catch (err) {
      setGuildsError(err.message || 'Failed to load your servers. Please sign in again.');
    } finally {
      setGuildsLoading(false);
    }
  }

  async function selectGuild(guild, user) {
    setCurrentGuild(guild);
    setGuildId(guild.id);
    localStorage.setItem(GUILD_STORAGE_KEY, JSON.stringify(guild));
    setAppState('calendar');

    // Load guilds list in background for the switcher
    if (guilds.length === 0) {
      api.guilds.list().then(function(g) { setGuilds(g); }).catch(function() {});
    }

    // Load calendar data for this guild
    try {
      var results = await Promise.all([api.activities.list(), api.events.list()]);
      var acts = results[0]; var evts = results[1];
      setActivities(acts.length ? acts : DEFAULT_ACTIVITIES);
      setEvents(indexEvents(evts));
    } catch (err) {
      console.error('Failed to load calendar data:', err.message);
    }
  }

  function handleGuildSwitch(guild) {
    setEvents({});
    setActivities(DEFAULT_ACTIVITIES);
    setPopover(null);
    setTimePicker(null);
    selectGuild(guild, currentUser);
  }

  function toggleDark() {
    var next = !darkMode;
    setDarkMode(next);
    localStorage.setItem('theme', next ? 'dark' : 'light');
  }

  async function handleSignOut() {
    await api.auth.logout().catch(function() {});
    localStorage.removeItem(GUILD_STORAGE_KEY);
    setGuildId(null);
    setCurrentUser(null);
    setCurrentGuild(null);
    setGuilds([]);
    setAppState('auth');
  }

  // ── drag ──────────────────────────────────────────────────
  var startDragActivity = function(act) { setDragActivity(act); setDragEvent(null); setDraggingFrom(null); };
  var startDragEvent    = function(ev, dk) { setDragEvent(ev); setDragActivity(null); setDraggingFrom(dk); };

  async function dropOnDay(dateKey) {
    setDragOver(null);
    if (dragActivity) {
      setTimePicker({ activity: dragActivity, dateKey: dateKey });
      setDragActivity(null); setDragEvent(null); setDraggingFrom(null);
      return;
    }
    if (dragEvent && draggingFrom && draggingFrom !== dateKey) {
      try {
        await api.events.move(dragEvent.id, dateKey);
        setEvents(function(prev) {
          var upd = Object.assign({}, prev);
          var src = (upd[draggingFrom] || []).filter(function(e) { return e.id !== dragEvent.id; });
          if (!src.length) delete upd[draggingFrom]; else upd[draggingFrom] = src;
          upd[dateKey] = (upd[dateKey] || []).concat(Object.assign({}, dragEvent, { date: dateKey }));
          return upd;
        });
      } catch (err) { console.error('Move failed:', err.message); }
    }
    setDragActivity(null); setDragEvent(null); setDraggingFrom(null);
  }

  async function handleTimePickerConfirm(opts) {
    if (!timePicker) return;
    var activity = timePicker.activity; var dateKey = timePicker.dateKey;
    setTimePicker(null);
    var ev = {
      id: uid(), activityId: activity.id, activityName: activity.name,
      activityColor: activity.color, activityIcon: activity.icon,
      date: dateKey, startTime: opts.startTime || null, endTime: opts.endTime || null,
      proposedBy: currentUser.userId, proposedByName: currentUser.name,
      proposedByUsername: currentUser.username, attendees: [], createdAt: Date.now(),
    };
    try {
      var saved = await api.events.create(ev);
      setEvents(function(prev) { return Object.assign({}, prev, { [dateKey]: (prev[dateKey] || []).concat(saved) }); });
    } catch (err) { console.error('Failed to save event:', err.message); }
  }

  async function removeEvent(dateKey, evId) {
    try {
      await api.events.remove(evId);
      setEvents(function(prev) {
        var upd = Object.assign({}, prev);
        upd[dateKey] = (upd[dateKey] || []).filter(function(e) { return e.id !== evId; });
        if (!upd[dateKey].length) delete upd[dateKey];
        return upd;
      });
      setPopover(null);
    } catch (err) { console.error('Remove failed:', err.message); }
  }

  function handleAttendeesChange(evId, newAttendees) {
    setEvents(function(prev) {
      var next = {};
      Object.keys(prev).forEach(function(k) {
        next[k] = prev[k].map(function(e) { return e.id === evId ? Object.assign({}, e, { attendees: newAttendees }) : e; });
      });
      return next;
    });
  }

  // ── activities ────────────────────────────────────────────
  async function handleAddActivity(act) {
    try {
      var saved = await api.activities.create(Object.assign({}, act, { createdBy: currentUser.userId }));
      setActivities(function(prev) { return prev.concat(saved); });
    } catch (err) { console.error('Add activity failed:', err.message); }
  }

  async function handleUpdateActivity(updated) {
    try {
      await api.activities.update(updated.id, { name: updated.name, icon: updated.icon, color: updated.color });
      setActivities(function(prev) { return prev.map(function(a) { return a.id === updated.id ? updated : a; }); });
      setEvents(function(prev) {
        var next = {};
        Object.keys(prev).forEach(function(k) {
          next[k] = prev[k].map(function(e) {
            return e.activityId === updated.id
              ? Object.assign({}, e, { activityName: updated.name, activityColor: updated.color, activityIcon: updated.icon })
              : e;
          });
        });
        return next;
      });
    } catch (err) { console.error('Update activity failed:', err.message); }
  }

  async function handleDeleteActivity(id) {
    try {
      await api.activities.remove(id);
      setActivities(function(prev) { return prev.filter(function(a) { return a.id !== id; }); });
    } catch (err) { console.error('Delete activity failed:', err.message); }
  }

  // ── calendar nav ──────────────────────────────────────────
  function prevPeriod() {
    if (calView === 'month') { if (viewMonth === 0) { setViewMonth(11); setViewYear(function(y) { return y - 1; }); } else setViewMonth(function(m) { return m - 1; }); }
    if (calView === 'week')  { var d = new Date(viewYear, viewMonth, viewDay - 7); setViewYear(d.getFullYear()); setViewMonth(d.getMonth()); setViewDay(d.getDate()); }
    if (calView === 'day')   { var d = new Date(viewYear, viewMonth, viewDay - 1); setViewYear(d.getFullYear()); setViewMonth(d.getMonth()); setViewDay(d.getDate()); }
  }
  function nextPeriod() {
    if (calView === 'month') { if (viewMonth === 11) { setViewMonth(0); setViewYear(function(y) { return y + 1; }); } else setViewMonth(function(m) { return m + 1; }); }
    if (calView === 'week')  { var d = new Date(viewYear, viewMonth, viewDay + 7); setViewYear(d.getFullYear()); setViewMonth(d.getMonth()); setViewDay(d.getDate()); }
    if (calView === 'day')   { var d = new Date(viewYear, viewMonth, viewDay + 1); setViewYear(d.getFullYear()); setViewMonth(d.getMonth()); setViewDay(d.getDate()); }
  }
  function goToday() { setViewYear(today.getFullYear()); setViewMonth(today.getMonth()); setViewDay(today.getDate()); }

  function periodLabel() {
    if (calView === 'month') return MONTHS[viewMonth] + ' ' + viewYear;
    if (calView === 'day')   return DAYS[new Date(viewYear, viewMonth, viewDay).getDay()] + ', ' + MONTHS[viewMonth] + ' ' + viewDay + ' ' + viewYear;
    var startD = new Date(viewYear, viewMonth, viewDay);
    var mon    = new Date(startD); mon.setDate(startD.getDate() - startD.getDay());
    var sun    = new Date(mon);    sun.setDate(mon.getDate() + 6);
    var fmt    = function(d) { return MONTHS[d.getMonth()].slice(0, 3) + ' ' + d.getDate(); };
    return fmt(mon) + ' \u2013 ' + fmt(sun) + ', ' + sun.getFullYear();
  }

  function weekStart() {
    var d = new Date(viewYear, viewMonth, viewDay);
    d.setDate(d.getDate() - d.getDay()); return d;
  }

  var btn = function(extra) {
    return Object.assign({ borderRadius: 8, border: '0.5px solid ' + T.borderMd, background: 'transparent', cursor: 'pointer', color: T.text, fontSize: 13, padding: '6px 12px', display: 'inline-flex', alignItems: 'center', gap: 5, lineHeight: 1, transition: 'background 0.12s' }, extra || {});
  };

  function EventChip(props) {
    var ev = props.ev; var dateKey = props.dateKey; var compact = props.compact || false;
    return (
      <div
        draggable
        onDragStart={function() { startDragEvent(ev, dateKey); }}
        onClick={function(e) {
          e.stopPropagation();
          var rect = e.currentTarget.getBoundingClientRect();
          setPopover(function(p) { return (p && p.ev && p.ev.id === ev.id) ? null : { ev: ev, rect: rect }; });
        }}
        style={{ display: 'flex', alignItems: 'center', gap: compact ? 3 : 5, padding: compact ? '2px 5px' : '5px 8px', borderRadius: compact ? 4 : 7, background: ev.activityColor + '22', border: '0.5px solid ' + ev.activityColor + '55', cursor: 'pointer', userSelect: 'none' }}
      >
        <ActivityIcon icon={ev.activityIcon} size={compact ? 10 : 13} />
        <span style={{ fontSize: compact ? 9 : 11, color: T.text, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.activityName}</span>
      </div>
    );
  }

  // ── SCREENS ───────────────────────────────────────────────

  if (appState === 'loading') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#111318', color: '#8b8ca8', fontSize: 14, gap: 10 }}>
        <i className="ti ti-calendar" style={{ fontSize: 22, color: '#6366f1' }} aria-hidden="true" />
        Loading…
      </div>
    );
  }

  if (appState === 'auth') {
    return (
      <AuthScreen
        apiUrl={import.meta.env.VITE_API_URL ?? ''}
        onAuthenticated={function(user) {
          setCurrentUser(user);
          loadGuilds();
        }}
      />
    );
  }

  if (appState === 'guild-pick') {
    return (
      <GuildPicker
        guilds={guilds}
        loading={guildsLoading}
        error={guildsError}
        currentGuildId={currentGuild ? currentGuild.id : null}
        onSelect={function(guild) { selectGuild(guild, currentUser); }}
      />
    );
  }

  // ── MOBILE ────────────────────────────────────────────────
  if (isMobile) {
    return (
      <MobileCalendar
        events={events}
        activities={activities}
        currentUser={currentUser}
        darkMode={darkMode}
        viewYear={viewYear}
        viewMonth={viewMonth}
        setViewYear={setViewYear}
        setViewMonth={setViewMonth}
        onPropose={async function(activity, dateKey, startTime) {
          var ev = {
            id: uid(), activityId: activity.id, activityName: activity.name,
            activityColor: activity.color, activityIcon: activity.icon,
            date: dateKey, startTime: startTime || null, endTime: null,
            proposedBy: currentUser.userId, proposedByName: currentUser.name,
            proposedByUsername: currentUser.username, attendees: [], createdAt: Date.now(),
          };
          try {
            var saved = await api.events.create(ev);
            setEvents(function(prev) { return Object.assign({}, prev, { [dateKey]: (prev[dateKey] || []).concat(saved) }); });
          } catch (err) { console.error('Failed to save event:', err.message); }
        }}
        onAttendeesChange={handleAttendeesChange}
        onToggleDark={toggleDark}
        onSignOut={handleSignOut}
        currentGuild={currentGuild}
        guilds={guilds}
        onGuildSwitch={handleGuildSwitch}
      />
    );
  }

  // ── CALENDAR ──────────────────────────────────────────────

  var monthMeta   = getMonthMeta(viewYear, viewMonth);
  var firstDay    = monthMeta.firstDay;
  var daysInMonth = monthMeta.daysInMonth;
  var totalCells  = Math.ceil((firstDay + daysInMonth) / 7) * 7;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: T.bg, color: T.text, transition: 'background 0.2s, color 0.2s' }}>
      <h1 className="sr-only">Discord Games Calendar</h1>

      <style>{`
        .act-cog { opacity:0; transition:opacity 0.15s,background 0.15s; }
        .act-chip:hover .act-cog { opacity:1; }
        .dc-hover:hover { background:${T.bgHover} !important; }
        .scroll-thin::-webkit-scrollbar{width:5px;}
        .scroll-thin::-webkit-scrollbar-track{background:${T.bgCard};}
        .scroll-thin::-webkit-scrollbar-thumb{background:${T.borderMd};border-radius:99px;}
        .view-btn{padding:5px 12px;border-radius:7px;border:0.5px solid ${T.borderMd};background:transparent;cursor:pointer;font-size:12px;color:${T.textSub};transition:all 0.12s;}
        .view-btn.active{background:${T.accent};border-color:${T.accent};color:#fff;font-weight:600;}
        .view-btn:hover:not(.active){background:${T.bgHover};color:${T.text};}
        @keyframes spin{from{transform:rotate(0deg);}to{transform:rotate(360deg);}}
        @keyframes pulse-live{0%,100%{opacity:1;box-shadow:0 0 0 0 #16a34a55;}50%{opacity:.7;box-shadow:0 0 0 4px #16a34a00;}}
      `}</style>

      {/* Top bar */}
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', borderBottom: '0.5px solid ' + T.border, background: T.bgCard, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px ' + T.accent + '44' }}>
            <i className="ti ti-calendar-event" style={{ fontSize: 16, color: '#fff' }} aria-hidden="true" />
          </div>
          <span style={{ fontWeight: 700, fontSize: 15, letterSpacing: '-0.01em' }}>Discord Games Calendar</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={toggleDark} className="dc-hover" title={darkMode ? 'Light mode' : 'Dark mode'} style={btn({ padding: '6px 10px', color: T.textSub })}>
            <i className={'ti ti-' + (darkMode ? 'sun' : 'moon')} style={{ fontSize: 15 }} aria-hidden="true" />
          </button>

          <a href="https://games.42p.uk" target="_blank" rel="noopener noreferrer" className="dc-hover"
            style={btn({ padding: '6px 10px', color: T.textSub, textDecoration: 'none' })} title="Upcoming game releases">
            <span style={{ fontSize: 14, lineHeight: 1 }}>🎮</span>
            <span style={{ fontSize: 12 }}>Upcoming Games</span>
          </a>

          <div style={{ display: 'flex', gap: 3, background: T.bgHover, borderRadius: 8, padding: 3, border: '0.5px solid ' + T.border }}>
            {['day', 'week', 'month'].map(function(v) {
              return (
                <button key={v} className={'view-btn' + (calView === v ? ' active' : '')} onClick={function() { setCalView(v); }}>
                  {v.charAt(0).toUpperCase() + v.slice(1)}
                </button>
              );
            })}
          </div>

          {/* Guild switcher */}
          <GuildSwitcher
            currentGuild={currentGuild}
            guilds={guilds}
            onSwitch={handleGuildSwitch}
            T={T}
          />

          <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '5px 10px', borderRadius: 8, background: T.bgAccent, border: '0.5px solid ' + T.accent + '44' }}>
            <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#6366f1', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, flexShrink: 0 }}>
              {currentUser.avatar}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1 }}>
              <span style={{ fontSize: 12, color: T.accentTxt, fontWeight: 600 }}>{currentUser.name}</span>
              <span style={{ fontSize: 10, color: T.textMute }}>@{currentUser.username}</span>
            </div>
          </div>

          <div title="Auto-refreshes every 30 seconds" style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 8px', borderRadius: 8, background: darkMode ? '#16a34a18' : '#f0fdf4', border: '0.5px solid ' + (darkMode ? '#16a34a44' : '#bbf7d0') }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#16a34a', display: 'inline-block', animation: 'pulse-live 2.5s ease-in-out infinite' }} />
            <span style={{ fontSize: 11, fontWeight: 600, color: darkMode ? '#86efac' : '#166534' }}>Live</span>
          </div>

          <button onClick={handleSignOut} className="dc-hover" style={btn({ fontSize: 12, padding: '5px 10px', color: T.textSub })}>
            Sign out
          </button>
        </div>
      </header>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* Sidebar */}
        <aside style={{ width: 200, flexShrink: 0, borderRight: '0.5px solid ' + T.border, padding: '14px 10px', display: 'flex', flexDirection: 'column', gap: 5, overflowY: 'auto', background: T.bgCard }} className="scroll-thin">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: T.textMute, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Activities</span>
            <button onClick={function() { setShowMgr(true); }} style={btn({ padding: '3px 8px', fontSize: 11, color: T.textSub, gap: 4 })}>
              <i className="ti ti-settings" style={{ fontSize: 12 }} aria-hidden="true" />Manage
            </button>
          </div>
          <p style={{ fontSize: 10, color: T.textMute, marginBottom: 5, lineHeight: 1.4 }}>Drag onto a day to propose</p>
          {activities.map(function(act) {
            return (
              <div key={act.id} className="act-chip" style={{ display: 'flex', alignItems: 'center', borderRadius: 8, border: '0.5px solid ' + act.color + '55', background: act.color + '18', overflow: 'hidden' }}>
                <div draggable onDragStart={function() { startDragActivity(act); }}
                  style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '7px 9px', flex: 1, cursor: 'grab', userSelect: 'none', minWidth: 0 }}>
                  <ActivityIcon icon={act.icon} size={16} />
                  <span style={{ fontSize: 12, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{act.name}</span>
                </div>
                <button className="act-cog" onClick={function() { setShowMgr(true); }} title={'Configure "' + act.name + '"'}
                  style={{ background: 'transparent', border: 'none', borderLeft: '0.5px solid ' + act.color + '22', cursor: 'pointer', color: T.textSub, fontSize: 13, padding: '0 7px', alignSelf: 'stretch', display: 'flex', alignItems: 'center', lineHeight: 1 }}>
                  <i className="ti ti-settings" aria-hidden="true" />
                </button>
              </div>
            );
          })}
          {activities.length === 0 && <p style={{ fontSize: 11, color: T.textMute, textAlign: 'center', marginTop: 12 }}>No activities.<br />Click Manage to add one.</p>}
        </aside>

        {/* Activity manager */}
        {showMgr && (
          <ActivityManager
            activities={activities}
            users={{}}
            onAdd={handleAddActivity}
            onUpdate={handleUpdateActivity}
            onDelete={handleDeleteActivity}
            onClose={function() { setShowMgr(false); }}
          />
        )}

        {/* Calendar */}
        <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Nav bar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderBottom: '0.5px solid ' + T.border, background: T.bgCard, flexShrink: 0 }}>
            <button onClick={prevPeriod} className="dc-hover" style={btn({ padding: '5px 9px' })}><i className="ti ti-chevron-left" aria-hidden="true" /></button>
            <span style={{ fontWeight: 600, fontSize: 15, minWidth: 180, color: T.text }}>{periodLabel()}</span>
            <button onClick={nextPeriod} className="dc-hover" style={btn({ padding: '5px 9px' })}><i className="ti ti-chevron-right" aria-hidden="true" /></button>
            <button onClick={goToday} className="dc-hover" style={btn({ fontSize: 12, padding: '5px 10px', marginLeft: 'auto', color: T.textSub })}>Today</button>
          </div>

          {/* MONTH VIEW */}
          {calView === 'month' && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', borderBottom: '0.5px solid ' + T.border, background: T.bgCard, flexShrink: 0 }}>
                {DAYS.map(function(d) { return <div key={d} style={{ padding: '8px 0', textAlign: 'center', fontSize: 11, fontWeight: 600, color: T.textMute, letterSpacing: '0.04em' }}>{d}</div>; })}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gridTemplateRows: 'repeat(' + (totalCells / 7) + ',minmax(80px,1fr))', flex: 1, overflowY: 'auto' }} className="scroll-thin">
                {Array.from({ length: totalCells }).map(function(_, i) {
                  var dayNum  = i - firstDay + 1;
                  var isValid = dayNum >= 1 && dayNum <= daysInMonth;
                  var dk      = isValid ? isoDate(viewYear, viewMonth, dayNum) : null;
                  var dayEvs  = dk ? (events[dk] || []) : [];
                  var isToday = isValid && viewYear === today.getFullYear() && viewMonth === today.getMonth() && dayNum === today.getDate();
                  var isPast  = isValid && new Date(viewYear, viewMonth, dayNum) < new Date(today.getFullYear(), today.getMonth(), today.getDate());
                  var isOver  = dragOver === dk;
                  return (
                    <div key={i} className={isValid ? 'dc-hover' : ''}
                      onClick={function() { if (isValid) setViewDay(dayNum); }}
                      onDragOver={isValid ? function(e) { e.preventDefault(); setDragOver(dk); } : undefined}
                      onDragLeave={isValid ? function() { setDragOver(function(d) { return d === dk ? null : d; }); } : undefined}
                      onDrop={isValid ? function() { dropOnDay(dk); } : undefined}
                      style={{ borderRight: (i + 1) % 7 !== 0 ? '0.5px solid ' + T.border : 'none', borderBottom: '0.5px solid ' + T.border, padding: '4px 5px', background: isOver ? T.dragOver : isValid ? (isToday ? T.today : T.bgCard) : T.bg + '88', opacity: isPast && !isToday ? 0.5 : 1, transition: 'background 0.1s', cursor: isValid ? 'pointer' : 'default' }}>
                      {isValid && (
                        <>
                          <div style={{ marginBottom: 2 }}>
                            {isToday
                              ? <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 20, height: 20, borderRadius: '50%', background: T.accent, color: '#fff', fontSize: 10, fontWeight: 700 }}>{dayNum}</span>
                              : <span style={{ fontSize: 11, color: T.textSub }}>{dayNum}</span>}
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            {dayEvs.map(function(ev) { return <EventChip key={ev.id} ev={ev} dateKey={dk} compact={true} />; })}
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* WEEK VIEW */}
          {calView === 'week' && (function() {
            var ws       = weekStart();
            var weekDays = Array.from({ length: 7 }, function(_, i) { var d = new Date(ws); d.setDate(ws.getDate() + i); return d; });
            return (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', borderBottom: '0.5px solid ' + T.border, background: T.bgCard, flexShrink: 0 }}>
                  {weekDays.map(function(d, i) {
                    var isTod = d.toDateString() === today.toDateString();
                    return (
                      <div key={i} style={{ padding: '10px 0', textAlign: 'center', borderRight: i < 6 ? '0.5px solid ' + T.border : 'none' }}>
                        <p style={{ fontSize: 10, fontWeight: 600, color: T.textMute, margin: '0 0 3px', letterSpacing: '0.04em' }}>{DAYS[d.getDay()]}</p>
                        <div style={{ width: 28, height: 28, borderRadius: '50%', margin: '0 auto', background: isTod ? T.accent : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <span style={{ fontSize: 13, fontWeight: isTod ? 700 : 400, color: isTod ? '#fff' : T.text }}>{d.getDate()}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', flex: 1, overflowY: 'auto' }} className="scroll-thin">
                  {weekDays.map(function(d, i) {
                    var dk     = isoDate(d.getFullYear(), d.getMonth(), d.getDate());
                    var dayEvs = events[dk] || [];
                    var isOver = dragOver === dk;
                    return (
                      <div key={i} className="dc-hover"
                        onDragOver={function(e) { e.preventDefault(); setDragOver(dk); }}
                        onDragLeave={function() { setDragOver(function(dv) { return dv === dk ? null : dv; }); }}
                        onDrop={function() { dropOnDay(dk); }}
                        style={{ borderRight: i < 6 ? '0.5px solid ' + T.border : 'none', padding: '8px 6px', minHeight: 200, background: isOver ? T.dragOver : T.bgCard, transition: 'background 0.1s' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          {dayEvs.map(function(ev) { return <EventChip key={ev.id} ev={ev} dateKey={dk} />; })}
                          {dayEvs.length === 0 && <p style={{ fontSize: 10, color: T.textMute, textAlign: 'center', marginTop: 16 }}>—</p>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            );
          })()}

          {/* DAY VIEW */}
          {calView === 'day' && (function() {
            var dk     = isoDate(viewYear, viewMonth, viewDay);
            var dayEvs = events[dk] || [];
            var isOver = dragOver === dk;
            return (
              <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }} className="scroll-thin">
                <div className="dc-hover"
                  onDragOver={function(e) { e.preventDefault(); setDragOver(dk); }}
                  onDragLeave={function() { setDragOver(null); }}
                  onDrop={function() { dropOnDay(dk); }}
                  style={{ minHeight: 300, borderRadius: 12, border: '0.5px solid ' + (isOver ? T.accent : T.border), background: isOver ? T.dragOver : T.bgCard, padding: '16px 18px', transition: 'all 0.1s' }}>
                  {dayEvs.length === 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 200, gap: 10, color: T.textMute }}>
                      <i className="ti ti-calendar-off" style={{ fontSize: 32 }} aria-hidden="true" />
                      <p style={{ fontSize: 13 }}>No events planned — drag an activity here to propose one</p>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {dayEvs.map(function(ev) {
                        return (
                          <div key={ev.id} draggable onDragStart={function() { startDragEvent(ev, dk); }}
                            onClick={function(e) { var rect = e.currentTarget.getBoundingClientRect(); setPopover(function(p) { return (p && p.ev && p.ev.id === ev.id) ? null : { ev: ev, rect: rect }; }); }}
                            style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderRadius: 10, background: ev.activityColor + '18', border: '0.5px solid ' + ev.activityColor + '55', cursor: 'pointer', userSelect: 'none' }}>
                            <ActivityIcon icon={ev.activityIcon} size={24} />
                            <div style={{ flex: 1 }}>
                              <p style={{ fontWeight: 600, fontSize: 14, color: T.text, margin: 0 }}>{ev.activityName}</p>
                              <p style={{ fontSize: 12, color: T.textSub, marginTop: 2 }}>Suggested by {ev.proposedByName} (@{ev.proposedByUsername})</p>
                            </div>
                            <div style={{ width: 8, height: 8, borderRadius: '50%', background: ev.activityColor }} />
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            );
          })()}
        </main>
      </div>

      {/* Event popover */}
      {popover && (
        <EventPopover
          popover={popover}
          currentUser={currentUser}
          darkMode={darkMode}
          T={T}
          onClose={function() { setPopover(null); }}
          onRemove={removeEvent}
          onAttendeesChange={handleAttendeesChange}
        />
      )}

      {/* Time picker */}
      {timePicker && (
        <TimePickerModal
          activity={timePicker.activity}
          dateKey={timePicker.dateKey}
          darkMode={darkMode}
          T={T}
          onConfirm={handleTimePickerConfirm}
          onCancel={function() { setTimePicker(null); }}
        />
      )}
    </div>
  );
}
