'use strict';
// Lift Log: gym workouts logged set by set against a weekly plan, body weight and measurements, and
// YouTube trainer videos stamped at the second each exercise is shown, so form clips open at the right spot.
// Two people use the app on one phone, each with their own data under liftlog.v1.<id>.
// mode 'gym' logs kg × reps; 'bodyweight' starts every exercise as reps-only or timed.
const PEOPLE = [
  { id: 'sagar', name: 'Sagar', mode: 'gym', aim: 'Build muscle' },
  { id: 'madhumita', name: 'Madhumita', mode: 'bodyweight', aim: 'Get fit and toned' },
];
const AIMS = ['Build muscle', 'Lose fat', 'Get fit and toned', 'Get stronger', 'Stay active'];
const PERSON_KEY = 'liftlog.person';
const keyFor = id => `liftlog.v1.${id}`;
// Before profiles existed everything lived under liftlog.v1; that data is Sagar's.
try {
  const old = localStorage.getItem('liftlog.v1');
  if (old && !localStorage.getItem(keyFor('sagar'))) localStorage.setItem(keyFor('sagar'), old);
  if (old) localStorage.removeItem('liftlog.v1');
} catch (e) { /* storage blocked */ }
let person = 'sagar';
try { if (PEOPLE.some(p => p.id === localStorage.getItem(PERSON_KEY))) person = localStorage.getItem(PERSON_KEY); } catch (e) { /* storage blocked */ }
let KEY = keyFor(person);
const me = () => PEOPLE.find(p => p.id === person);
const DAY = 864e5;
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DOW_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];
// Body parts: each exercise has one main target, used for the weekly coverage card.
const GROUPS = ['Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps', 'Forearms', 'Core', 'Quads', 'Hamstrings', 'Glutes', 'Calves', 'Full body', 'Cardio', 'Other'];
const LEVELS = { beg: 'Beginner', int: 'Intermediate', adv: 'Advanced' };
const STARTER_EX = [
  ['Bench press', 'Chest'], ['Incline dumbbell press', 'Chest'], ['Chest fly', 'Chest'], ['Dips', 'Chest'],
  ['Overhead press', 'Shoulders'], ['Lateral raise', 'Shoulders'], ['Face pull', 'Shoulders'], ['Rear delt fly', 'Shoulders'],
  ['Deadlift', 'Back'], ['Barbell row', 'Back'], ['Lat pulldown', 'Back'], ['Pull-up', 'Back'], ['Seated cable row', 'Back'],
  ['Biceps curl', 'Biceps'], ['Hammer curl', 'Biceps'], ['Triceps pushdown', 'Triceps'], ['Skull crusher', 'Triceps'],
  ['Squat', 'Quads'], ['Leg press', 'Quads'], ['Romanian deadlift', 'Hamstrings'], ['Leg curl', 'Hamstrings'], ['Leg extension', 'Quads'],
  ['Calf raise', 'Calves'], ['Hip thrust', 'Glutes'], ['Walking lunge', 'Glutes'],
  ['Plank', 'Core'], ['Hanging leg raise', 'Core'], ['Cable crunch', 'Core'],
];
// The weekly plan Sagar follows: Jeet Selal's 5-day bro split, 3 sets of 6–8 and 10–12 reps.
// [getDay(), workout name, body parts]; Thursday and Sunday are rest days. The days start empty:
// he fills them himself from trainer videos (stamp an exercise → Add to workout).
const BRO_SPLIT = {
  source: 'Jeet Selal · 5-day bro split', target: '3 sets · 6–8 and 10–12 reps',
  days: [
    [1, 'Chest day', ['Chest']],
    [2, 'Leg day', ['Quads', 'Hamstrings', 'Glutes', 'Calves']],
    [3, 'Back day', ['Back']],
    [5, 'Shoulder day', ['Shoulders']],
    [6, 'Arm day', ['Biceps', 'Triceps', 'Forearms']],
  ],
};
// Resets the week to the five empty bro-split days and removes every other workout. Plan ids are reused by name,
// and sessions are untouched, so history and "last time" weights stay.
function applyBroSplit(st) {
  st.week = [null, null, null, null, null, null, null];
  st.plans = BRO_SPLIT.days.map(([dow, name, parts]) => {
    const old = st.plans.find(p => p.name === name);
    const p = { id: old?.id || uid(), name, ex: [], parts, target: BRO_SPLIT.target, source: BRO_SPLIT.source };
    st.week[dow] = p.id;
    return p;
  });
  st.split = 'bro2';
  return st;
}
// Madhumita: home, bodyweight only. [name, body part, kind] where kind 'reps' = reps only, 'time' = seconds held.
const BODYWEIGHT_EX = [
  ['Push-up', 'Chest', 'reps'], ['Knee push-up', 'Chest', 'reps'], ['Incline push-up', 'Chest', 'reps'], ['Chair dip', 'Triceps', 'reps'],
  ['Pike push-up', 'Shoulders', 'reps'], ['Superman', 'Back', 'reps'], ['Reverse snow angel', 'Back', 'reps'],
  ['Bodyweight squat', 'Quads', 'reps'], ['Lunge', 'Quads', 'reps'], ['Step-up', 'Quads', 'reps'], ['Wall sit', 'Quads', 'time'],
  ['Glute bridge', 'Glutes', 'reps'], ['Donkey kick', 'Glutes', 'reps'], ['Fire hydrant', 'Glutes', 'reps'], ['Calf raise', 'Calves', 'reps'],
  ['Plank', 'Core', 'time'], ['Side plank', 'Core', 'time'], ['Crunch', 'Core', 'reps'], ['Bicycle crunch', 'Core', 'reps'], ['Leg raise', 'Core', 'reps'],
  ['Jumping jacks', 'Cardio', 'time'], ['High knees', 'Cardio', 'time'], ['Mountain climber', 'Cardio', 'time'],
  ['Burpee', 'Full body', 'reps'], ['Inchworm', 'Full body', 'reps'],
];
// Her starter week; she can edit it or refill days from her own trainer videos.
const HOME_PLAN = {
  source: 'Home · bodyweight', target: '3 rounds · 12–15 reps or 30–45 s',
  days: [
    [1, 'Full body', ['Bodyweight squat', 'Push-up', 'Glute bridge', 'Plank', 'Jumping jacks']],
    [2, 'Cardio & core', ['Jumping jacks', 'High knees', 'Mountain climber', 'Bicycle crunch', 'Plank']],
    [4, 'Lower body', ['Bodyweight squat', 'Lunge', 'Glute bridge', 'Donkey kick', 'Wall sit', 'Calf raise']],
    [5, 'Upper body & core', ['Knee push-up', 'Chair dip', 'Superman', 'Plank', 'Crunch']],
    [6, 'Full body HIIT', ['Burpee', 'Mountain climber', 'Bodyweight squat', 'High knees', 'Inchworm']],
  ],
};
const MEAS = [['waist', 'Waist'], ['chest', 'Chest'], ['arm', 'Arm'], ['hip', 'Hips'], ['thigh', 'Thigh']];
const SKIP_CHAPTER = /\b(intro|introduction|outro|subscribe|sponsor|conclusion|ending|final thoughts|recap|summary|thanks)\b/i;

const $ = (s, el = document) => el.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Math.random().toString(36).slice(2, 10);
const num = v => { const n = parseFloat(String(v ?? '').replace(',', '.')); return isFinite(n) && n > 0 ? n : null; };
const fmtKg = n => (Math.round(n * 10) / 10).toLocaleString('en-IN');
const fmtVol = kg => kg >= 1000 ? `${(kg / 1000).toFixed(1)} t` : `${Math.round(kg)} kg`;
const e1rm = (w, r) => (w > 0 && r > 0 ? (r === 1 ? w : w * (1 + r / 30)) : 0);
const startOfDay = (d = new Date()) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const isoDay = d => { const x = new Date(d); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; };
const dayMs = iso => new Date(iso + 'T00:00').getTime();
const fmtDate = (d, o = { weekday: 'short', day: 'numeric', month: 'short' }) => new Date(d).toLocaleDateString('en-IN', o);
const clock = sec => {
  sec = Math.max(0, Math.round(sec));
  const h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60), s = sec % 60;
  return (h ? `${h}:${String(m).padStart(2, '0')}` : m) + ':' + String(s).padStart(2, '0');
};
function ago(ts) {
  if (!ts) return 'Not done yet';
  const d = Math.round((startOfDay() - startOfDay(ts)) / DAY);
  return d <= 0 ? 'Done today' : d === 1 ? 'Done yesterday' : `Done ${d} days ago`;
}

let S = load();
let view = 'train', progEx = null, bodyDate = null, vFilter = 'All', vQuery = '';
let installEvt = null, pendingReload = false;

/* ---------- storage ---------- */
function defaults() {
  const p = me();
  const base = {
    ex: [], plans: [], sessions: [], active: null, body: [], videos: [],
    // week[getDay()] = plan id, or null for a rest day
    week: [null, null, null, null, null, null, null],
    settings: { goal: null, aim: p.aim, rest: p.mode === 'gym' ? 90 : 45, wake: true, theme: 'auto', level: 'beg', play: 'inapp', playV: 2 },
  };
  if (p.mode === 'gym') {
    base.ex = STARTER_EX.map(([name, group]) => ({ id: uid(), name, group, kind: group === 'Core' && /plank/i.test(name) ? 'time' : 'weight' }));
    return applyBroSplit(base);
  }
  base.ex = BODYWEIGHT_EX.map(([name, group, kind]) => ({ id: uid(), name, group, kind }));
  const idOf = n => base.ex.find(e => e.name === n).id;
  base.plans = HOME_PLAN.days.map(([dow, name, list]) => {
    const pl = { id: uid(), name, ex: list.map(idOf), target: HOME_PLAN.target, source: HOME_PLAN.source };
    base.week[dow] = pl.id;
    return pl;
  });
  base.split = 'home1';
  return base;
}
function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY));
    if (s && Array.isArray(s.sessions)) {
      const d = defaults(), st = { ...d, ...s, settings: { ...d.settings, ...s.settings } };
      // Play mode v2: videos play inside the app with your YouTube sign-in (earlier versions defaulted to the YouTube app).
      if (s.settings?.playV !== 2) Object.assign(st.settings, { play: 'inapp', playV: 2 });
      // One-time reset of Sagar's week to the empty bro-split days he asked for (2026-11-01).
      if (person === 'sagar' && s.split !== 'bro2') { applyBroSplit(st); try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) { /* saved on next change */ } }
      return st;
    }
  } catch (e) { /* nothing saved yet */ }
  return defaults();
}
// Switch person: save the current one, load the other's data and colours.
function switchPerson(id) {
  if (id === person) { closeSheet(); return; }
  save();
  stopRest(); unwake();
  person = id;
  KEY = keyFor(id);
  try { localStorage.setItem(PERSON_KEY, id); } catch (e) { /* storage blocked */ }
  S = load();
  progEx = null; bodyDate = null; vFilter = 'All'; vQuery = '';
  applyTheme(); closeSheet(); shownView = null; go('train');
  if (S.active) wake();
  buzz([20, 30, 20]);
  toast(`Hi ${me().name} 👋`);
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { toast('Could not save on this phone'); }
}

/* ---------- lookups ---------- */
const exById = id => S.ex.find(e => e.id === id);
const exName = id => exById(id)?.name || 'Exercise';
const planById = id => S.plans.find(p => p.id === id);
const vById = id => S.videos.find(v => v.id === id);
const doneSets = it => it.sets.filter(s => s.done);
const norm = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\b(the|a|an)\b/g, '').replace(/s\b/g, '').replace(/\s+/g, ' ').trim();
const findEx = name => { const n = norm(name); return n ? S.ex.find(e => norm(e.name) === n) || null : null; };
// First guess at the body part for a new exercise name; the user can change it.
const GUESS = [
  [/calf|calves/, 'Calves'], [/hamstring|leg curl|romanian|rdl|good morning|nordic/, 'Hamstrings'],
  [/glute|hip thrust|bridge|kickback|abduct/, 'Glutes'], [/squat|lunge|leg press|leg extension|step.?up|split/, 'Quads'],
  [/tricep|pushdown|skull|dip|close.?grip|overhead extension|kickback/, 'Triceps'], [/curl/, 'Biceps'],
  [/wrist|forearm|grip|farmer/, 'Forearms'],
  [/lateral|shoulder|overhead press|military|arnold|delt|face pull|upright row|shrug/, 'Shoulders'],
  [/row|pulldown|pull.?up|chin.?up|lat\b|deadlift|back ext|pullover/, 'Back'],
  [/bench|chest|fly|flye|crossover|cross.?over|push.?up|pec|incline|decline|press/, 'Chest'],
  [/plank|crunch|sit.?up|ab\b|abs|core|(leg|knee) raise|twist|hollow|dead bug|mountain/, 'Core'],
  [/run|bike|cycle|row(ing)? machine|jump|burpee|skipping|cardio|hiit/, 'Cardio'],
];
const guessGroup = name => (GUESS.find(([re]) => re.test(String(name).toLowerCase())) || [, 'Other'])[1];
// Holds and timed moves log seconds; for a bodyweight person everything else logs reps only.
const guessKind = name => (/plank|hold|wall sit|hang|stretch|pose|jumping jack|high knee|mountain climber|skipping|jog|run/i.test(name) ? 'time'
  : me().mode === 'bodyweight' ? 'reps' : 'weight');
function resolveEx(name) {
  name = String(name || '').trim().replace(/\s+/g, ' ');
  if (!name) return null;
  const hit = findEx(name);
  if (hit) return hit.id;
  const e = { id: uid(), name: name[0].toUpperCase() + name.slice(1), group: guessGroup(name), kind: guessKind(name) };
  S.ex.push(e);
  return e.id;
}
function lastSets(exId, skipId) { return lastTime(exId, skipId)?.sets || []; }
function lastTime(exId, skipId) {
  for (let i = S.sessions.length - 1; i >= 0; i--) {
    const s = S.sessions[i];
    if (s.id === skipId) continue;
    const it = s.items.find(x => x.ex === exId);
    if (it && doneSets(it).length) return { sets: doneSets(it), date: s.start };
  }
  return null;
}
// How an exercise is logged: 'weight' = kg × reps, 'reps' = reps only (bodyweight), 'time' = seconds held.
const kindOf = exId => exById(exId)?.kind || 'weight';
const KINDS = { weight: 'kg × reps', reps: 'Reps only', time: 'Time (seconds)' };
const fmtSet = (kind, s) => (kind === 'time' ? `${s.r} s` : kind === 'reps' ? `${s.r} reps` : `${fmtKg(s.w || 0)} kg × ${s.r}`);
// What a "best" means: estimated 1-rep max for weights, most reps, or longest hold.
const score = (kind, s) => (kind === 'weight' ? e1rm(s.w, s.r) || (s.w ? 0 : s.r / 100) : s.r || 0);
function bestScore(exId, skipId) {
  const k = kindOf(exId);
  let b = 0;
  S.sessions.forEach(s => { if (s.id !== skipId) s.items.forEach(it => { if (it.ex === exId) doneSets(it).forEach(x => { b = Math.max(b, score(k, x)); }); }); });
  return b;
}
function sessionTotals(s) {
  let sets = 0, vol = 0, prs = 0, reps = 0, secs = 0;
  s.items.forEach(it => {
    const k = kindOf(it.ex);
    doneSets(it).forEach(x => {
      sets++; if (x.pr) prs++;
      if (k === 'time') secs += x.r || 0; else if (k === 'reps' || !x.w) reps += x.r || 0; else vol += x.w * (x.r || 0);
    });
  });
  return { sets, vol, prs, reps, secs };
}
// "1.2 t lifted", or for bodyweight work "120 reps · 3:30 held".
const workTxt = t => [t.vol ? `${fmtVol(t.vol)} lifted` : '', t.reps ? `${t.reps} reps` : '', t.secs ? `${clock(t.secs)} held` : ''].filter(Boolean).join(' · ') || '';
const weekStart = (off = 0) => { const d = startOfDay(); return +d - ((d.getDay() + 6) % 7) * DAY - off * 7 * DAY; };
const sessionsOn = iso => S.sessions.filter(s => isoDay(s.start) === iso);
const lastDone = planId => { for (let i = S.sessions.length - 1; i >= 0; i--) if (S.sessions[i].planId === planId) return S.sessions[i].start; return 0; };

/* ---------- YouTube helpers ---------- */
function parseDur(s) {
  if (/^\d+$/.test(s)) return +s;
  const m = String(s).match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/);
  return m ? (+m[1] || 0) * 3600 + (+m[2] || 0) * 60 + (+m[3] || 0) : 0;
}
// Times as typed on a phone keypad: "1:10", "1.10", "1,10", "1 10" or "110" all mean 1 min 10 s;
// "45" means 45 s; "1.02.30" or "10230" means 1 h 2 min 30 s.
function parseClock(s) {
  s = String(s || '').trim().replace(/\s*[.,;\s-]\s*/g, ':');
  if (/^\d+$/.test(s)) {
    if (s.length <= 2) return +s;
    s = s.length <= 4 ? `${s.slice(0, -2)}:${s.slice(-2)}` : `${s.slice(0, -4)}:${s.slice(-4, -2)}:${s.slice(-2)}`;
  }
  if (!/^\d{1,2}(:\d{1,2}){1,2}$/.test(s)) return null;
  const parts = s.split(':').map(Number);
  if (parts.slice(1).some(p => p > 59)) return null;
  return parts.reduce((a, p) => a * 60 + p, 0);
}
// Time boxes: decimal keypad (has a dot), and the typed time is shown back as m:ss when you leave the box.
const timeAttrs = 'inputmode="decimal" autocomplete="off" placeholder="e.g. 1.10"';
document.addEventListener('focusout', e => {
  if (!e.target.matches('#sT, .cT')) return;
  const t = parseClock(e.target.value);
  if (t != null) e.target.value = clock(t);
  e.target.classList.toggle('bad', !!e.target.value.trim() && t == null);
});
function parseYT(s) {
  s = String(s || '').trim();
  let id = null, t = 0;
  try {
    const u = new URL(/^https?:/i.test(s) ? s : 'https://' + s);
    const h = u.hostname.replace(/^(www|m|music)\./, '');
    if (h === 'youtu.be') id = u.pathname.slice(1).split('/')[0];
    else if (h.endsWith('youtube.com') || h.endsWith('youtube-nocookie.com')) {
      id = u.searchParams.get('v');
      if (!id) { const m = u.pathname.match(/\/(?:shorts|embed|live|v)\/([\w-]{11})/); if (m) id = m[1]; }
    }
    const tp = u.searchParams.get('t') || u.searchParams.get('start') || (u.hash.match(/t=(\w+)/) || [])[1];
    if (tp) t = parseDur(tp);
  } catch (e) { /* not a URL */ }
  if (!id && /^[\w-]{11}$/.test(s)) id = s;
  return id && /^[\w-]{11}$/.test(id) ? { id, t } : null;
}
const watchUrl = (yt, t = 0) => `https://www.youtube.com/watch?v=${yt}${t ? `&t=${Math.floor(t)}s` : ''}`;
// Play mode: 'inapp' plays in Lift Log's own YouTube player, which uses your YouTube sign-in in this browser
// (Premium = no ads); 'app' hands every video to the YouTube app instead.
const adFree = () => S.settings.play !== 'inapp';
const YT_SIGNIN = 'https://accounts.google.com/ServiceLogin?service=youtube&continue=https%3A%2F%2Fm.youtube.com%2F';
const isIOS = () => /iPhone|iPad|iPod/i.test(navigator.userAgent);
// Under every in-app player: sign in once with your Premium account, or jump to the YouTube app if an ad shows.
const premiumNote = (yt, t) => `<div class="pnote">
  <span>${isIOS() ? 'iPhone hides your YouTube sign-in from web apps, so ads may play here.' : 'No ads when this phone’s Chrome is signed in to your <b>YouTube Premium</b> account.'}</span>
  <div class="row">${S.settings.ytSigned || isIOS() ? '' : `<a class="btn small" href="${YT_SIGNIN}" target="_blank" rel="noopener" data-act="ytSignin">Sign in to YouTube ↗</a>`}
  <button class="btn ghost small" data-act="ytOpen" data-yt="${yt}" data-t="${t}">Ad? Open in YouTube app</button></div></div>`;
function ytAppUrl(yt, t = 0) {
  const ua = navigator.userAgent, s = Math.floor(t);
  if (/Android/i.test(ua)) return `intent://www.youtube.com/watch?v=${yt}&t=${s}s#Intent;scheme=https;package=com.google.android.youtube;S.browser_fallback_url=${encodeURIComponent(watchUrl(yt, s))};end`;
  if (/iPhone|iPad|iPod/i.test(ua)) return `youtube://www.youtube.com/watch?v=${yt}&t=${s}s`;
  return watchUrl(yt, s);
}
function openYT(yt, t = 0) {
  buzz();
  const url = ytAppUrl(yt, t);
  if (url.startsWith('https:')) window.open(url, '_blank', 'noopener'); else location.href = url;
}
const thumb = yt => `https://i.ytimg.com/vi/${yt}/mqdefault.jpg`;
async function ytInfo(yt) {
  try {
    const r = await fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(watchUrl(yt))}`);
    if (r.ok) return await r.json();
  } catch (e) { /* offline or blocked: user types the title */ }
  return null;
}
const levelIn = s => (/\bbeginners?\b/i.test(s) ? 'beg' : /\bintermediate\b/i.test(s) ? 'int' : /\badvanced?\b/i.test(s) ? 'adv' : '');
// Lines like "1:23 Bench press", "(04:10) - Lateral raise" or "Squats 12:05" from a video description.
// A line with no time that names a level ("Beginner:") applies that level to the lines after it.
function parseChapters(text) {
  const out = [];
  let level = '';
  for (const raw of String(text).split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    if (!/\d:\d\d/.test(line)) { const l = levelIn(line); if (l) level = l; continue; }
    const m = line.match(/[[(]?\b(\d{1,2}(?::\d{2}){1,2})\b[\])]?/);
    if (!m) continue;
    const t = parseClock(m[1]);
    let name = (line.slice(0, m.index) + ' ' + line.slice(m.index + m[0].length)).replace(/\s+/g, ' ')
      .replace(/^[\s\-–—:|.)•]+|[\s\-–—:|.(•]+$/g, '').replace(/^(exercise\s*)?\d+\s*[.):-]\s*/i, '').trim();
    const l = levelIn(name);
    if (l) {
      const rest = name.replace(/\b(beginners?|intermediate|advanced?)\b(\s+(level|version|variation))?/ig, '').replace(/^[\s:–—|()[\]-]+|[\s:–—|()[\]-]+$/g, '');
      if (!rest) { level = l; continue; }
      name = rest;
    }
    if (t == null || !name || SKIP_CHAPTER.test(name)) continue;
    out.push({ t, name, level: l || level });
  }
  return out;
}
// The workout's own clip first, then other trainers' clips for the same exercise, your level first.
function clipsFor(it) {
  const out = [];
  const own = it.stamp && vById(it.stamp.v);
  const ownStamp = own && own.stamps.find(s => s.ex === it.ex && s.t === it.stamp.t);
  if (own) out.push({ v: own, t: it.stamp.t, note: ownStamp?.note, level: ownStamp?.level });
  const rest = [];
  S.videos.forEach(v => v.stamps.forEach(s => {
    if (s.ex === it.ex && !(own && own.id === v.id && s.t === it.stamp.t)) rest.push({ v, t: s.t, note: s.note, level: s.level });
  }));
  const lv = S.settings.level, rank = c => (c.level === lv ? 0 : !c.level ? 1 : 2);
  return out.concat(rest.sort((a, b) => rank(a) - rank(b)));
}
const levelTag = l => (l ? `<span class="tag lv-${l}">${LEVELS[l]}</span>` : '');
const pickStamp = (v, ex, level) => v.stamps.find(s => s.ex === ex && s.level === level) || v.stamps.find(s => s.ex === ex && !s.level) || v.stamps.find(s => s.ex === ex);
const videoExIds = (v, level) => [...new Set([...v.stamps].filter(s => !level || !s.level || s.level === level).sort((a, b) => a.t - b.t).map(s => s.ex))];
const targets = exIds => [...new Set(exIds.map(id => exById(id)?.group).filter(g => g && g !== 'Other'))];
// A workout's body parts: from its exercises, or the parts the day is meant for while it is still empty.
const targetsOf = p => [...new Set([...targets(p.ex), ...(p.ex.length ? [] : p.parts || [])])];
const BP_COLORS = {
  Chest: '#ef4444', Back: '#3b82f6', Shoulders: '#f59e0b', Biceps: '#8b5cf6', Triceps: '#ec4899', Forearms: '#a16207',
  Core: '#14b8a6', Quads: '#22c55e', Hamstrings: '#65a30d', Glutes: '#f97316', Calves: '#06b6d4', 'Full body': '#0ea5e9', Cardio: '#e11d48', Other: '#64748b',
};
const bpChip = g => `<span class="bpchip" style="--c:${BP_COLORS[g] || BP_COLORS.Other}">${esc(g)}</span>`;
const buzz = (ms = 12) => { try { navigator.vibrate?.(ms); } catch (e) { /* no vibration */ } };
let justTicked = null;

// Confetti burst for new bests and finished workouts.
function confetti(n = 90) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const c = document.createElement('canvas');
  c.id = 'confetti';
  document.body.appendChild(c);
  const dpr = devicePixelRatio || 1, W = c.width = innerWidth * dpr, H = c.height = innerHeight * dpr, ctx = c.getContext('2d');
  const cols = ['#3b5bfd', '#7c3aed', '#db2777', '#f97316', '#10b981', '#06b6d4', '#facc15'];
  const ps = Array.from({ length: n }, () => ({
    x: W / 2 + (Math.random() - 0.5) * W * 0.3, y: H * 0.45, vx: (Math.random() - 0.5) * 16 * dpr, vy: (-Math.random() * 16 - 6) * dpr,
    s: (5 + Math.random() * 6) * dpr, r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4, c: cols[Math.floor(Math.random() * cols.length)],
  }));
  const t0 = performance.now();
  (function frame(t) {
    ctx.clearRect(0, 0, W, H);
    ps.forEach(p => {
      p.vy += 0.45 * dpr; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.r += p.vr;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.fillStyle = p.c; ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); ctx.restore();
    });
    if (t - t0 < 2600) requestAnimationFrame(frame); else c.remove();
  })(t0);
}

/* ---------- YouTube player (IFrame API, so the stamp button can read the current second) ---------- */
let ytLoad = null, player = null, nowTimer = 0;
function loadYT() {
  if (window.YT && window.YT.Player) return Promise.resolve();
  if (!ytLoad) {
    ytLoad = new Promise((res, rej) => {
      window.onYouTubeIframeAPIReady = res;
      const s = document.createElement('script');
      s.src = 'https://www.youtube.com/iframe_api';
      s.onerror = () => { ytLoad = null; rej(new Error('offline')); };
      document.head.appendChild(s);
      setTimeout(() => rej(new Error('timeout')), 15000);
    });
  }
  return ytLoad;
}
async function mountPlayer(el, yt, t = 0) {
  killPlayer();
  el.innerHTML = '<div class="vid-off">Loading video…</div>';
  try { await loadYT(); } catch (e) {
    if (el.isConnected) el.innerHTML = `<div class="vid-off">The video needs internet.<br><a href="${watchUrl(yt, t)}" target="_blank" rel="noopener">Open in YouTube</a></div>`;
    return;
  }
  if (!el.isConnected) return;
  const div = document.createElement('div');
  el.replaceChildren(div);
  player = new YT.Player(div, {
    // Standard host (not privacy mode) so a YouTube sign-in in this browser, and its Premium, applies.
    videoId: yt, host: 'https://www.youtube.com',
    playerVars: { start: Math.floor(t), autoplay: 1, playsinline: 1, rel: 0, modestbranding: 1 },
  });
}
// The in-app player with −5 s / +5 s buttons on its edges (outside #vp, which the YouTube player replaces).
const playerBox = () => `<div class="vidwrap"><div class="vid" id="vp"></div>
  <button class="skip l" data-act="nudge" data-d="-5" aria-label="Back 5 seconds">↺ 5s</button>
  <button class="skip r" data-act="nudge" data-d="5" aria-label="Forward 5 seconds">5s ↻</button></div>`;
function killPlayer() {
  clearInterval(nowTimer);
  try { player?.destroy?.(); } catch (e) { /* already gone */ }
  player = null;
}
const playerTime = () => { try { return player?.getCurrentTime?.() || 0; } catch (e) { return 0; } };
function seek(t) { try { player.seekTo(t, true); player.playVideo(); } catch (e) { /* player not ready yet */ } }

/* ---------- views ---------- */
const TITLES = { train: 'Train', videos: 'Videos', history: 'History', progress: 'Progress', body: 'Body' };
const VIEWS = { train: viewTrain, videos: viewVideos, history: viewHistory, progress: viewProgress, body: viewBody };

let shownView = null;
function render() {
  $('#title').textContent = view === 'train' && S.active ? 'Workout' : TITLES[view];
  $('#subtitle').textContent = subtitle();
  const main = $('#main');
  main.innerHTML = VIEWS[view]();
  // Cards slide in only when you switch tabs, not on every tap inside a tab.
  main.classList.toggle('enter', shownView !== view);
  shownView = view;
  document.querySelectorAll('.tabs button').forEach(b => b.classList.toggle('on', b.dataset.view === view));
  requestAnimationFrame(() => requestAnimationFrame(() => {
    main.querySelectorAll('[data-pct]').forEach(c => { c.style.strokeDasharray = `${c.dataset.pct} 100`; });
    main.querySelectorAll('[data-w]').forEach(f => { f.style.width = f.dataset.w + '%'; });
  }));
  justTicked = null;
}
function go(v) {
  view = v;
  history.replaceState(null, '', '#' + v);
  render();
  scrollTo(0, 0);
}
function subtitle() {
  if (view === 'train') {
    return `${me().name} · ${S.settings.aim || me().aim}`;
  }
  if (view === 'videos') { const n = S.videos.reduce((a, v) => a + v.stamps.length, 0); return `${S.videos.length} videos · ${n} exercise stamps`; }
  if (view === 'history') return `${S.sessions.length} workouts logged`;
  if (view === 'body') { const b = [...S.body].reverse().find(x => x.w); return b ? `Last weigh-in ${fmtKg(b.w)} kg on ${fmtDate(dayMs(b.d))}` : 'Weight and measurements'; }
  return 'Strength over time';
}

/* Train: today's plan from the week, the Mon–Sun strip, all plans */
function viewTrain() {
  if (S.active) return viewActive();
  const todayIso = isoDay(Date.now());
  const plan = planById(S.week[new Date().getDay()]);
  const doneToday = sessionsOn(todayIso);
  let hero;
  const top = tag => `<div class="hero-top"><span class="tag">${tag}</span>${weekRing()}</div>`;
  if (doneToday.length) {
    const t = sessionTotals(doneToday[doneToday.length - 1]);
    hero = `<section class="card hero done">${top('✓ Done today')}<h2 class="big">${esc(doneToday[doneToday.length - 1].name)}</h2>
      <p>${[`${t.sets} sets`, workTxt(t), t.prs ? `★ ${t.prs} new best${t.prs === 1 ? "" : "s"}` : ""].filter(Boolean).join(" · ")}</p>
      <button class="btn ghost" data-act="openSession" data-id="${doneToday[doneToday.length - 1].id}">See workout</button></section>`;
  } else if (plan) {
    const v = plan.vid && vById(plan.vid);
    hero = `<section class="card hero">${top(`Today · ${DOW_LONG[new Date().getDay()]}`)}<h2 class="big">${esc(plan.name)}</h2>
      <div class="chiprow">${targetsOf(plan).map(bpChip).join('')}</div>
      ${plan.target ? `<p class="small"><b>🎯 ${esc(plan.target)}</b>${plan.source ? ` · ${esc(plan.source)}` : ''}</p>` : ''}
      ${v ? `<p class="small">▶ ${esc(v.trainer || v.title)}${plan.level ? ` · ${LEVELS[plan.level]}` : ''}</p>` : ''}
      ${plan.ex.length ? `<ol class="exlist">${plan.ex.map(id => `<li>${esc(exName(id))}${hasClip(id, plan) ? ' <span class="clip">▶</span>' : ''}</li>`).join('')}</ol>
      <button class="btn block big-btn" data-act="startPlan" data-id="${plan.id}">Start ${esc(plan.name)} ›</button>`
      : `<p>No exercises yet. Add them from your trainer's video: stamp each exercise and pick <b>${esc(plan.name)}</b>.</p>
      <button class="btn block big-btn" data-act="fillPlan" data-id="${plan.id}">▶ Add exercises from a video</button>`}</section>`;
  } else {
    hero = `<section class="card hero restday">${top(`Today · ${DOW_LONG[new Date().getDay()]}`)}<h2 class="big">Rest day</h2>
      <p>Recover, walk, stretch. Want to train anyway? Pick a workout below.</p></section>`;
  }
  return installCard() + hero + coverage() + `
    <section><div class="head"><h2>All workouts</h2><button class="link" data-act="newPlan">+ New</button></div>
    <div class="plans">${S.plans.map(planCard).join('')}</div>
    <button class="btn ghost block" style="margin-top:10px" data-act="startEmpty">Start an empty workout</button></section>`;
}
// Workouts done this week against the days your weekly plan has a workout.
function weekRing() {
  const planned = S.week.filter(Boolean).length, ws = weekStart();
  const done = new Set(S.sessions.filter(s => s.start >= ws).map(s => isoDay(s.start))).size;
  const pct = planned ? Math.min(100, done / planned * 100) : 0;
  return `<div class="ring-wrap" title="Workouts this week"><svg viewBox="0 0 36 36"><circle class="rt" cx="18" cy="18" r="15.9"/>
    <circle class="rp" cx="18" cy="18" r="15.9" pathLength="100" stroke-dasharray="0 100" data-pct="${pct}"/></svg><b>${done}/${planned}</b><small>This week</small></div>`;
}
const hasClip = (exId, plan) => !!plan.clips?.[exId] || (plan.vid && vById(plan.vid)?.stamps.some(s => s.ex === exId)) || S.videos.some(v => v.stamps.some(s => s.ex === exId));
// Sets done per body part this week, the days your plan trains each one, and the ones it never trains.
function coverage() {
  const ws = weekStart(), done = {}, planned = {};
  S.sessions.forEach(s => { if (s.start >= ws) s.items.forEach(it => { const g = exById(it.ex)?.group; if (g) done[g] = (done[g] || 0) + doneSets(it).length; }); });
  WEEK_ORDER.forEach(d => { const p = planById(S.week[d]); if (p) targetsOf(p).forEach(g => { (planned[g] = planned[g] || []).push(DOW[d]); }); });
  // Only the main muscle groups are flagged when missing; full body and cardio show when you plan or do them.
  const main = GROUPS.filter(g => !['Forearms', 'Full body', 'Cardio', 'Other'].includes(g));
  const missing = main.filter(g => !planned[g] && !done[g]);
  // Bars fill toward 10 hard sets per body part per week, a common target for growth.
  const rows = GROUPS.filter(g => g !== 'Other' && (planned[g] || done[g])).map(g => {
    const n = done[g] || 0;
    return `<div class="bpbar" style="--c:${BP_COLORS[g]}"><span class="nm">${g}</span>
      <div class="track"><i class="fill" data-w="${Math.min(100, n * 10)}"></i></div><span class="v"><b>${n}</b> / 10 sets</span>
      <span class="days">${planned[g] ? 'Planned ' + [...new Set(planned[g])].join(', ') : 'Not in your plan'}</span></div>`;
  }).join('');
  return `<section class="card"><div class="head"><h2>Body parts this week</h2><button class="link" data-act="editWeek">Edit week</button></div>
    <div class="bps">${rows}</div>
    ${missing.length ? `<p class="miss">Not in your week: <b>${missing.join(', ')}</b>. Add an exercise for ${missing.length === 1 ? 'it' : 'them'} to one of your workouts.</p>` : '<p class="muted small">Your week trains every major body part.</p>'}</section>`;
}
function planCard(p) {
  const v = p.vid && vById(p.vid);
  const days = WEEK_ORDER.filter(d => S.week[d] === p.id).map(d => DOW[d]);
  const names = p.ex.map(exName);
  const tg = targetsOf(p);
  const empty = !p.ex.length;
  return `<button class="plan" data-act="${empty ? 'fillPlan' : 'startPlan'}" data-id="${p.id}" style="--c:${BP_COLORS[tg[0]] || 'var(--navy)'}">
    <h3>${esc(p.name)} ${days.length ? `<span class="tag">${days.join(' · ')}</span>` : ''}</h3>
    <div class="chiprow">${tg.map(bpChip).join('')}</div>
    <p>${empty ? 'No exercises yet: add them from a video' : `${esc(names.slice(0, 4).join(', '))}${names.length > 4 ? ` +${names.length - 4}` : ''}`}</p>
    <p>${v ? `▶ ${esc(v.trainer || 'Video')} ${p.level ? `(${LEVELS[p.level]})` : ''} · ` : ''}${ago(lastDone(p.id))}</p>
    <span class="go">${empty ? '+ Add' : 'Start ›'}</span></button>`;
}

/* Active workout */
function viewActive() {
  const A = S.active;
  const total = A.items.reduce((a, it) => a + it.sets.length, 0), done = A.items.reduce((a, it) => a + doneSets(it).length, 0);
  const pct = total ? Math.round(done / total * 100) : 0;
  return `<section class="card live"><div><h2>${esc(A.name)}</h2>
      <span class="muted small">Started ${new Date(A.start).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })} · <span id="elapsed" class="num">${clock((Date.now() - A.start) / 1000)}</span></span></div>
      <button class="btn amber" data-act="finish">Finish</button>
      <div style="width:100%"><div class="prog"><i style="width:${pct}%"></i></div>
      <div class="pct"><span>${done} of ${total} sets</span><span>${pct}%${pct === 100 ? ' · Tap Finish 🎉' : ''}</span></div></div></section>
    ${A.items.map(exCard).join('')}
    <button class="btn ghost block" data-act="addEx">+ Add exercise</button>
    <button class="link danger-link" data-act="discard">Discard workout</button>`;
}
function placeholder(it, j, last) {
  const prev = it.sets[j - 1];
  if (prev && prev.done) return { w: prev.w, r: prev.r };
  return last[j] || last[last.length - 1] || { w: '', r: '' };
}
function exCard(it, i) {
  const lt = lastTime(it.ex, S.active.id), last = lt?.sets || [];
  const clips = clipsFor(it);
  const g = exById(it.ex)?.group, k = kindOf(it.ex);
  const rLabel = k === 'time' ? 'Seconds' : 'Reps';
  const first = k === 'weight' ? 'First time: pick a weight you can do with good form' : k === 'time' ? 'First time: hold as long as you can with good form' : 'First time: do as many clean reps as you can';
  return `<section class="card ex" id="ex-${i}" style="--c:${BP_COLORS[g] || 'var(--navy)'}"><div class="head"><div><h3>${esc(exName(it.ex))}</h3>${g ? bpChip(g) : ''}</div>
      ${clips.length ? `<button class="btn ghost small" data-act="form" data-i="${i}">▶ Form${it.stamp ? ` ${clock(it.stamp.t)}` : ''}</button>` : ''}</div>
    ${S.active.target ? `<p class="goalline">🎯 ${esc(S.active.target)}</p>` : ''}
    <p class="last">${lt ? `<b>Last time (${fmtDate(lt.date, { day: 'numeric', month: 'short' })}):</b> ` + last.map(s => fmtSet(k, s)).join(', ') : first}</p>
    <div class="sets ${k === 'weight' ? '' : 'one'}"><div class="set hdr"><span class="n">Set</span>${k === 'weight' ? '<span>kg</span>' : ''}<span>${rLabel}</span><span></span></div>
    ${it.sets.map((s, j) => {
      const ph = placeholder(it, j, last);
      return `<div class="set ${s.done ? 'done' : ''} ${justTicked === `${i}-${j}` ? 'just' : ''}"><span class="n ${s.pr ? 'pr' : ''}">${s.pr ? '★' : j + 1}</span>
        ${k === 'weight' ? `<input inputmode="decimal" enterkeyhint="next" data-in="w" data-i="${i}" data-j="${j}" value="${s.w === '' || s.w == null ? '' : s.w}" placeholder="${ph.w ?? ''}" aria-label="Weight in kg, set ${j + 1}">` : ''}
        <input inputmode="numeric" enterkeyhint="done" data-in="r" data-i="${i}" data-j="${j}" value="${s.r === '' || s.r == null ? '' : s.r}" placeholder="${ph.r ?? ''}" aria-label="${rLabel}, set ${j + 1}">
        <button class="tick" data-act="tick" data-i="${i}" data-j="${j}" aria-label="Set ${j + 1} done">✓</button></div>`;
    }).join('')}</div>
    <div class="ex-foot"><button class="link" data-act="addSet" data-i="${i}">+ Add set</button><button class="link muted" data-act="exMenu" data-i="${i}">More</button></div></section>`;
}

/* Videos */
function viewVideos() {
  const trainers = [...new Set(S.videos.map(v => v.trainer).filter(Boolean))].sort();
  const addCard = `<button class="card hero addv" data-act="addVideo"><div class="hero-top"><span class="tag">▶ YouTube</span><span class="plus">+</span></div>
    <h2 class="big">Add video</h2><p>Open YouTube, copy the link at the exercise, paste it here and timestamp it into a workout.</p></button>`;
  if (!S.videos.length) {
    return `${addCard}<section class="card"><h2>How it works</h2><div class="list">
      <div class="li"><span>1. <b>Open YouTube</b> from Add video and find your trainer</span></div>
      <div class="li"><span>2. Pause at the exercise → Share → tick <b>Start at</b> → Copy link</span></div>
      <div class="li"><span>3. <b>Paste</b>, name the exercise and pick the workout it belongs to</span></div>
      <div class="li"><span>4. In that workout, <b>▶ Form</b> opens the video at that exact second</span></div></div>
      <p class="muted small">On Android, once installed: in YouTube tap Share → Lift Log.</p></section>`;
  }
  return `${addCard}<div class="row"><input class="search grow" type="search" placeholder="Search videos or exercises" data-in="vq" value="${esc(vQuery)}"></div>
    ${trainers.length > 1 ? `<div class="chips">${['All', ...trainers].map(t => `<button class="chip ${vFilter === t ? 'on' : ''}" data-act="vFilter" data-t="${esc(t)}">${esc(t)}</button>`).join('')}</div>` : ''}
    <div id="vlist" class="vlist">${videoList()}</div>`;
}
function videoList() {
  const q = vQuery.toLowerCase();
  const list = S.videos.filter(v => (vFilter === 'All' || v.trainer === vFilter)
    && (!q || `${v.title} ${v.trainer} ${v.stamps.map(s => exName(s.ex)).join(' ')}`.toLowerCase().includes(q)))
    .sort((a, b) => b.added - a.added);
  if (!list.length) return '<p class="empty">No videos match.</p>';
  return list.map(v => `<button class="vcard" data-act="openVideo" data-id="${v.id}">
    <img src="${thumb(v.yt)}" alt="" loading="lazy" width="320" height="180">
    <div><h3>${esc(v.title)}</h3><p>${esc(v.trainer || 'Unknown trainer')}</p>
    <p>${v.stamps.length ? `${v.stamps.length} exercise${v.stamps.length === 1 ? '' : 's'} stamped` : '<span class="warn">Not stamped yet</span>'}</p>
    <p>${[...new Set(v.stamps.map(s => s.level).filter(Boolean))].sort().map(levelTag).join(' ')}</p></div></button>`).join('');
}

/* History */
function viewHistory() {
  if (!S.sessions.length) return '<section class="card empty"><b>No workouts yet</b>Finish a workout and it shows up here.</section>';
  let out = '', month = '';
  [...S.sessions].reverse().forEach(s => {
    const m = fmtDate(s.start, { month: 'long', year: 'numeric' });
    if (m !== month) { month = m; out += `<p class="month">${m}</p>`; }
    const t = sessionTotals(s), mins = s.end ? Math.round((s.end - s.start) / 60000) : 0;
    out += `<button class="hist" data-act="openSession" data-id="${s.id}">
      <div class="day"><b>${new Date(s.start).getDate()}</b><span>${DOW[new Date(s.start).getDay()]}</span></div>
      <div><h3>${esc(s.name)} ${t.prs ? `<span class="tag pr">★ ${t.prs}</span>` : ''}</h3>
      <p>${[`${s.items.length} exercises`, `${t.sets} sets`, workTxt(t), mins ? `${mins} min` : ""].filter(Boolean).join(" · ")}</p></div></button>`;
  });
  return out;
}

/* Progress */
function exUsage() {
  const m = new Map();
  S.sessions.forEach(s => s.items.forEach(it => { if (doneSets(it).length) m.set(it.ex, (m.get(it.ex) || 0) + 1); }));
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}
function viewProgress() {
  if (!S.sessions.length) return '<section class="card empty"><b>Nothing to chart yet</b>Log a few workouts to see your lifts grow.</section>';
  const gym = me().mode === 'gym';
  const weeks = Array.from({ length: 8 }, (_, k) => 7 - k).map(off => {
    const a = weekStart(off), b = a + 7 * DAY;
    let vol = 0, n = 0, sets = 0;
    S.sessions.forEach(s => { if (s.start >= a && s.start < b) { n++; const t = sessionTotals(s); vol += t.vol; sets += t.sets; } });
    return { vol, n, sets, label: fmtDate(a, { day: 'numeric', month: 'short' }) };
  });
  const used = exUsage();
  if (!progEx || !used.some(([id]) => id === progEx)) progEx = used[0]?.[0];
  let exBlock = '';
  if (progEx) {
    // Weights: estimated 1-rep max per session. Bodyweight: most reps, or longest hold in seconds.
    const k = kindOf(progEx), pts = [];
    let heavy = null, best = null;
    S.sessions.forEach(s => s.items.forEach(it => {
      if (it.ex !== progEx) return;
      let top = null;
      doneSets(it).forEach(x => {
        const e = score(k, x);
        if (!top || e > top.e) top = { e, w: x.w, r: x.r };
        if (!heavy || (x.w || 0) > (heavy.w || 0)) heavy = x;
        if (!best || e > best.e) best = { e, w: x.w, r: x.r, d: s.start };
      });
      if (top && top.e > 0) pts.push({ x: s.start, y: k === 'weight' ? top.e : top.r, w: top.w, r: top.r });
    }));
    const unit = k === 'time' ? 's' : k === 'reps' ? 'reps' : 'kg';
    const tiles = k === 'weight'
      ? `<div class="stat"><b>${best ? fmtKg(best.e) : '–'}<small>kg</small></b><span>Est. 1-rep max</span></div>
        <div class="stat"><b>${heavy ? fmtKg(heavy.w) : '–'}<small>kg</small></b><span>Heaviest set</span></div>`
      : `<div class="stat"><b>${best ? best.r : '–'}<small>${unit}</small></b><span>${k === 'time' ? 'Longest hold' : 'Most reps'}</span></div>
        <div class="stat"><b>${pts.length ? Math.round(pts.reduce((a, p) => a + p.r, 0) / pts.length) : '–'}<small>${unit}</small></b><span>Average best</span></div>`;
    const chartTitle = k === 'weight' ? 'Est. 1-rep max per session (kg)' : k === 'time' ? 'Longest hold per session (seconds)' : 'Most reps per session';
    exBlock = `<section class="card"><select class="ex-pick" data-in="progEx" aria-label="Exercise">
      ${used.map(([id, n]) => `<option value="${id}" ${id === progEx ? 'selected' : ''}>${esc(exName(id))} (${n})</option>`).join('')}</select>
      <div class="stats" style="margin-top:10px">${tiles}<div class="stat"><b>${pts.length}</b><span>Sessions</span></div></div>
      ${pts.length > 1 ? `<h3 class="ch">${chartTitle}</h3><div class="chart">${lineChart({ pts })}</div>` : '<p class="muted small">Do this exercise twice to see a trend.</p>'}
      <div class="list">${pts.slice(-5).reverse().map(p => `<div class="li"><span>${fmtDate(p.x)}</span><span class="r">${fmtSet(k, p)}${k === 'weight' ? ` <span class="muted">≈ ${fmtKg(p.y)} kg</span>` : ''}</span></div>`).join('')}</div></section>`;
  }
  const board = used.map(([id]) => {
    const k = kindOf(id);
    let b = null;
    S.sessions.forEach(s => s.items.forEach(it => { if (it.ex === id) doneSets(it).forEach(x => { const e = score(k, x); if (!b || e > b.e) b = { e, w: x.w, r: x.r }; }); }));
    return b && b.e ? `<div class="li"><span>${esc(exName(id))}</span><span class="r">${fmtSet(k, b)}</span></div>` : '';
  }).join('');
  return exBlock + (gym
    ? `<section class="card"><h2>Weekly volume (kg lifted)</h2><div class="chart">${barChart(weeks.map(w => w.vol), weeks.map(w => w.label), fmtVol)}</div>`
    : `<section class="card"><h2>Sets per week</h2><div class="chart">${barChart(weeks.map(w => w.sets), weeks.map(w => w.label), n => `${n}`)}</div>`) + `
    <p class="muted small">Workouts per week: ${weeks.map(w => w.n).join(' · ')}</p></section>
    ${board ? `<section class="card"><h2>Best sets</h2><div class="list">${board}</div></section>` : ''}`;
}

/* Body */
function viewBody() {
  const sorted = S.body;
  const ws = sorted.filter(b => b.w);
  const latest = ws[ws.length - 1];
  const avg7 = iso => { const t = dayMs(iso), win = ws.filter(b => dayMs(b.d) <= t && dayMs(b.d) > t - 7 * DAY); return win.reduce((a, b) => a + b.w, 0) / win.length; };
  let stats = '';
  if (latest) {
    const ref = [...ws].reverse().find(b => dayMs(b.d) <= dayMs(latest.d) - 28 * DAY) || ws[0];
    const ch = latest.w - ref.w, goal = S.settings.goal;
    stats = `<div class="stats">
      <div class="stat"><b>${fmtKg(avg7(latest.d))}<small>kg</small></b><span>7-day average</span></div>
      <div class="stat ${ch < 0 ? 'down' : ch > 0 ? 'up' : ''}"><b>${ch > 0 ? '+' : ''}${fmtKg(ch)}<small>kg</small></b><span>Since ${fmtDate(dayMs(ref.d), { day: 'numeric', month: 'short' })}</span></div>
      <div class="stat"><b>${goal ? fmtKg(Math.abs(latest.w - goal)) : '–'}<small>${goal ? 'kg' : ''}</small></b><span>${goal ? `To goal ${fmtKg(goal)} kg` : '<button class="link" data-act="settings">Set a goal</button>'}</span></div></div>`;
  }
  const from = Date.now() - 90 * DAY;
  const recent = ws.filter(b => dayMs(b.d) >= from);
  const chart = recent.length > 1 ? `<section class="card"><h2>Weight, last 90 days (kg)</h2><div class="chart">${lineChart({
    pts: recent.map(b => ({ x: dayMs(b.d), y: b.w })), avg: recent.map(b => ({ x: dayMs(b.d), y: avg7(b.d) })), goal: S.settings.goal,
  })}</div><div class="legend"><span><i></i>7-day average</span><span><i class="dotk"></i>Weigh-ins</span>${S.settings.goal ? '<span><i class="g"></i>Goal</span>' : ''}</div></section>` : '';
  const ed = S.body.find(b => b.d === bodyDate) || {};
  const d = bodyDate || isoDay(Date.now());
  const meas = MEAS.map(([k, label]) => {
    const has = S.body.filter(b => b[k]);
    if (!has.length) return '';
    const a = has[0][k], z = has[has.length - 1][k], c = z - a;
    return `<div class="li"><span>${label}</span><span class="r">${fmtKg(z)} cm ${has.length > 1 ? `<span class="muted">(${c > 0 ? '+' : ''}${fmtKg(c)} cm)</span>` : ''}</span></div>`;
  }).join('');
  return `<section class="card"><h2>${bodyDate ? 'Edit entry' : 'Log today'}</h2>
    <div class="grid2"><label class="f">Date<input id="bD" type="date" value="${d}" max="${isoDay(Date.now())}"></label>
    <label class="f">Weight (kg)<input id="bW" inputmode="decimal" value="${ed.w ?? ''}" placeholder="${latest ? fmtKg(latest.w) : 'e.g. 72.5'}"></label></div>
    <details ${MEAS.some(([k]) => ed[k]) ? 'open' : ''}><summary>Measurements (cm)</summary><div class="grid3">
    ${MEAS.map(([k, label]) => `<label class="f">${label}<input id="bm-${k}" inputmode="decimal" value="${ed[k] ?? ''}"></label>`).join('')}</div></details>
    <div class="row"><button class="btn grow" data-act="saveBody">Save</button>${bodyDate ? `<button class="btn danger" data-act="delBody">Delete</button><button class="btn ghost" data-act="cancelBody">Cancel</button>` : ''}</div></section>
    ${stats}${chart}
    ${meas ? `<section class="card"><h2>Measurements</h2><p class="muted small">Latest, with change since your first entry</p><div class="list">${meas}</div></section>` : ''}
    ${S.body.length ? `<section class="card"><h2>Entries</h2><div class="list">${[...S.body].reverse().slice(0, 20).map(b =>
      `<button class="li" data-act="editBody" data-d="${b.d}"><span>${fmtDate(dayMs(b.d))}</span><span class="r">${b.w ? fmtKg(b.w) + ' kg' : ''}${MEAS.some(([k]) => b[k]) ? ' <span class="muted">+ cm</span>' : ''}</span></button>`).join('')}</div></section>` : ''}`;
}

/* ---------- charts (no gridlines; units in the chart title) ---------- */
function lineChart({ pts, avg, goal }) {
  const W = 340, H = 170, L = 38, R = 10, T = 10, B = 22;
  const xs = pts.map(p => p.x);
  const ys = pts.map(p => p.y).concat(avg ? avg.map(p => p.y) : []).concat(goal ? [goal] : []);
  let x0 = Math.min(...xs), x1 = Math.max(...xs);
  if (x1 === x0) { x0 -= DAY; x1 += DAY; }
  const lo = Math.min(...ys), hi = Math.max(...ys), pad = Math.max((hi - lo) * 0.12, 0.5);
  const y0 = lo - pad, y1 = hi + pad;
  const X = x => L + (x - x0) / (x1 - x0) * (W - L - R), Y = y => T + (1 - (y - y0) / (y1 - y0)) * (H - T - B);
  const path = arr => arr.map((p, i) => `${i ? 'L' : 'M'}${X(p.x).toFixed(1)},${Y(p.y).toFixed(1)}`).join('');
  const dl = ms => fmtDate(ms, { day: 'numeric', month: 'short' });
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Trend chart">${CHART_DEFS}
    <path d="${path(avg || pts)}L${X((avg || pts)[(avg || pts).length - 1].x)},${H - B}L${X((avg || pts)[0].x)},${H - B}Z" fill="url(#la)"/>
    <text x="${L - 6}" y="${Y(hi) + 4}" text-anchor="end">${fmtKg(hi)}</text>
    <text x="${L - 6}" y="${Y(lo) + 4}" text-anchor="end">${fmtKg(lo)}</text>
    ${goal ? `<line class="goal" x1="${L}" x2="${W - R}" y1="${Y(goal)}" y2="${Y(goal)}"/>` : ''}
    ${avg ? pts.map(p => `<circle class="dot faint" cx="${X(p.x)}" cy="${Y(p.y)}" r="3"/>`).join('') : ''}
    <path class="ln" d="${path(avg || pts)}"/>
    ${avg ? '' : pts.map(p => `<circle class="dot" cx="${X(p.x)}" cy="${Y(p.y)}" r="3.5"/>`).join('')}
    <text x="${L}" y="${H - 4}">${dl(x0)}</text><text x="${W - R}" y="${H - 4}" text-anchor="end">${dl(x1)}</text></svg>`;
}
const CHART_DEFS = `<defs>
  <linearGradient id="lg" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="340" y2="0"><stop offset="0" stop-color="#3b5bfd"/><stop offset=".6" stop-color="#7c3aed"/><stop offset="1" stop-color="#db2777"/></linearGradient>
  <linearGradient id="la" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7c3aed" stop-opacity=".22"/><stop offset="1" stop-color="#7c3aed" stop-opacity="0"/></linearGradient>
  <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7c3aed"/><stop offset="1" stop-color="#3b5bfd"/></linearGradient>
  <linearGradient id="bw" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f97316"/><stop offset="1" stop-color="#ef4444"/></linearGradient></defs>`;
function barChart(vals, labels, fmt) {
  const W = 340, H = 150, T = 18, B = 20, n = vals.length, gap = 8, bw = (W - gap * (n - 1)) / n;
  const max = Math.max(...vals, 1);
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Bar chart">${CHART_DEFS}${vals.map((v, i) => {
    const h = v / max * (H - T - B), x = i * (bw + gap), y = H - B - h;
    return `<rect class="bar ${i === n - 1 ? 'now' : ''}" x="${x}" y="${y}" width="${bw}" height="${Math.max(h, v ? 2 : 0)}" rx="4"/>
      ${v ? `<text x="${x + bw / 2}" y="${y - 5}" text-anchor="middle">${fmt(v)}</text>` : ''}
      <text x="${x + bw / 2}" y="${H - 5}" text-anchor="middle">${i === n - 1 ? 'This wk' : i % 2 ? '' : labels[i]}</text>`;
  }).join('')}</svg>`;
}

/* ---------- workout actions ---------- */
function startWorkout({ name, planId = null, exIds = [], vid = null, level = '', clips = null, target = '' }) {
  if (S.active && !confirm('A workout is already running. Replace it?')) return;
  const v = vid && vById(vid);
  S.active = {
    id: uid(), start: Date.now(), name, planId, ...(level ? { level } : {}), ...(target ? { target } : {}),
    items: exIds.map(ex => {
      // A clip linked to this exercise in the workout wins; otherwise the workout's video at your level.
      const own = clips?.[ex] && vById(clips[ex].v) ? clips[ex] : null;
      const st = own ? { v: own.v, t: own.t } : v && pickStamp(v, ex, level) ? { v: v.id, t: pickStamp(v, ex, level).t } : null;
      return { ex, sets: Array.from({ length: Math.max(3, lastSets(ex).length) }, () => ({ w: '', r: '', done: false })), ...(st ? { stamp: st } : {}) };
    }),
  };
  save(); closeSheet(); go('train'); wake();
}
function tick(i, j) {
  const A = S.active, it = A.items[i], s = it.sets[j];
  if (s.done) { s.done = false; s.pr = false; save(); render(); return; }
  const k = kindOf(it.ex), ph = placeholder(it, j, lastSets(it.ex, A.id));
  if (k !== 'weight') s.w = 0;
  else if (s.w === '' || s.w == null) s.w = ph.w === '' ? 0 : +ph.w;
  if (s.r === '' || s.r == null) s.r = ph.r === '' ? '' : +ph.r;
  if (!(s.r > 0)) { toast(k === 'time' ? 'Enter the seconds first' : 'Enter the reps first'); return; }
  s.done = true;
  const best = bestScore(it.ex, A.id), e = score(k, s);
  const inSession = Math.max(0, ...it.sets.filter(x => x !== s && x.done).map(x => score(k, x)));
  if (best > 0 && e > best && e > inSession) {
    it.sets.forEach(x => { x.pr = false; });
    s.pr = true;
    toast(`★ New best: ${exName(it.ex)} ${fmtSet(k, s)}`);
    confetti(60);
    buzz([30, 40, 30]);
  } else buzz();
  save(); justTicked = `${i}-${j}`; render(); startRest();
  if (it.sets.every(x => x.done)) toast(`${exName(it.ex)} done ✓`);
}
function finish() {
  const A = S.active;
  if (!A.items.some(it => doneSets(it).length)) {
    if (confirm('No sets ticked yet. Discard this workout?')) { S.active = null; save(); stopRest(); unwake(); render(); }
    return;
  }
  A.items.forEach(it => { it.sets = doneSets(it); });
  A.items = A.items.filter(it => it.sets.length);
  A.end = Date.now();
  S.sessions.push(A);
  S.sessions.sort((a, b) => a.start - b.start);
  S.active = null;
  save(); stopRest(); unwake(); render();
  openSession(A.id, true);
  confetti(140);
  buzz([40, 60, 40, 60, 80]);
}

/* ---------- sheets ---------- */
const sheet = $('#sheet'), sheetBody = $('#sheetBody');
function openSheet(html, after) {
  killPlayer();
  sheetBody.innerHTML = html;
  if (!sheet.open) sheet.showModal();
  sheetBody.scrollTop = 0;
  if (after) after();
}
function closeSheet() { if (sheet.open) sheet.close(); }
sheet.addEventListener('close', () => { killPlayer(); planHint = null; if (pendingReload) location.reload(); });
sheet.addEventListener('click', e => { if (e.target === sheet) closeSheet(); });
const sheetHead = (title, sub = '') => `<div class="head"><div><h2>${title}</h2>${sub ? `<p class="muted small">${sub}</p>` : ''}</div><button class="x" data-act="close" aria-label="Close">✕</button></div>`;
const exDatalist = () => `<datalist id="exList">${S.ex.map(e => `<option value="${esc(e.name)}">`).join('')}</datalist>`;

function openSession(id, justDone = false) {
  const s = S.sessions.find(x => x.id === id);
  if (!s) return;
  const t = sessionTotals(s), mins = s.end ? Math.round((s.end - s.start) / 60000) : 0;
  openSheet(`${sheetHead(justDone ? 'Workout saved' : esc(s.name), `${justDone ? esc(s.name) + ' · ' : ''}${fmtDate(s.start)}${mins ? ` · ${mins} min` : ''}`)}
    <div class="stats"><div class="stat"><b>${t.sets}</b><span>Sets</span></div>
      ${t.vol ? `<div class="stat"><b>${fmtVol(t.vol).replace(/ (kg|t)$/, '<small>$1</small>')}</b><span>Lifted</span></div>` : `<div class="stat"><b>${t.reps}</b><span>Reps${t.secs ? ` · ${clock(t.secs)} held` : ''}</span></div>`}
      <div class="stat ${t.prs ? 'down' : ''}"><b>${t.prs}</b><span>New bests</span></div></div>
    ${s.items.map((it, i) => `<div><div class="head"><h3 class="sh">${esc(exName(it.ex))}</h3>${clipsFor(it).length ? `<button class="btn ghost small" data-act="formH" data-id="${s.id}" data-i="${i}">▶ ${it.stamp ? clock(it.stamp.t) : 'Form'}</button>` : ''}</div><div class="list">${it.sets.map((x, k) =>
      `<div class="li"><span class="muted">Set ${k + 1}</span><span class="r">${fmtSet(kindOf(it.ex), x)}${x.pr ? ' <span class="tag pr">★ Best</span>' : ''}</span></div>`).join('')}</div></div>`).join('')}
    <div class="row"><button class="btn grow" data-act="repeat" data-id="${s.id}">Repeat this workout</button><button class="btn danger" data-act="delSession" data-id="${s.id}">Delete</button></div>`);
}

function pickExercise(onPick, title = 'Add exercise') {
  pickCb = onPick;
  openSheet(`${sheetHead(title)}<input class="search" type="search" placeholder="Search or type a new exercise" data-in="exq" autocomplete="off"><div id="exPick" class="list">${exPickList('')}</div>`);
}
let pickCb = null;
function exPickList(q) {
  const n = q.toLowerCase().trim();
  const hits = S.ex.filter(e => !n || e.name.toLowerCase().includes(n));
  const groups = GROUPS.map(g => [g, hits.filter(e => e.group === g)]).filter(([, l]) => l.length);
  return `${n && !findEx(q) ? `<button class="li" data-act="pickNew"><b>+ Create “${esc(q.trim())}”</b></button>` : ''}
    ${groups.map(([g, l]) => `<p class="month">${g}</p>${l.map(e => `<button class="li" data-act="pickEx" data-id="${e.id}">${esc(e.name)}</button>`).join('')}`).join('')}`;
}

function exMenu(i) {
  const it = S.active.items[i];
  openSheet(`${sheetHead(esc(exName(it.ex)))}
    <button class="btn ghost block" data-act="exMove" data-i="${i}" data-d="-1" ${i === 0 ? 'disabled' : ''}>Move up</button>
    <button class="btn ghost block" data-act="exMove" data-i="${i}" data-d="1" ${i === S.active.items.length - 1 ? 'disabled' : ''}>Move down</button>
    <button class="btn ghost block" data-act="exSwap" data-i="${i}">Swap for another exercise</button>
    <div><h3 class="sh">Log this exercise as</h3><div class="chips">${Object.entries(KINDS).map(([k, l]) =>
      `<button class="chip ${kindOf(it.ex) === k ? 'on' : ''}" data-act="exKind" data-i="${i}" data-k="${k}">${l}</button>`).join('')}</div></div>
    <button class="btn ghost block" data-act="delSet" data-i="${i}" ${it.sets.length <= 1 ? 'disabled' : ''}>Remove last set</button>
    <button class="btn danger block" data-act="delEx" data-i="${i}">Remove exercise</button>`);
}

let curClips = [];
function openClip(it) {
  curClips = clipsFor(it);
  if (!curClips.length) return;
  if (adFree()) {
    // One clip: straight into the YouTube app. Several: pick the trainer first.
    if (curClips.length === 1) { openYT(curClips[0].v.yt, curClips[0].t); return; }
    openSheet(`${sheetHead(esc(exName(it.ex)), 'Opens in the YouTube app, no ads')}<div class="list">${curClips.map(c =>
      `<button class="li" data-act="ytOpen" data-yt="${c.v.yt}" data-t="${c.t}"><span><b>${esc(c.v.trainer || c.v.title)}</b> ${levelTag(c.level)}${c.note ? `<br><span class="muted small">${esc(c.note)}</span>` : ''}</span><span class="r"><span class="tchip">▶ ${clock(c.t)}</span></span></button>`).join('')}</div>`);
    return;
  }
  openSheet(`${sheetHead(esc(exName(it.ex)))}${playerBox()}<div id="clipInfo"></div>
    ${curClips.length > 1 ? `<div><h3 class="sh">Other trainers</h3><div class="list">${curClips.map((c, k) =>
      `<button class="li" data-act="clip" data-k="${k}"><span>${esc(c.v.trainer || c.v.title)} ${levelTag(c.level)}</span><span class="r muted">${clock(c.t)}</span></button>`).join('')}</div></div>` : ''}`,
  () => showClip(0));
}
function showClip(k) {
  const c = curClips[k];
  $('#clipInfo').innerHTML = `<p class="small"><b>${esc(c.v.trainer || 'Video')}</b> ${levelTag(c.level)} · ${esc(c.v.title)} · at ${clock(c.t)}</p>
    ${c.note ? `<p class="note">${esc(c.note)}</p>` : ''}
    <button class="btn ghost small" data-act="seek" data-t="${c.t}">↺ Back to ${clock(c.t)}</button>
    ${premiumNote(c.v.yt, c.t)}`;
  mountPlayer($('#vp'), c.v.yt, c.t);
}

/* Video sheets: add, watch and stamp */
// Add video: 1 open YouTube and copy the link (with "Start at" for the exact second),
// 2 paste it here, 3 timestamp the exercise and link it into a workout, all in one sheet.
const ytSearch = q => (q.trim() ? `https://www.youtube.com/results?search_query=${encodeURIComponent(q.trim())}` : 'https://www.youtube.com/');
let planHint = null;
function pickVideoFor(p) {
  planHint = p.id;
  if (!S.videos.length) { addVideo(); return; }
  openSheet(`${sheetHead(`Fill ${esc(p.name)}`, 'Pick the trainer video, then stamp each exercise')}
    <button class="btn block" data-act="addVideo">+ Add a new YouTube video</button>
    <div class="vlist">${[...S.videos].sort((a, b) => b.added - a.added).map(v => `<button class="vcard" data-act="openVideo" data-id="${v.id}">
      <img src="${thumb(v.yt)}" alt="" loading="lazy" width="320" height="180"><div><h3>${esc(v.title)}</h3><p>${esc(v.trainer || '')}</p>
      <p>${v.stamps.length} exercise${v.stamps.length === 1 ? '' : 's'} stamped</p></div></button>`).join('')}</div>`);
}
function addVideo(prefill = '') {
  const trainers = [...new Set(S.videos.map(v => v.trainer).filter(Boolean))];
  openSheet(`${sheetHead('Add a video', 'Link a YouTube video and timestamp the exercise')}
    <div class="step"><span class="sn">1</span><div class="grow"><b>Find it on YouTube</b>
      <div class="row"><input id="ytQ" data-in="ytq" class="search grow" type="search" placeholder="Trainer or exercise" value="${esc(trainers[0] || '')}">
      <a class="btn" id="ytGo" href="${ytSearch(trainers[0] || '')}" target="_blank" rel="noopener">Open ↗</a></div>
      <p class="muted small">In the video, pause where the exercise starts → <b>Share</b> → tick <b>Start at</b> → <b>Copy link</b>.</p></div></div>
    <div class="step"><span class="sn">2</span><div class="grow"><b>Paste the link</b>
      <div class="row"><input id="vUrl" class="search grow" type="url" inputmode="url" placeholder="https://youtu.be/…" value="${esc(prefill)}" autocomplete="off">
      <button class="btn ghost" data-act="pasteLink">📋 Paste</button></div><div id="vPrev"></div>
      <div class="grid2" id="vMeta" hidden><label class="f">Trainer<input id="vTrainer" list="trainerList" placeholder="From YouTube"></label>
      <label class="f">Title<input id="vTitle" placeholder="From YouTube"></label></div>
      <datalist id="trainerList">${trainers.map(t => `<option value="${esc(t)}">`).join('')}</datalist></div></div>
    <div class="step"><span class="sn">3</span><div class="grow"><b>Timestamp the exercise</b> <span class="muted small">(optional, you can add more later)</span>
      <div class="inset">${stampFields(null, 0, S.settings.level)}</div></div></div>
    ${exDatalist()}
    <button class="btn block big-btn" data-act="saveVideo">Save video</button>`, () => { if (prefill) lookupVideo(); });
}
async function lookupVideo() {
  const p = parseYT($('#vUrl')?.value);
  const prev = $('#vPrev');
  if (!prev) return;
  if (!p) { prev.innerHTML = $('#vUrl').value.trim() ? '<p class="warn small">That is not a YouTube link.</p>' : ''; return; }
  $('#vMeta').hidden = false;
  if (p.t && $('#sT')) $('#sT').value = clock(p.t);
  prev.innerHTML = `<div class="vprev"><img src="${thumb(p.id)}" alt=""><div><b id="vpT">Loading…</b><p class="muted small">${p.t ? `Starts at <b>${clock(p.t)}</b>, used as the timestamp` : 'No start time in the link: type the time below'}</p></div></div>`;
  const info = await ytInfo(p.id);
  if ($('#vpT')) $('#vpT').textContent = info?.title || 'YouTube video';
  if (!info) return;
  if ($('#vTitle') && !$('#vTitle').value) $('#vTitle').value = info.title || '';
  if ($('#vTrainer') && !$('#vTrainer').value) $('#vTrainer').value = info.author_name || '';
}
function saveVideo() {
  const p = parseYT($('#vUrl').value);
  if (!p) { toast('Paste a YouTube link first'); return; }
  const wantsStamp = $('#sEx').value.trim();
  if (wantsStamp && parseClock($('#sT').value) == null) { toast('Type the time like 1.10 (1 min 10 s)'); return; }
  let v = S.videos.find(x => x.yt === p.id);
  if (!v) {
    v = { id: uid(), yt: p.id, title: $('#vTitle').value.trim() || 'YouTube video', trainer: $('#vTrainer').value.trim(), added: Date.now(), stamps: [] };
    S.videos.push(v);
  }
  let r = null;
  if (wantsStamp) r = stampFromForm(v, '');
  save();
  if (view === 'videos' || view === 'train') render();
  buzz([20, 30, 20]);
  toast(r ? `Linked ${exName(r.ex)} at ${clock(r.t)}${r.p ? ` → ${r.p.name}` : ''}` : 'Video saved');
  if (r) confetti(40);
  openVideo(v.id, r ? (adFree() ? null : r.t) : p.t);
}
let curVid = null, vLevel = '';
// Level chips in a video: filter the stamp list, set the level for new stamps, and pick which level to train.
function levelChips() {
  const v = vById(curVid);
  const used = new Set(v ? v.stamps.map(s => s.level) : []);
  return [['', 'All levels'], ...Object.entries(LEVELS)].map(([k, l]) =>
    `<button class="chip ${vLevel === k ? 'on' : ''}" data-act="vLevel" data-l="${k}">${l}${k && used.has(k) ? ` · ${v.stamps.filter(s => s.level === k).length}` : ''}</button>`).join('');
}
function openVideo(id, t0 = null) {
  const v = vById(id);
  if (!v) return;
  curVid = v.id;
  // Open on your own level when the video has stamps for it, otherwise show everything.
  vLevel = v.stamps.some(s => s.level === S.settings.level) ? S.settings.level : '';
  const af = adFree();
  openSheet(`${sheetHead(esc(v.title), esc(v.trainer || ''))}
    ${af ? `<button class="vid ytthumb" data-act="ytOpen" data-yt="${v.yt}" data-t="${t0 || 0}"><img src="${thumb(v.yt)}" alt="">
        <span class="playbig">▶</span><span class="ytlabel">Play in YouTube app · no ads</span></button>
      <p class="muted small">Stamp an exercise: in YouTube pause at it → Share → tick <b>Start at</b> → Copy link, then tap Paste link.</p>
      <div class="row"><button class="btn grow" data-act="pasteStamp">📋 Paste link</button><button class="btn ghost" data-act="stampNow">⏱ Type time</button></div>`
    : `${playerBox()}
      <button class="btn block" data-act="stampNow">⏱ Stamp exercise at <span id="nowT" class="num">0:00</span></button>
      ${premiumNote(v.yt, t0 || 0)}`}
    <div id="stampForm"></div>
    <div><div class="head"><h3 class="sh">Exercises in this video</h3></div>
      <div class="chips" id="lvChips">${levelChips()}</div><div id="stampList" class="list"></div></div>
    <details><summary>Paste timestamps from the description</summary>
      <p class="muted small">Many trainers list chapters like “2:15 Incline press”. Copy them from the YouTube description and paste here.</p>
      <textarea id="chap" rows="6" placeholder="0:45 Bench press&#10;4:10 Incline dumbbell press&#10;8:30 Cable fly"></textarea>
      <button class="btn ghost block" data-act="readChap">Read timestamps</button><div id="chapPrev"></div></details>
    <div class="row"><button class="btn amber grow" data-act="vidWorkout">Start <span class="lvName">${vLevel ? LEVELS[vLevel] : ''}</span> workout</button><button class="btn ghost grow" data-act="vidPlan">Save as plan</button></div>
    <details><summary>Edit video details</summary>
      <label class="f">Title<input id="veTitle" value="${esc(v.title)}"></label>
      <label class="f">Trainer<input id="veTrainer" value="${esc(v.trainer)}"></label>
      <div class="row"><button class="btn grow" data-act="saveVidInfo">Save</button><button class="btn danger" data-act="delVideo">Delete video</button></div></details>
    ${exDatalist()}`, () => {
    renderStamps();
    if (af) { if (t0) stampForm(null, t0); return; }
    mountPlayer($('#vp'), v.yt, t0 ?? 0);
    nowTimer = setInterval(() => { const el = $('#nowT'); if (el) el.textContent = clock(playerTime()); }, 500);
  });
}
function renderStamps() {
  const v = vById(curVid), el = $('#stampList');
  if (!v || !el) return;
  $('#lvChips').innerHTML = levelChips();
  document.querySelectorAll('.lvName').forEach(x => { x.textContent = vLevel ? LEVELS[vLevel] : ''; });
  const list = [...v.stamps].filter(s => !vLevel || !s.level || s.level === vLevel).sort((a, b) => a.t - b.t);
  el.innerHTML = list.length ? list.map(s => `<div class="li stamp">
      <button class="tchip" ${adFree() ? `data-act="ytOpen" data-yt="${v.yt}"` : 'data-act="seek"'} data-t="${s.t}">▶ ${clock(s.t)}</button>
      <div class="grow"><b>${esc(exName(s.ex))}</b> ${vLevel ? '' : levelTag(s.level)}<br><span class="muted small">${esc(exById(s.ex)?.group || '')}${s.note ? ` · ${esc(s.note)}` : ''}</span></div>
      <button class="link" data-act="editStamp" data-id="${s.id}">Edit</button></div>`).join('')
    : `<p class="muted small">${v.stamps.length ? 'Nothing stamped at this level yet.' : adFree() ? 'None yet. Copy a link at the exercise in YouTube and tap Paste link.' : 'None yet. Play the video and tap ⏱ Stamp when an exercise starts.'}</p>`;
}
const groupSelect = (id, val) => `<select id="${id}">${GROUPS.map(g => `<option ${g === val ? 'selected' : ''}>${g}</option>`).join('')}</select>`;
// The fields for one timestamp: time, exercise, body part, level, note, and which workout it belongs to.
function stampFields(s, t, lv, v = null) {
  const inPlan = s && v ? S.plans.find(p => p.clips?.[s.ex]?.v === v.id && p.clips[s.ex].t === s.t) : null;
  const today = planById(S.week[new Date().getDay()]);
  const sel = inPlan ? inPlan.id : (!s ? (planHint && planById(planHint) ? planHint : today ? today.id : '') : '');
  return `<div class="grid2">
      <label class="f">Time in video<input id="sT" ${timeAttrs} value="${clock(t)}"></label>
      <label class="f">Exercise<input id="sEx" list="exList" value="${s ? esc(exName(s.ex)) : ''}" placeholder="e.g. Bench press" autocomplete="off"></label>
      <label class="f">Body part${groupSelect('sGroup', s ? exById(s.ex)?.group : 'Chest')}</label>
      <label class="f">Level<select id="sLevel"><option value="">All levels</option>${Object.entries(LEVELS).map(([k, l]) => `<option value="${k}" ${k === lv ? 'selected' : ''}>${l}</option>`).join('')}</select></label></div>
    <label class="f">Add to workout<select id="sPlan"><option value="">Don't add to a workout</option>
      ${S.plans.map(p => { const d = WEEK_ORDER.filter(x => S.week[x] === p.id).map(x => DOW[x]).join(', '); return `<option value="${p.id}" ${p.id === sel ? 'selected' : ''}>${esc(p.name)}${d ? ` (${d})` : ''}</option>`; }).join('')}
      <option value="new">+ New workout…</option></select></label>
    <label class="f">Note (sets, reps, cues)<input id="sNote" value="${esc(s?.note || '')}" placeholder="e.g. 3 × 10, slow negatives"></label>`;
}
// Saves the stamp from the form; if a workout is picked, the exercise joins it, linked to this second of the video.
function stampFromForm(v, sid) {
  const t = parseClock($('#sT').value), ex = resolveEx($('#sEx').value);
  if (t == null) { toast('Type the time like 1.10 (1 min 10 s)'); return null; }
  if (!ex) { toast('Type the exercise name'); return null; }
  exById(ex).group = $('#sGroup').value;
  const note = $('#sNote').value.trim(), level = $('#sLevel').value, old = v.stamps.find(x => x.id === sid);
  if (old) Object.assign(old, { t, ex, note, level }); else v.stamps.push({ id: uid(), t, ex, note, level });
  const pid = $('#sPlan').value;
  let p = null;
  if (pid === 'new') {
    const name = prompt('Name the new workout', v.trainer ? `${v.trainer} workout` : 'New workout');
    if (name && name.trim()) { p = { id: uid(), name: name.trim(), ex: [] }; S.plans.push(p); }
  } else if (pid) p = planById(pid);
  if (p) {
    if (!p.ex.includes(ex)) p.ex.push(ex);
    p.clips = p.clips || {};
    p.clips[ex] = { v: v.id, t };
  }
  save();
  return { ex, t, p };
}
function stampForm(s, t) {
  const lv = s ? s.level || '' : vLevel;
  $('#stampForm').innerHTML = `<div class="inset">${stampFields(s, t, lv, vById(curVid))}
    <div class="row"><button class="btn grow" data-act="saveStamp" data-id="${s?.id || ''}">Save stamp</button>
    ${s ? `<button class="btn danger" data-act="delStamp" data-id="${s.id}">Delete</button>` : ''}<button class="btn ghost" data-act="cancelStamp">Cancel</button></div></div>`;
  if (!s) $('#sEx').focus();
}
// Typing an exercise in the stamp form shows its body part (known, or a guess from the name).
document.addEventListener('change', e => {
  if (e.target.id !== 'sEx' || !$('#sGroup')) return;
  $('#sGroup').value = findEx(e.target.value)?.group || guessGroup(e.target.value);
});

function editWeek() {
  const opts = id => `<option value="">Rest</option>${S.plans.map(p => `<option value="${p.id}" ${p.id === id ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}`;
  openSheet(`${sheetHead('Weekly plan', 'Pick the workout for each day')}
    <div class="list">${WEEK_ORDER.map(d => `<label class="li"><span>${DOW_LONG[d]}</span><select class="ex-pick narrow" data-in="weekday" data-d="${d}">${opts(S.week[d])}</select></label>`).join('')}</div>
    <button class="btn ghost block" data-act="newPlan">+ Create a new workout</button>
    <button class="btn block" data-act="close">Done</button>`);
}

let planDraft = null;
function editPlan(id) {
  const p = id ? planById(id) : null;
  if (!planDraft || planDraft.id !== (p?.id || 'new')) planDraft = p ? { ...p, ex: [...p.ex] } : { id: 'new', name: '', ex: [] };
  const d = planDraft;
  openSheet(`${sheetHead(p ? 'Edit workout' : 'New workout')}
    <label class="f">Name<input id="pName" value="${esc(d.name)}" placeholder="e.g. Upper body A"></label>
    <div class="list">${d.ex.map((x, k) => `<div class="li"><span>${k + 1}. ${esc(exName(x))}</span><span class="r">
      <button class="mini" data-act="pMove" data-k="${k}" data-d="-1" aria-label="Move up">↑</button><button class="mini" data-act="pMove" data-k="${k}" data-d="1" aria-label="Move down">↓</button><button class="mini" data-act="pDel" data-k="${k}" aria-label="Remove">✕</button></span></div>`).join('') || '<p class="muted small">No exercises yet.</p>'}</div>
    <button class="btn ghost block" data-act="pAdd">+ Add exercise</button>
    <div class="row"><button class="btn grow" data-act="savePlan">Save</button>${p ? '<button class="btn danger" data-act="delPlan">Delete</button>' : ''}</div>`);
}

function openSettings() {
  const s = S.settings;
  openSheet(`${sheetHead(`Settings · ${me().name}`)}
    <button class="person on" data-act="who" data-p="${person}"><span class="av">${me().name[0]}</span><span><b>${me().name}</b><small>Tap to switch person</small></span><span class="go">›</span></button>
    <label class="f">My goal<select data-in="aim">${AIMS.map(a => `<option ${a === (s.aim || me().aim) ? 'selected' : ''}>${a}</option>`).join('')}</select></label>
    <div><h3 class="sh">Workouts</h3><div class="list">
      <button class="li" data-act="editWeek"><span>Weekly plan</span><span class="r muted">${WEEK_ORDER.map(d => planById(S.week[d]) ? DOW[d][0] : '·').join(' ')} ›</span></button>
      ${S.plans.map(p => `<button class="li" data-act="editPlan" data-id="${p.id}"><span>${esc(p.name)}</span><span class="r muted">${p.ex.length} exercises ›</span></button>`).join('')}
      <button class="li" data-act="newPlan"><b>+ New workout</b></button></div></div>
    <div class="grid2"><label class="f">Rest timer<select data-in="rest">${[0, 45, 60, 90, 120, 150, 180, 240].map(v => `<option value="${v}" ${v === s.rest ? 'selected' : ''}>${v ? clock(v) + ' min' : 'Off'}</option>`).join('')}</select></label>
      <label class="f">Goal weight (kg)<input inputmode="decimal" data-in="goal" value="${s.goal ?? ''}" placeholder="e.g. 70"></label></div>
    <div><h3 class="sh">Videos</h3><div class="chips">
      <button class="chip ${s.play === 'inapp' ? 'on' : ''}" data-act="playMode" data-m="inapp">Play inside Lift Log</button>
      <button class="chip ${s.play !== 'inapp' ? 'on' : ''}" data-act="playMode" data-m="app">Open YouTube app</button></div>
      <p class="muted small">${s.play === 'inapp'
        ? 'Videos play in Lift Log’s YouTube player using your YouTube login. Sign in once in Chrome with your Premium account and there are no ads. (iPhone hides the login from web apps, so ads may play there.)'
        : 'Every video opens in the YouTube app at the exact second, signed in with your Premium account.'}</p>
      <a class="btn ghost block" href="${YT_SIGNIN}" target="_blank" rel="noopener" data-act="ytSignin">Sign in to YouTube (Premium account) ↗</a></div>
    <label class="f">My level (which trainer clips to show first)<select data-in="level">${Object.entries(LEVELS).map(([k, l]) => `<option value="${k}" ${k === s.level ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
    <details><summary>Exercises and body parts (${S.ex.length})</summary><div class="list">${[...S.ex].sort((a, b) => a.name.localeCompare(b.name)).map(e =>
      `<label class="li"><span>${esc(e.name)}</span><select class="ex-pick narrow" data-in="exGroup" data-id="${e.id}">${GROUPS.map(g => `<option ${g === e.group ? 'selected' : ''}>${g}</option>`).join('')}</select></label>`).join('')}</div></details>
    <label class="li"><span>Keep the screen on during a workout</span><input type="checkbox" data-in="wake" ${s.wake ? 'checked' : ''}></label>
    <div><h3 class="sh">Look</h3><div class="chips">${['auto', 'light', 'dark'].map(t => `<button class="chip ${s.theme === t ? 'on' : ''}" data-act="theme" data-t="${t}">${t === 'auto' ? 'Match phone' : t[0].toUpperCase() + t.slice(1)}</button>`).join('')}</div></div>
    <div><h3 class="sh">Backup</h3><p class="muted small">Your data lives only on this phone. Save a backup now and then.</p>
      <div class="row"><button class="btn ghost grow" data-act="exportJson">Save backup</button><button class="btn ghost grow" data-act="importJson">Restore backup</button></div>
      <button class="btn ghost block" style="margin-top:8px" data-act="exportCsv">Export sets as CSV</button></div>
    ${isInstalled() ? '' : '<button class="btn block" data-act="install">⬇ Install Lift Log on this phone</button>'}
    <button class="link danger-link" data-act="wipe">Erase all data</button>`);
}

/* ---------- actions ---------- */
const ACT = {
  close: closeSheet,
  settings: openSettings,
  startPlan: b => { const p = planById(b.dataset.id); if (p) startWorkout({ name: p.name, planId: p.id, exIds: p.ex, vid: p.vid, level: p.level, clips: p.clips, target: p.target }); },
  startEmpty: () => startWorkout({ name: 'Workout' }),
  editWeek,
  newPlan: () => { planDraft = null; editPlan(null); },
  editPlan: b => { planDraft = null; editPlan(b.dataset.id); },
  finish,
  discard: () => { if (confirm('Discard this workout? Ticked sets will be lost.')) { S.active = null; save(); stopRest(); unwake(); render(); } },
  tick: b => tick(+b.dataset.i, +b.dataset.j),
  addSet: b => { S.active.items[+b.dataset.i].sets.push({ w: '', r: '', done: false }); save(); render(); },
  addEx: () => pickExercise(id => {
    S.active.items.push({ ex: id, sets: Array.from({ length: Math.max(3, lastSets(id).length) }, () => ({ w: '', r: '', done: false })) });
    save(); closeSheet(); render();
    $(`#ex-${S.active.items.length - 1}`)?.scrollIntoView({ behavior: 'smooth' });
  }),
  exMenu: b => exMenu(+b.dataset.i),
  exMove: b => { const i = +b.dataset.i, j = i + +b.dataset.d, a = S.active.items; [a[i], a[j]] = [a[j], a[i]]; save(); closeSheet(); render(); },
  exSwap: b => { const i = +b.dataset.i; pickExercise(id => { const it = S.active.items[i]; it.ex = id; delete it.stamp; save(); closeSheet(); render(); }, 'Swap for'); },
  delSet: b => { S.active.items[+b.dataset.i].sets.pop(); save(); closeSheet(); render(); },
  delEx: b => { S.active.items.splice(+b.dataset.i, 1); save(); closeSheet(); render(); },
  ytOpen: b => openYT(b.dataset.yt, +b.dataset.t || 0),
  // You sign in on Google's own page (Lift Log never sees your password); Chrome then shares that login with the player.
  ytSignin: () => {
    window.open(YT_SIGNIN, '_blank', 'noopener');
    S.settings.ytSigned = true; save();
    toast('After signing in, come back and replay the video');
  },
  // Ad-free stamping: a link copied in YouTube with "Start at" carries the second of the exercise.
  pasteStamp: async () => {
    const v = vById(curVid);
    let p = null;
    try { p = parseYT(((await navigator.clipboard.readText()).match(/https?:\/\/\S+/) || [''])[0]); } catch (e) { /* no clipboard access */ }
    if (!p) { stampForm(null, 0); $('#sT').focus(); toast('Could not read a link: type the time instead'); return; }
    if (p.id !== v.yt) { toast('That link is for a different video'); return; }
    if (!p.t) toast('No start time in that link: tick “Start at” in YouTube, or type the time');
    stampForm(null, p.t);
  },
  playMode: b => { S.settings.play = b.dataset.m; save(); openSettings(); },
  form: b => openClip(S.active.items[+b.dataset.i]),
  formH: b => { const s = S.sessions.find(x => x.id === b.dataset.id); if (s) openClip(s.items[+b.dataset.i]); },
  clip: b => showClip(+b.dataset.k),
  seek: b => seek(+b.dataset.t),
  // ±5 s on the player; an open stamp form follows, so you can nudge to the exact start of the exercise.
  nudge: b => {
    const t = Math.max(0, playerTime() + +b.dataset.d);
    seek(t); buzz(8);
    const f = $("#sT"); if (f && $("#stampForm")?.innerHTML.trim()) f.value = clock(t);
  },
  pickEx: b => pickCb && pickCb(b.dataset.id),
  pickNew: () => { const q = $('[data-in="exq"]').value; const id = resolveEx(q); save(); pickCb && pickCb(id); },
  openSession: b => openSession(b.dataset.id),
  repeat: b => {
    const s = S.sessions.find(x => x.id === b.dataset.id);
    if (s) startWorkout({ name: s.name, planId: s.planId, exIds: s.items.map(it => it.ex), level: s.level, clips: Object.fromEntries(s.items.filter(it => it.stamp).map(it => [it.ex, it.stamp])), target: s.target || planById(s.planId)?.target });
  },
  delSession: b => { if (!confirm('Delete this workout from history?')) return; S.sessions = S.sessions.filter(s => s.id !== b.dataset.id); save(); closeSheet(); render(); },
  saveBody, editBody: b => { bodyDate = b.dataset.d; render(); scrollTo(0, 0); },
  cancelBody: () => { bodyDate = null; render(); },
  delBody: () => { if (!confirm('Delete this entry?')) return; S.body = S.body.filter(b => b.d !== bodyDate); bodyDate = null; save(); render(); },
  addVideo: () => addVideo(),
  // An empty day: pick one of your videos to stamp from, or add a new one; new stamps default to this day.
  fillPlan: b => { const p = planById(b.dataset.id); if (!p) return; pickVideoFor(p); },
  saveVideo,
  openVideo: b => openVideo(b.dataset.id),
  vFilter: b => { vFilter = b.dataset.t; render(); },
  stampNow: () => { try { player?.pauseVideo?.(); } catch (e) { /* not ready */ } stampForm(null, playerTime()); },
  editStamp: b => { const s = vById(curVid).stamps.find(x => x.id === b.dataset.id); if (s) { stampForm(s, s.t); seek(s.t); } },
  cancelStamp: () => { $('#stampForm').innerHTML = ''; },
  saveStamp: b => {
    const r = stampFromForm(vById(curVid), b.dataset.id);
    if (!r) return;
    $('#stampForm').innerHTML = ''; renderStamps(); render(); buzz([20, 30, 20]);
    toast(`Stamped ${exName(r.ex)} at ${clock(r.t)}${r.p ? ` → ${r.p.name}` : ''}`);
    try { player?.playVideo?.(); } catch (e) { /* not ready */ }
  },
  pasteLink: async () => {
    try {
      const txt = await navigator.clipboard.readText();
      const link = (txt.match(/https?:\/\/\S+/) || [txt.trim()])[0];
      $('#vUrl').value = link;
      lookupVideo();
      if (!parseYT(link)) toast('The copied text is not a YouTube link');
    } catch (e) { $('#vUrl').focus(); toast('Long-press the box and tap Paste'); }
  },
  delStamp: b => { const v = vById(curVid); v.stamps = v.stamps.filter(x => x.id !== b.dataset.id); save(); $('#stampForm').innerHTML = ''; renderStamps(); },
  readChap: () => {
    const rows = parseChapters($('#chap').value);
    if (!rows.length) { $('#chapPrev').innerHTML = '<p class="muted small">No timestamps found. Lines should start or end with a time like 2:15.</p>'; return; }
    const lvOpts = l => `<option value="">All</option>${Object.entries(LEVELS).map(([k, x]) => `<option value="${k}" ${k === l ? 'selected' : ''}>${x}</option>`).join('')}`;
    $('#chapPrev').innerHTML = `<p class="muted small">Check the names, body parts and levels. Untick anything that is not an exercise.</p>
      ${rows.map(r => {
        const hit = findEx(r.name);
        return `<div class="chrow"><input type="checkbox" checked aria-label="Include"><input class="cT" ${timeAttrs} value="${clock(r.t)}"><input class="cN" list="exList" value="${esc(hit?.name || r.name)}">
          <span></span><select class="cG">${GROUPS.map(g => `<option ${g === (hit?.group || guessGroup(r.name)) ? 'selected' : ''}>${g}</option>`).join('')}</select><select class="cL">${lvOpts(r.level || vLevel)}</select></div>`;
      }).join('')}
      <button class="btn block" data-act="addChap">Add ${rows.length} stamps</button>`;
  },
  addChap: () => {
    const v = vById(curVid);
    let n = 0;
    document.querySelectorAll('#chapPrev .chrow').forEach(r => {
      if (!r.querySelector('[type=checkbox]').checked) return;
      const t = parseClock(r.querySelector('.cT').value), ex = resolveEx(r.querySelector('.cN').value), level = r.querySelector('.cL').value;
      if (t == null || !ex) return;
      exById(ex).group = r.querySelector('.cG').value;
      if (v.stamps.some(s => s.t === t && s.ex === ex)) return;
      v.stamps.push({ id: uid(), t, ex, note: '', level }); n++;
    });
    save(); renderStamps(); $('#chapPrev').innerHTML = ''; $('#chap').value = ''; toast(`${n} stamps added`);
  },
  vLevel: b => { vLevel = b.dataset.l; renderStamps(); },
  vidWorkout: () => {
    const v = vById(curVid), ids = videoExIds(v, vLevel);
    if (!ids.length) { toast('Stamp at least one exercise first'); return; }
    startWorkout({ name: `${v.trainer || 'Video'}${vLevel ? ' · ' + LEVELS[vLevel] : ''}`, exIds: ids, vid: v.id, level: vLevel });
  },
  vidPlan: () => {
    const v = vById(curVid), ids = videoExIds(v, vLevel);
    if (!ids.length) { toast('Stamp at least one exercise first'); return; }
    const name = prompt('Name this workout', (v.trainer ? v.trainer + ' – ' : '') + v.title.slice(0, 24) + (vLevel ? ` (${LEVELS[vLevel]})` : ''));
    if (!name) return;
    S.plans.push({ id: uid(), name: name.trim(), ex: ids, vid: v.id, ...(vLevel ? { level: vLevel } : {}) });
    save(); toast('Saved. Add it to a day in your weekly plan'); render();
  },
  saveVidInfo: () => { const v = vById(curVid); v.title = $('#veTitle').value.trim() || v.title; v.trainer = $('#veTrainer').value.trim(); save(); openVideo(v.id, playerTime()); render(); },
  delVideo: () => {
    if (!confirm('Delete this video and its stamps?')) return;
    S.videos = S.videos.filter(v => v.id !== curVid);
    S.plans.forEach(p => { if (p.vid === curVid) delete p.vid; if (p.clips) Object.keys(p.clips).forEach(k => { if (p.clips[k].v === curVid) delete p.clips[k]; }); });
    save(); closeSheet(); render();
  },
  pMove: b => { planDraft.name = $('#pName').value; const k = +b.dataset.k, j = k + +b.dataset.d, a = planDraft.ex; if (j < 0 || j >= a.length) return; [a[k], a[j]] = [a[j], a[k]]; editPlan(planDraft.id === 'new' ? null : planDraft.id); },
  pDel: b => { planDraft.name = $('#pName').value; planDraft.ex.splice(+b.dataset.k, 1); editPlan(planDraft.id === 'new' ? null : planDraft.id); },
  pAdd: () => { planDraft.name = $('#pName').value; pickExercise(id => { planDraft.ex.push(id); editPlan(planDraft.id === 'new' ? null : planDraft.id); }); },
  savePlan: () => {
    const name = $('#pName').value.trim();
    if (!name) { toast('Give the workout a name'); return; }
    if (!planDraft.ex.length) { toast('Add at least one exercise'); return; }
    if (planDraft.id === 'new') S.plans.push({ ...planDraft, id: uid(), name });
    else Object.assign(planById(planDraft.id), { name, ex: planDraft.ex });
    planDraft = null; save(); closeSheet(); render();
  },
  delPlan: () => {
    if (!confirm('Delete this workout? Your history stays.')) return;
    S.plans = S.plans.filter(p => p.id !== planDraft.id);
    S.week = S.week.map(id => (id === planDraft.id ? null : id));
    planDraft = null; save(); closeSheet(); render();
  },
  theme: b => { S.settings.theme = b.dataset.t; save(); applyTheme(); openSettings(); },
  who: whoSheet,
  switchTo: b => switchPerson(b.dataset.id),
  exKind: b => { const x = exById(S.active.items[+b.dataset.i].ex); if (x) { x.kind = b.dataset.k; save(); closeSheet(); render(); } },
  exportJson: () => download(`lift-log-${person}-backup-${isoDay(Date.now())}.json`, JSON.stringify({ ...S, person }, null, 1), 'application/json'),
  importJson: () => $('#importFile').click(),
  exportCsv: () => {
    const q = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const rows = [['person', 'date', 'workout', 'exercise', 'set', 'weight_kg', 'reps', 'seconds']];
    S.sessions.forEach(s => s.items.forEach(it => {
      const time = kindOf(it.ex) === 'time';
      it.sets.forEach((x, k) => rows.push([me().name, isoDay(s.start), s.name, exName(it.ex), k + 1, x.w || 0, time ? '' : x.r, time ? x.r : '']));
    }));
    download(`lift-log-${person}-sets-${isoDay(Date.now())}.csv`, rows.map(r => r.map(q).join(',')).join('\n'), 'text/csv');
  },
  install: async () => {
    buzz();
    // Chrome/Edge on Android or desktop: the browser's own one-tap install box.
    if (installEvt) {
      closeSheet();
      installEvt.prompt();
      const { outcome } = await installEvt.userChoice;
      installEvt = null;
      if (outcome !== 'accepted') toast('Not installed. Tap Install app again any time');
      return;
    }
    installSteps();
  },
  hideInstall: () => { try { localStorage.setItem('liftlog.installHide', '1'); } catch (e) { /* private mode */ } render(); },
  wipe: () => {
    if (!confirm('Erase every workout, video and weigh-in on this phone?')) return;
    if (!confirm('Really erase everything? This cannot be undone.')) return;
    S = defaults(); save(); closeSheet(); render();
  },
};

function saveBody() {
  const d = $('#bD').value || isoDay(Date.now());
  const e = { d }, w = num($('#bW').value);
  if (w) e.w = w;
  MEAS.forEach(([k]) => { const v = num($('#bm-' + k).value); if (v) e[k] = v; });
  if (Object.keys(e).length === 1) { toast('Enter your weight or a measurement'); return; }
  if (bodyDate && bodyDate !== d) S.body = S.body.filter(b => b.d !== bodyDate);
  const i = S.body.findIndex(b => b.d === d);
  if (i >= 0) S.body[i] = e; else S.body.push(e);
  S.body.sort((a, b) => (a.d < b.d ? -1 : 1));
  bodyDate = null; save(); render(); toast('Saved');
}

function download(name, text, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
$('#importFile').addEventListener('change', async e => {
  const f = e.target.files[0];
  e.target.value = '';
  if (!f) return;
  try {
    const d = JSON.parse(await f.text());
    if (!Array.isArray(d.sessions) || !Array.isArray(d.ex)) throw new Error('bad');
    if (!confirm(`Replace what is on this phone with the backup (${d.sessions.length} workouts)?`)) return;
    S = { ...defaults(), ...d, settings: { ...defaults().settings, ...d.settings } };
    save(); applyTheme(); closeSheet(); render(); toast('Backup restored');
  } catch (err) { toast('That file is not a Lift Log backup'); }
});

/* ---------- events ---------- */
document.addEventListener('click', e => {
  const b = e.target.closest('[data-act]');
  if (b && ACT[b.dataset.act]) { e.preventDefault(); ACT[b.dataset.act](b, e); return; }
  const t = e.target.closest('.tabs [data-view]');
  if (t) { bodyDate = null; buzz(8); go(t.dataset.view); }
  const r = e.target.closest('[data-rest]');
  if (r) { const v = r.dataset.rest; if (v === 'stop') stopRest(); else { restEnd += +v * 1000; tickRest(); } }
});
document.addEventListener('input', e => {
  const el = e.target, k = el.dataset.in;
  if (!k) return;
  if (k === 'w' || k === 'r') {
    const s = S.active?.items[+el.dataset.i]?.sets[+el.dataset.j];
    if (!s) return;
    const v = parseFloat(el.value.replace(',', '.'));
    s[k] = isFinite(v) && v >= 0 ? v : '';
    save();
  } else if (k === 'vq') { vQuery = el.value; $('#vlist').innerHTML = videoList(); }
  else if (k === 'exq') { $('#exPick').innerHTML = exPickList(el.value); }
  else if (k === 'ytq') { $('#ytGo').href = ytSearch(el.value); }
});
document.addEventListener('change', e => {
  const el = e.target, k = el.dataset.in;
  if (el.id === 'vUrl') { lookupVideo(); return; }
  if (!k) return;
  if (k === 'progEx') { progEx = el.value; render(); }
  else if (k === 'weekday') { S.week[+el.dataset.d] = el.value || null; save(); render(); }
  else if (k === 'rest') { S.settings.rest = +el.value; save(); }
  else if (k === 'level') { S.settings.level = el.value; save(); }
  else if (k === 'aim') { S.settings.aim = el.value; save(); render(); }
  else if (k === 'exGroup') { const x = exById(el.dataset.id); if (x) { x.group = el.value; save(); render(); } }
  else if (k === 'goal') { S.settings.goal = num(el.value); save(); render(); }
  else if (k === 'wake') { S.settings.wake = el.checked; save(); if (el.checked) wake(); else unwake(); }
});
document.addEventListener('paste', e => { if (e.target.id === 'vUrl') setTimeout(lookupVideo, 0); });
$('#setBtn').addEventListener('click', openSettings);

/* ---------- rest timer, elapsed clock, screen wake ---------- */
let restEnd = 0, restBuzzed = false, restTotal = 90;
function startRest(sec = S.settings.rest) { if (!sec) return; restTotal = sec; restEnd = Date.now() + sec * 1000; restBuzzed = false; tickRest(); }
function stopRest() { restEnd = 0; $('#rest').hidden = true; }
function tickRest() {
  if (!restEnd) return;
  const left = Math.round((restEnd - Date.now()) / 1000);
  if (left < -10) { stopRest(); return; }
  const el = $('#rest');
  el.hidden = false;
  el.classList.toggle('over', left <= 0);
  $('#restTime').textContent = left > 0 ? clock(left) : 'Go!';
  $('#restRing').style.strokeDasharray = `${Math.max(0, Math.min(100, left / restTotal * 100))} 100`;
  if (left <= 0 && !restBuzzed) { restBuzzed = true; navigator.vibrate?.([200, 100, 200]); beep(); }
}
function beep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)(), o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.value = 880;
    g.gain.setValueAtTime(0.2, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    o.connect(g).connect(ctx.destination);
    o.start(); o.stop(ctx.currentTime + 0.5);
    o.onended = () => ctx.close();
  } catch (e) { /* no audio */ }
}
setInterval(() => {
  tickRest();
  const el = $('#elapsed');
  if (el && S.active) el.textContent = clock((Date.now() - S.active.start) / 1000);
}, 500);

let wakeLock = null;
async function wake() {
  if (!S.active || !S.settings.wake || !('wakeLock' in navigator) || document.hidden) return;
  try { wakeLock = await navigator.wakeLock.request('screen'); } catch (e) { /* not allowed here */ }
}
function unwake() { try { wakeLock?.release(); } catch (e) { /* already released */ } wakeLock = null; }
document.addEventListener('visibilitychange', () => { if (!document.hidden) { wake(); tickRest(); } });

/* ---------- misc ---------- */
let toastTimer = 0;
function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 2600);
}
function applyTheme() {
  const t = S.settings.theme;
  if (t === 'auto') delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = t;
  // Each person has their own colours, and their initial on the switch button.
  document.documentElement.dataset.person = person;
  const w = $('#whoBtn');
  if (w) { w.textContent = me().name[0]; w.title = me().name; }
}
function whoSheet() {
  openSheet(`${sheetHead('Who is training?')}
    <div class="people">${PEOPLE.map(p => {
      let st = null;
      try { st = JSON.parse(localStorage.getItem(keyFor(p.id))); } catch (e) { /* nothing saved */ }
      if (p.id === person) st = S;
      const n = st?.sessions?.length || 0, aim = st?.settings?.aim || p.aim;
      return `<button class="person ${p.id === person ? 'on' : ''}" data-act="switchTo" data-id="${p.id}" data-p="${p.id}">
        <span class="av">${p.name[0]}</span><span><b>${p.name}</b><small>${p.mode === 'gym' ? 'Gym · weights' : 'Home · bodyweight'} · ${esc(aim)}</small>
        <small>${n} workout${n === 1 ? '' : 's'} logged${st?.active ? ' · workout in progress' : ''}</small></span>${p.id === person ? '<span class="tag ok">Now</span>' : ''}</button>`;
    }).join('')}</div>
    <p class="muted small">Each person has their own plan, videos, workouts, weights and goals on this phone.</p>`);
}
/* ---------- install ---------- */
const isInstalled = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
function installCard() {
  let hidden = false;
  try { hidden = localStorage.getItem('liftlog.installHide') === '1'; } catch (e) { /* private mode */ }
  if (isInstalled() || hidden) return '';
  return `<section class="card installcard"><img src="icons/icon-192.png" alt="" width="52" height="52">
    <div><b>Get Lift Log on your home screen</b><p>Opens full-screen like a normal app and works offline.</p></div>
    <div class="row"><button class="btn" data-act="install">⬇ Install app</button><button class="link" data-act="hideInstall">Not now</button></div></section>`;
}
// When the browser has no one-tap install box (iPhone, or Android before Chrome offers it), show the steps.
function installSteps() {
  const ua = navigator.userAgent;
  const ios = /iPhone|iPad|iPod/i.test(ua), android = /Android/i.test(ua);
  const iosOther = ios && /CriOS|FxiOS|EdgiOS/i.test(ua);
  let steps;
  if (ios && iosOther) steps = ['Copy this page’s link, then open it in <b>Safari</b> (iPhone can only install from Safari)', 'In Safari, tap <b>Share</b> <span class="key">⬆</span> at the bottom', 'Scroll and tap <b>Add to Home Screen</b>', 'Tap <b>Add</b>'];
  else if (ios) steps = ['Tap <b>Share</b> <span class="key">⬆</span> at the bottom of Safari', 'Scroll down and tap <b>Add to Home Screen</b>', 'Tap <b>Add</b> at the top right', 'Open <b>Lift Log</b> from your home screen'];
  else if (android) steps = ['Tap the <b>⋮</b> menu at the top right of Chrome', 'Tap <b>Install app</b> (or <b>Add to Home screen</b>)', 'Tap <b>Install</b>', 'Open <b>Lift Log</b> from your home screen or app drawer'];
  else steps = ['In Chrome or Edge, click the <b>install icon</b> <span class="key">⊕</span> at the right of the address bar', 'Click <b>Install</b>', 'For your phone, open this link there:<br><b>sagarchakraborty-creator.github.io/lift-log</b>'];
  openSheet(`${sheetHead('Install Lift Log', ios ? 'iPhone' : android ? 'Android' : 'Computer')}
    <ol class="isteps">${steps.map(s => `<li><span>${s}</span></li>`).join('')}</ol>
    ${ios && !iosOther ? '<p class="muted small">The Share button is the square with an arrow, in the bar at the bottom (or top on iPad).</p>' : ''}
    <button class="btn ghost block" data-act="copyLink">Copy app link</button>
    <button class="btn block" data-act="close">Got it</button>`);
}
ACT.copyLink = async () => {
  try { await navigator.clipboard.writeText('https://sagarchakraborty-creator.github.io/lift-log/'); toast('Link copied'); } catch (e) { toast('sagarchakraborty-creator.github.io/lift-log'); }
};
function showInstallBtn() { $('#installBtn').hidden = isInstalled(); }
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e; showInstallBtn(); });
window.addEventListener('appinstalled', () => {
  installEvt = null; showInstallBtn(); render();
  toast('Lift Log installed 🎉 Open it from your home screen'); confetti(120);
});
matchMedia('(display-mode: standalone)').addEventListener?.('change', () => { showInstallBtn(); render(); });

// New versions apply silently: the page reloads once nothing is open or being typed into.
if ('serviceWorker' in navigator) {
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.register('sw.js').then(reg => reg.update()).catch(() => {});
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController) return;
    if (sheet.open || document.activeElement?.matches('input, textarea, select')) pendingReload = true;
    else location.reload();
  });
}

/* ---------- start ---------- */
applyTheme();
showInstallBtn();
const hash = location.hash.slice(1);
if (VIEWS[hash]) view = hash;
// Share → Lift Log from the YouTube app arrives as ?text=… or ?url=… (manifest share_target).
const qp = new URLSearchParams(location.search);
const shared = [qp.get('url'), qp.get('text'), qp.get('title')].filter(Boolean).join(' ');
if (shared) {
  history.replaceState(null, '', location.pathname + '#videos');
  view = 'videos';
}
render();
if (shared) {
  const link = (shared.match(/https?:\/\/\S+/) || [])[0];
  if (link && parseYT(link)) addVideo(link);
  else toast('No YouTube link in what was shared');
}
if (S.active) wake();
