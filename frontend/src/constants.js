export const DEFAULT_ACTIVITIES = [
  { id: 'a1', name: 'Dinner out',  color: '#e76f51', icon: '🍽️', createdBy: null },
  { id: 'a2', name: 'Movie night', color: '#457b9d', icon: '🎬', createdBy: null },
  { id: 'a3', name: 'Hiking',      color: '#2a9d8f', icon: '🥾', createdBy: null },
  { id: 'a4', name: 'Board games', color: '#8338ec', icon: '🎲', createdBy: null },
  { id: 'a5', name: 'Coffee',      color: '#0ea5e9', icon: '☕', createdBy: null },
  { id: 'a6', name: 'Sports',      color: '#f4a261', icon: '⚽', createdBy: null },
];

export const ACTIVITY_COLORS = [
  '#e76f51', '#457b9d', '#2a9d8f', '#8338ec',
  '#0ea5e9', '#f4a261', '#e63946', '#06d6a0',
  '#eb459e', '#ffd166',
];

export const MONTHS = [
  'January', 'February', 'March',     'April',
  'May',     'June',     'July',      'August',
  'September','October', 'November',  'December',
];

export const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Returns the indigo-based theme token set for light or dark mode. */
export function buildTheme(dark) {
  return dark ? {
    bg:       '#111318',
    bgCard:   '#1a1b22',
    bgHover:  '#22232c',
    bgAccent: '#6366f122',
    border:   '#2a2b36',
    borderMd: '#363748',
    text:     '#e8e9f3',
    textSub:  '#8b8ca8',
    textMute: '#52536a',
    accent:   '#6366f1',
    accentTxt:'#a5b4fc',
    today:    '#6366f118',
    todayTxt: '#a5b4fc',
    dragOver: '#6366f128',
    shadow:   '0 12px 40px rgba(0,0,0,0.55)',
  } : {
    bg:       '#f4f5fb',
    bgCard:   '#ffffff',
    bgHover:  '#eef0f8',
    bgAccent: '#6366f10e',
    border:   '#e4e5f0',
    borderMd: '#c8c9de',
    text:     '#1a1b2e',
    textSub:  '#5f6080',
    textMute: '#9899b8',
    accent:   '#6366f1',
    accentTxt:'#4338ca',
    today:    '#6366f112',
    todayTxt: '#4338ca',
    dragOver: '#6366f118',
    shadow:   '0 8px 32px rgba(99,102,241,0.12)',
  };
}

/** Generates a random 8-char hex ID (client-side only — server generates real IDs). */
export const uid = () => Math.random().toString(36).slice(2, 10);

export const pad2 = (n) => String(n).padStart(2, '0');

export function isoDate(y, m, d) {
  return `${y}-${pad2(m + 1)}-${pad2(d)}`;
}

export function getMonthMeta(year, month) {
  return {
    firstDay:    new Date(year, month, 1).getDay(),
    daysInMonth: new Date(year, month + 1, 0).getDate(),
  };
}
