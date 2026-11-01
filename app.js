'use strict';
// Lift Log: gym workouts logged set by set against a weekly plan, body weight and measurements, and
// YouTube trainer videos stamped at the second each exercise is shown, so form clips open at the right spot.
const KEY = 'liftlog.v1';
const DAY = 864e5;
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DOW_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];
// Body parts: each exercise has one main target, used for the weekly coverage card.
const GROUPS = ['Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps', 'Forearms', 'Core', 'Quads', 'Hamstrings', 'Glutes', 'Calves', 'Cardio', 'Other'];
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
const STARTER_PLANS = [
  ['Push', ['Bench press', 'Overhead press', 'Incline dumbbell press', 'Lateral raise', 'Triceps pushdown']],
  ['Pull', ['Deadlift', 'Lat pulldown', 'Barbell row', 'Face pull', 'Biceps curl']],
  ['Legs', ['Squat', 'Romanian deadlift', 'Leg press', 'Leg curl', 'Calf raise']],
];
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
  const ex = STARTER_EX.map(([name, group]) => ({ id: uid(), name, group }));
  const idOf = n => ex.find(e => e.name === n).id;
  const plans = STARTER_PLANS.map(([name, list]) => ({ id: uid(), name, ex: list.map(idOf) }));
  const [push, pull, legs] = plans.map(p => p.id);
  return {
    ex, plans, sessions: [], active: null, body: [], videos: [],
    // week[getDay()] = plan id, or null for a rest day
    week: [null, push, pull, legs, push, pull, legs],
    settings: { goal: null, rest: 90, wake: true, theme: 'auto', level: 'beg' },
  };
}
function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY));
    if (s && Array.isArray(s.sessions)) { const d = defaults(); return { ...d, ...s, settings: { ...d.settings, ...s.settings } }; }
  } catch (e) { /* nothing saved yet */ }
  return defaults();
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
  [/bench|chest|fly|flye|push.?up|pec|incline|decline|press/, 'Chest'],
  [/plank|crunch|sit.?up|ab\b|abs|core|(leg|knee) raise|twist|hollow|dead bug|mountain/, 'Core'],
  [/run|bike|cycle|row(ing)? machine|jump|burpee|skipping|cardio|hiit/, 'Cardio'],
];
const guessGroup = name => (GUESS.find(([re]) => re.test(String(name).toLowerCase())) || [, 'Other'])[1];
function resolveEx(name) {
  name = String(name || '').trim().replace(/\s+/g, ' ');
  if (!name) return null;
  const hit = findEx(name);
  if (hit) return hit.id;
  const e = { id: uid(), name: name[0].toUpperCase() + name.slice(1), group: guessGroup(name) };
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
function bestE1(exId, skipId) {
  let b = 0;
  S.sessions.forEach(s => { if (s.id !== skipId) s.items.forEach(it => { if (it.ex === exId) doneSets(it).forEach(x => { b = Math.max(b, e1rm(x.w, x.r)); }); }); });
  return b;
}
function sessionTotals(s) {
  let sets = 0, vol = 0, prs = 0;
  s.items.forEach(it => doneSets(it).forEach(x => { sets++; vol += (x.w || 0) * (x.r || 0); if (x.pr) prs++; }));
  return { sets, vol, prs };
}
const weekStart = (off = 0) => { const d = startOfDay(); return +d - ((d.getDay() + 6) % 7) * DAY - off * 7 * DAY; };
const sessionsOn = iso => S.sessions.filter(s => isoDay(s.start) === iso);
const lastDone = planId => { for (let i = S.sessions.length - 1; i >= 0; i--) if (S.sessions[i].planId === planId) return S.sessions[i].start; return 0; };

/* ---------- YouTube helpers ---------- */
function parseDur(s) {
  if (/^\d+$/.test(s)) return +s;
  const m = String(s).match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/);
  return m ? (+m[1] || 0) * 3600 + (+m[2] || 0) * 60 + (+m[3] || 0) : 0;
}
function parseClock(s) {
  s = String(s || '').trim();
  if (/^\d+$/.test(s)) return +s;
  if (!/^\d{1,2}(:\d{1,2}){1,2}$/.test(s)) return null;
  return s.split(':').reduce((a, p) => a * 60 + +p, 0);
}
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
    videoId: yt, host: 'https://www.youtube-nocookie.com',
    playerVars: { start: Math.floor(t), autoplay: 1, playsinline: 1, rel: 0, modestbranding: 1 },
  });
}
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

function render() {
  $('#title').textContent = view === 'train' && S.active ? 'Workout' : TITLES[view];
  $('#subtitle').textContent = subtitle();
  $('#main').innerHTML = VIEWS[view]();
  document.querySelectorAll('.tabs button').forEach(b => b.classList.toggle('on', b.dataset.view === view));
}
function go(v) {
  view = v;
  history.replaceState(null, '', '#' + v);
  render();
  scrollTo(0, 0);
}
function subtitle() {
  if (view === 'train') {
    const n = S.sessions.filter(s => s.start >= weekStart()).length;
    return `${fmtDate(Date.now(), { weekday: 'long', day: 'numeric', month: 'short' })} · ${n} workout${n === 1 ? '' : 's'} this week`;
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
  if (doneToday.length) {
    const t = sessionTotals(doneToday[doneToday.length - 1]);
    hero = `<section class="card hero done"><span class="tag ok">Done today</span><h2>${esc(doneToday[doneToday.length - 1].name)}</h2>
      <p class="muted">${t.sets} sets · ${fmtVol(t.vol)} lifted${t.prs ? ` · ${t.prs} new best${t.prs === 1 ? '' : 's'}` : ''}</p>
      <button class="btn ghost" data-act="openSession" data-id="${doneToday[doneToday.length - 1].id}">See workout</button></section>`;
  } else if (plan) {
    const v = plan.vid && vById(plan.vid);
    hero = `<section class="card hero"><span class="tag">Today · ${DOW_LONG[new Date().getDay()]}</span><h2 class="big">${esc(plan.name)}</h2>
      <p class="targets">Targets: ${esc(targets(plan.ex).join(' · ') || '–')}</p>
      ${v ? `<p class="muted small">▶ ${esc(v.trainer || v.title)} ${levelTag(plan.level)}</p>` : ''}
      <ol class="exlist">${plan.ex.map(id => `<li>${esc(exName(id))}${hasClip(id, plan) ? ' <span class="clip">▶</span>' : ''}</li>`).join('')}</ol>
      <button class="btn block big-btn" data-act="startPlan" data-id="${plan.id}">Start ${esc(plan.name)}</button></section>`;
  } else {
    hero = `<section class="card hero"><span class="tag">Today · ${DOW_LONG[new Date().getDay()]}</span><h2 class="big">Rest day</h2>
      <p class="muted">Recover, walk, stretch. Want to train anyway? Pick a workout below.</p></section>`;
  }
  return hero + weekStrip() + coverage() + `
    <section><div class="head"><h2>All workouts</h2><button class="link" data-act="newPlan">+ New</button></div>
    <div class="plans">${S.plans.map(planCard).join('')}</div>
    <button class="btn ghost block" style="margin-top:10px" data-act="startEmpty">Start an empty workout</button></section>`;
}
const hasClip = (exId, plan) => (plan.vid && vById(plan.vid)?.stamps.some(s => s.ex === exId)) || S.videos.some(v => v.stamps.some(s => s.ex === exId));
function weekStrip() {
  const ws = weekStart(), todayIso = isoDay(Date.now());
  const firstIso = S.sessions.length ? isoDay(S.sessions[0].start) : todayIso;
  const cells = WEEK_ORDER.map((dow, i) => {
    const iso = isoDay(ws + i * DAY), p = planById(S.week[dow]), done = sessionsOn(iso).length > 0;
    const st = done ? 'done' : iso === todayIso ? 'today' : iso < todayIso && iso >= firstIso && p ? 'missed' : '';
    return `<div class="wd ${st}"><span>${DOW[dow]}</span><b>${done ? '✓' : st === 'missed' ? '✕' : ''}</b><small>${p ? esc(p.name) : 'Rest'}</small></div>`;
  }).join('');
  return `<section class="card"><div class="head"><h2>This week</h2><button class="link" data-act="editWeek">Edit week</button></div><div class="week">${cells}</div></section>`;
}
// Sets done per body part this week, the days your plan trains each one, and the ones it never trains.
function coverage() {
  const ws = weekStart(), done = {}, planned = {};
  S.sessions.forEach(s => { if (s.start >= ws) s.items.forEach(it => { const g = exById(it.ex)?.group; if (g) done[g] = (done[g] || 0) + doneSets(it).length; }); });
  WEEK_ORDER.forEach(d => { const p = planById(S.week[d]); if (p) targets(p.ex).forEach(g => { (planned[g] = planned[g] || []).push(DOW[d]); }); });
  const main = GROUPS.filter(g => !['Forearms', 'Cardio', 'Other'].includes(g));
  const missing = main.filter(g => !planned[g] && !done[g]);
  const rows = main.filter(g => planned[g] || done[g]).map(g => {
    const n = done[g] || 0;
    return `<div class="bp"><span>${g}</span><span class="muted small">${planned[g] ? [...new Set(planned[g])].join(', ') : 'Not planned'}</span>
      <b class="${n ? 'ok' : ''}">${n ? `${n} set${n === 1 ? '' : 's'}` : '–'}</b></div>`;
  }).join('');
  return `<section class="card"><div class="head"><h2>Body parts this week</h2></div>
    <div class="bps"><div class="bp hdr"><span>Body part</span><span>Planned on</span><b>Done</b></div>${rows}</div>
    ${missing.length ? `<p class="miss">Not in your week: <b>${missing.join(', ')}</b>. Add an exercise for ${missing.length === 1 ? 'it' : 'them'} to one of your workouts.</p>` : '<p class="muted small">Your week trains every major body part.</p>'}</section>`;
}
function planCard(p) {
  const v = p.vid && vById(p.vid);
  const days = WEEK_ORDER.filter(d => S.week[d] === p.id).map(d => DOW[d]);
  const names = p.ex.map(exName);
  return `<button class="plan" data-act="startPlan" data-id="${p.id}">
    <h3>${esc(p.name)} ${days.length ? `<span class="tag">${days.join(' · ')}</span>` : ''}</h3>
    <p class="targets">${esc(targets(p.ex).join(' · '))}</p>
    <p>${esc(names.slice(0, 4).join(', '))}${names.length > 4 ? ` +${names.length - 4}` : ''}</p>
    <p>${v ? `▶ ${esc(v.trainer || 'Video')} ${p.level ? `(${LEVELS[p.level]})` : ''} · ` : ''}${ago(lastDone(p.id))}</p>
    <span class="go">Start ›</span></button>`;
}

/* Active workout */
function viewActive() {
  const A = S.active;
  return `<section class="card live"><div><h2>${esc(A.name)}</h2>
      <span class="muted small">Started ${new Date(A.start).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })} · <span id="elapsed" class="num">${clock((Date.now() - A.start) / 1000)}</span></span></div>
      <button class="btn amber" data-act="finish">Finish</button></section>
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
  return `<section class="card ex" id="ex-${i}"><div class="head"><div><h3>${esc(exName(it.ex))}</h3><span class="muted small">${esc(exById(it.ex)?.group || '')}</span></div>
      ${clips.length ? `<button class="btn ghost small" data-act="form" data-i="${i}">▶ Form${it.stamp ? ` ${clock(it.stamp.t)}` : ''}</button>` : ''}</div>
    <p class="last">${lt ? `<b>Last time (${fmtDate(lt.date, { day: 'numeric', month: 'short' })}):</b> ` + last.map(s => `${fmtKg(s.w || 0)} kg × ${s.r}`).join(', ') : 'First time: pick a weight you can do with good form'}</p>
    <div class="sets"><div class="set hdr"><span class="n">Set</span><span>kg</span><span>Reps</span><span></span></div>
    ${it.sets.map((s, j) => {
      const ph = placeholder(it, j, last);
      return `<div class="set ${s.done ? 'done' : ''}"><span class="n ${s.pr ? 'pr' : ''}">${s.pr ? '★' : j + 1}</span>
        <input inputmode="decimal" enterkeyhint="next" data-in="w" data-i="${i}" data-j="${j}" value="${s.w === '' || s.w == null ? '' : s.w}" placeholder="${ph.w ?? ''}" aria-label="Weight in kg, set ${j + 1}">
        <input inputmode="numeric" enterkeyhint="done" data-in="r" data-i="${i}" data-j="${j}" value="${s.r === '' || s.r == null ? '' : s.r}" placeholder="${ph.r ?? ''}" aria-label="Reps, set ${j + 1}">
        <button class="tick" data-act="tick" data-i="${i}" data-j="${j}" aria-label="Set ${j + 1} done">✓</button></div>`;
    }).join('')}</div>
    <div class="ex-foot"><button class="link" data-act="addSet" data-i="${i}">+ Add set</button><button class="link muted" data-act="exMenu" data-i="${i}">More</button></div></section>`;
}

/* Videos */
function viewVideos() {
  const trainers = [...new Set(S.videos.map(v => v.trainer).filter(Boolean))].sort();
  if (!S.videos.length) {
    return `<section class="card empty"><b>Your trainers' videos</b>
      Add a YouTube workout video, then tap <b class="inline">⏱ Stamp</b> while it plays to mark when each exercise is shown.
      In your workout, <b class="inline">▶ Form</b> opens the video at that exact second.<br><br>
      <button class="btn" data-act="addVideo">+ Add video</button>
      <p class="small">Tip: once the app is installed on Android, use Share → Lift Log from the YouTube app.</p></section>`;
  }
  return `<div class="row"><input class="search grow" type="search" placeholder="Search videos or exercises" data-in="vq" value="${esc(vQuery)}">
    <button class="btn" data-act="addVideo">+ Add</button></div>
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
      <p>${s.items.length} exercises · ${t.sets} sets · ${fmtVol(t.vol)}${mins ? ` · ${mins} min` : ''}</p></div></button>`;
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
  const weeks = Array.from({ length: 8 }, (_, k) => 7 - k).map(off => {
    const a = weekStart(off), b = a + 7 * DAY;
    let vol = 0, n = 0;
    S.sessions.forEach(s => { if (s.start >= a && s.start < b) { n++; vol += sessionTotals(s).vol; } });
    return { vol, n, label: fmtDate(a, { day: 'numeric', month: 'short' }) };
  });
  const used = exUsage();
  if (!progEx || !used.some(([id]) => id === progEx)) progEx = used[0]?.[0];
  let exBlock = '';
  if (progEx) {
    const pts = [];
    let heavy = null, best = null;
    S.sessions.forEach(s => s.items.forEach(it => {
      if (it.ex !== progEx) return;
      let top = null;
      doneSets(it).forEach(x => {
        const e = e1rm(x.w, x.r);
        if (!top || e > top.e) top = { e, w: x.w, r: x.r };
        if (!heavy || x.w > heavy.w) heavy = x;
        if (!best || e > best.e) best = { e, w: x.w, r: x.r, d: s.start };
      });
      if (top && top.e > 0) pts.push({ x: s.start, y: top.e, w: top.w, r: top.r });
    }));
    exBlock = `<section class="card"><select class="ex-pick" data-in="progEx" aria-label="Exercise">
      ${used.map(([id, n]) => `<option value="${id}" ${id === progEx ? 'selected' : ''}>${esc(exName(id))} (${n})</option>`).join('')}</select>
      <div class="stats" style="margin-top:10px">
        <div class="stat"><b>${best ? fmtKg(best.e) : '–'}<small>kg</small></b><span>Est. 1-rep max</span></div>
        <div class="stat"><b>${heavy ? fmtKg(heavy.w) : '–'}<small>kg</small></b><span>Heaviest set</span></div>
        <div class="stat"><b>${pts.length}</b><span>Sessions</span></div></div>
      ${pts.length > 1 ? `<h3 class="ch">Est. 1-rep max per session (kg)</h3><div class="chart">${lineChart({ pts })}</div>` : '<p class="muted small">Do this exercise twice to see a trend.</p>'}
      <div class="list">${pts.slice(-5).reverse().map(p => `<div class="li"><span>${fmtDate(p.x)}</span><span class="r">${fmtKg(p.w)} kg × ${p.r} <span class="muted">≈ ${fmtKg(p.y)} kg</span></span></div>`).join('')}</div></section>`;
  }
  const board = used.map(([id]) => {
    let b = null;
    S.sessions.forEach(s => s.items.forEach(it => { if (it.ex === id) doneSets(it).forEach(x => { const e = e1rm(x.w, x.r); if (!b || e > b.e) b = { e, w: x.w, r: x.r }; }); }));
    return b && b.e ? `<div class="li"><span>${esc(exName(id))}</span><span class="r">${fmtKg(b.w)} kg × ${b.r}</span></div>` : '';
  }).join('');
  return exBlock + `<section class="card"><h2>Weekly volume (kg lifted)</h2><div class="chart">${barChart(weeks.map(w => w.vol), weeks.map(w => w.label), fmtVol)}</div>
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
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Trend chart">
    <text x="${L - 6}" y="${Y(hi) + 4}" text-anchor="end">${fmtKg(hi)}</text>
    <text x="${L - 6}" y="${Y(lo) + 4}" text-anchor="end">${fmtKg(lo)}</text>
    ${goal ? `<line class="goal" x1="${L}" x2="${W - R}" y1="${Y(goal)}" y2="${Y(goal)}"/>` : ''}
    ${avg ? pts.map(p => `<circle class="dot faint" cx="${X(p.x)}" cy="${Y(p.y)}" r="3"/>`).join('') : ''}
    <path class="ln" d="${path(avg || pts)}"/>
    ${avg ? '' : pts.map(p => `<circle class="dot" cx="${X(p.x)}" cy="${Y(p.y)}" r="3.5"/>`).join('')}
    <text x="${L}" y="${H - 4}">${dl(x0)}</text><text x="${W - R}" y="${H - 4}" text-anchor="end">${dl(x1)}</text></svg>`;
}
function barChart(vals, labels, fmt) {
  const W = 340, H = 150, T = 18, B = 20, n = vals.length, gap = 8, bw = (W - gap * (n - 1)) / n;
  const max = Math.max(...vals, 1);
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Bar chart">${vals.map((v, i) => {
    const h = v / max * (H - T - B), x = i * (bw + gap), y = H - B - h;
    return `<rect class="bar ${i === n - 1 ? 'now' : ''}" x="${x}" y="${y}" width="${bw}" height="${Math.max(h, v ? 2 : 0)}" rx="4"/>
      ${v ? `<text x="${x + bw / 2}" y="${y - 5}" text-anchor="middle">${fmt(v)}</text>` : ''}
      <text x="${x + bw / 2}" y="${H - 5}" text-anchor="middle">${i === n - 1 ? 'This wk' : i % 2 ? '' : labels[i]}</text>`;
  }).join('')}</svg>`;
}

/* ---------- workout actions ---------- */
function startWorkout({ name, planId = null, exIds = [], vid = null, level = '' }) {
  if (S.active && !confirm('A workout is already running. Replace it?')) return;
  const v = vid && vById(vid);
  S.active = {
    id: uid(), start: Date.now(), name, planId, ...(level ? { level } : {}),
    items: exIds.map(ex => {
      const st = v && pickStamp(v, ex, level);
      return { ex, sets: Array.from({ length: Math.max(3, lastSets(ex).length) }, () => ({ w: '', r: '', done: false })), ...(st ? { stamp: { v: v.id, t: st.t } } : {}) };
    }),
  };
  save(); closeSheet(); go('train'); wake();
}
function tick(i, j) {
  const A = S.active, it = A.items[i], s = it.sets[j];
  if (s.done) { s.done = false; s.pr = false; save(); render(); return; }
  const ph = placeholder(it, j, lastSets(it.ex, A.id));
  if (s.w === '' || s.w == null) s.w = ph.w === '' ? 0 : +ph.w;
  if (s.r === '' || s.r == null) s.r = ph.r === '' ? '' : +ph.r;
  if (!(s.r > 0)) { toast('Enter the reps first'); return; }
  s.done = true;
  const best = bestE1(it.ex, A.id), e = e1rm(s.w, s.r);
  const inSession = Math.max(0, ...it.sets.filter(x => x !== s && x.done).map(x => e1rm(x.w, x.r)));
  if (best > 0 && e > best && e > inSession) {
    it.sets.forEach(x => { x.pr = false; });
    s.pr = true;
    toast(`★ New best: ${exName(it.ex)} ${fmtKg(s.w)} kg × ${s.r}`);
  }
  save(); render(); startRest();
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
sheet.addEventListener('close', () => { killPlayer(); if (pendingReload) location.reload(); });
sheet.addEventListener('click', e => { if (e.target === sheet) closeSheet(); });
const sheetHead = (title, sub = '') => `<div class="head"><div><h2>${title}</h2>${sub ? `<p class="muted small">${sub}</p>` : ''}</div><button class="x" data-act="close" aria-label="Close">✕</button></div>`;
const exDatalist = () => `<datalist id="exList">${S.ex.map(e => `<option value="${esc(e.name)}">`).join('')}</datalist>`;

function openSession(id, justDone = false) {
  const s = S.sessions.find(x => x.id === id);
  if (!s) return;
  const t = sessionTotals(s), mins = s.end ? Math.round((s.end - s.start) / 60000) : 0;
  openSheet(`${sheetHead(justDone ? 'Workout saved' : esc(s.name), `${justDone ? esc(s.name) + ' · ' : ''}${fmtDate(s.start)}${mins ? ` · ${mins} min` : ''}`)}
    <div class="stats"><div class="stat"><b>${t.sets}</b><span>Sets</span></div><div class="stat"><b>${fmtVol(t.vol).replace(/ (kg|t)$/, '<small>$1</small>')}</b><span>Lifted</span></div><div class="stat ${t.prs ? 'down' : ''}"><b>${t.prs}</b><span>New bests</span></div></div>
    ${s.items.map((it, i) => `<div><div class="head"><h3 class="sh">${esc(exName(it.ex))}</h3>${clipsFor(it).length ? `<button class="btn ghost small" data-act="formH" data-id="${s.id}" data-i="${i}">▶ ${it.stamp ? clock(it.stamp.t) : 'Form'}</button>` : ''}</div><div class="list">${it.sets.map((x, k) =>
      `<div class="li"><span class="muted">Set ${k + 1}</span><span class="r">${fmtKg(x.w || 0)} kg × ${x.r}${x.pr ? ' <span class="tag pr">★ Best</span>' : ''}</span></div>`).join('')}</div></div>`).join('')}
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
    <button class="btn ghost block" data-act="delSet" data-i="${i}" ${it.sets.length <= 1 ? 'disabled' : ''}>Remove last set</button>
    <button class="btn danger block" data-act="delEx" data-i="${i}">Remove exercise</button>`);
}

let curClips = [];
function openClip(it) {
  curClips = clipsFor(it);
  if (!curClips.length) return;
  openSheet(`${sheetHead(esc(exName(it.ex)))}<div class="vid" id="vp"></div><div id="clipInfo"></div>
    ${curClips.length > 1 ? `<div><h3 class="sh">Other trainers</h3><div class="list">${curClips.map((c, k) =>
      `<button class="li" data-act="clip" data-k="${k}"><span>${esc(c.v.trainer || c.v.title)} ${levelTag(c.level)}</span><span class="r muted">${clock(c.t)}</span></button>`).join('')}</div></div>` : ''}`,
  () => showClip(0));
}
function showClip(k) {
  const c = curClips[k];
  $('#clipInfo').innerHTML = `<p class="small"><b>${esc(c.v.trainer || 'Video')}</b> ${levelTag(c.level)} · ${esc(c.v.title)} · at ${clock(c.t)}</p>
    ${c.note ? `<p class="note">${esc(c.note)}</p>` : ''}
    <div class="row"><button class="btn ghost small" data-act="seek" data-t="${c.t}">↺ Back to ${clock(c.t)}</button>
    <a class="btn ghost small" href="${watchUrl(c.v.yt, c.t)}" target="_blank" rel="noopener">Open in YouTube ↗</a></div>`;
  mountPlayer($('#vp'), c.v.yt, c.t);
}

/* Video sheets: add, watch and stamp */
function addVideo(prefill = '') {
  const trainers = [...new Set(S.videos.map(v => v.trainer).filter(Boolean))];
  openSheet(`${sheetHead('Add a video')}
    <label class="f">YouTube link<input id="vUrl" type="url" inputmode="url" placeholder="https://youtu.be/…" value="${esc(prefill)}" autocomplete="off"></label>
    <label class="f">Trainer<input id="vTrainer" list="trainerList" placeholder="Fills in from YouTube"></label>
    <datalist id="trainerList">${trainers.map(t => `<option value="${esc(t)}">`).join('')}</datalist>
    <label class="f">Title<input id="vTitle" placeholder="Fills in from YouTube"></label>
    <button class="btn block" data-act="saveVideo">Save and start stamping</button>`, () => { if (prefill) lookupVideo(); });
}
async function lookupVideo() {
  const p = parseYT($('#vUrl')?.value);
  if (!p) return;
  const info = await ytInfo(p.id);
  if (!info) return;
  if ($('#vTitle') && !$('#vTitle').value) $('#vTitle').value = info.title || '';
  if ($('#vTrainer') && !$('#vTrainer').value) $('#vTrainer').value = info.author_name || '';
}
function saveVideo() {
  const p = parseYT($('#vUrl').value);
  if (!p) { toast('That does not look like a YouTube link'); return; }
  let v = S.videos.find(x => x.yt === p.id);
  if (!v) {
    v = { id: uid(), yt: p.id, title: $('#vTitle').value.trim() || 'YouTube video', trainer: $('#vTrainer').value.trim(), added: Date.now(), stamps: [] };
    S.videos.push(v);
    save();
    if (view === 'videos') render();
  } else toast('Already saved: opening it');
  openVideo(v.id, p.t);
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
  openSheet(`${sheetHead(esc(v.title), esc(v.trainer || ''))}
    <div class="vid" id="vp"></div>
    <div class="row"><button class="btn grow" data-act="stampNow">⏱ Stamp at <span id="nowT" class="num">0:00</span></button>
      <a class="btn ghost" href="${watchUrl(v.yt)}" target="_blank" rel="noopener">YouTube ↗</a></div>
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
      <button class="tchip" data-act="seek" data-t="${s.t}">▶ ${clock(s.t)}</button>
      <div class="grow"><b>${esc(exName(s.ex))}</b> ${vLevel ? '' : levelTag(s.level)}<br><span class="muted small">${esc(exById(s.ex)?.group || '')}${s.note ? ` · ${esc(s.note)}` : ''}</span></div>
      <button class="link" data-act="editStamp" data-id="${s.id}">Edit</button></div>`).join('')
    : `<p class="muted small">${v.stamps.length ? 'Nothing stamped at this level yet.' : 'None yet. Play the video and tap ⏱ Stamp when an exercise starts.'}</p>`;
}
const groupSelect = (id, val) => `<select id="${id}">${GROUPS.map(g => `<option ${g === val ? 'selected' : ''}>${g}</option>`).join('')}</select>`;
function stampForm(s, t) {
  const lv = s ? s.level || '' : vLevel;
  $('#stampForm').innerHTML = `<div class="inset"><div class="grid2">
      <label class="f">Time<input id="sT" inputmode="numeric" value="${clock(t)}"></label>
      <label class="f">Exercise<input id="sEx" list="exList" value="${s ? esc(exName(s.ex)) : ''}" placeholder="e.g. Bench press" autocomplete="off"></label>
      <label class="f">Body part${groupSelect('sGroup', s ? exById(s.ex)?.group : 'Chest')}</label>
      <label class="f">Level<select id="sLevel"><option value="">All levels</option>${Object.entries(LEVELS).map(([k, l]) => `<option value="${k}" ${k === lv ? 'selected' : ''}>${l}</option>`).join('')}</select></label></div>
    <label class="f">Note (sets, reps, cues)<input id="sNote" value="${esc(s?.note || '')}" placeholder="e.g. 3 × 10, slow negatives"></label>
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
  openSheet(`${sheetHead('Settings')}
    <div><h3 class="sh">Workouts</h3><div class="list">
      <button class="li" data-act="editWeek"><span>Weekly plan</span><span class="r muted">${WEEK_ORDER.map(d => planById(S.week[d]) ? DOW[d][0] : '·').join(' ')} ›</span></button>
      ${S.plans.map(p => `<button class="li" data-act="editPlan" data-id="${p.id}"><span>${esc(p.name)}</span><span class="r muted">${p.ex.length} exercises ›</span></button>`).join('')}
      <button class="li" data-act="newPlan"><b>+ New workout</b></button></div></div>
    <div class="grid2"><label class="f">Rest timer<select data-in="rest">${[0, 45, 60, 90, 120, 150, 180, 240].map(v => `<option value="${v}" ${v === s.rest ? 'selected' : ''}>${v ? clock(v) + ' min' : 'Off'}</option>`).join('')}</select></label>
      <label class="f">Goal weight (kg)<input inputmode="decimal" data-in="goal" value="${s.goal ?? ''}" placeholder="e.g. 70"></label></div>
    <label class="f">My level (which trainer clips to show first)<select data-in="level">${Object.entries(LEVELS).map(([k, l]) => `<option value="${k}" ${k === s.level ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
    <details><summary>Exercises and body parts (${S.ex.length})</summary><div class="list">${[...S.ex].sort((a, b) => a.name.localeCompare(b.name)).map(e =>
      `<label class="li"><span>${esc(e.name)}</span><select class="ex-pick narrow" data-in="exGroup" data-id="${e.id}">${GROUPS.map(g => `<option ${g === e.group ? 'selected' : ''}>${g}</option>`).join('')}</select></label>`).join('')}</div></details>
    <label class="li"><span>Keep the screen on during a workout</span><input type="checkbox" data-in="wake" ${s.wake ? 'checked' : ''}></label>
    <div><h3 class="sh">Look</h3><div class="chips">${['auto', 'light', 'dark'].map(t => `<button class="chip ${s.theme === t ? 'on' : ''}" data-act="theme" data-t="${t}">${t === 'auto' ? 'Match phone' : t[0].toUpperCase() + t.slice(1)}</button>`).join('')}</div></div>
    <div><h3 class="sh">Backup</h3><p class="muted small">Your data lives only on this phone. Save a backup now and then.</p>
      <div class="row"><button class="btn ghost grow" data-act="exportJson">Save backup</button><button class="btn ghost grow" data-act="importJson">Restore backup</button></div>
      <button class="btn ghost block" style="margin-top:8px" data-act="exportCsv">Export sets as CSV</button></div>
    ${installEvt ? '<button class="btn block" data-act="install">Install Lift Log on this phone</button>' : ''}
    <button class="link danger-link" data-act="wipe">Erase all data</button>`);
}

/* ---------- actions ---------- */
const ACT = {
  close: closeSheet,
  settings: openSettings,
  startPlan: b => { const p = planById(b.dataset.id); if (p) startWorkout({ name: p.name, planId: p.id, exIds: p.ex, vid: p.vid, level: p.level }); },
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
  form: b => openClip(S.active.items[+b.dataset.i]),
  formH: b => { const s = S.sessions.find(x => x.id === b.dataset.id); if (s) openClip(s.items[+b.dataset.i]); },
  clip: b => showClip(+b.dataset.k),
  seek: b => seek(+b.dataset.t),
  pickEx: b => pickCb && pickCb(b.dataset.id),
  pickNew: () => { const q = $('[data-in="exq"]').value; const id = resolveEx(q); save(); pickCb && pickCb(id); },
  openSession: b => openSession(b.dataset.id),
  repeat: b => {
    const s = S.sessions.find(x => x.id === b.dataset.id);
    if (s) startWorkout({ name: s.name, planId: s.planId, exIds: s.items.map(it => it.ex), vid: s.items.find(it => it.stamp)?.stamp.v, level: s.level });
  },
  delSession: b => { if (!confirm('Delete this workout from history?')) return; S.sessions = S.sessions.filter(s => s.id !== b.dataset.id); save(); closeSheet(); render(); },
  saveBody, editBody: b => { bodyDate = b.dataset.d; render(); scrollTo(0, 0); },
  cancelBody: () => { bodyDate = null; render(); },
  delBody: () => { if (!confirm('Delete this entry?')) return; S.body = S.body.filter(b => b.d !== bodyDate); bodyDate = null; save(); render(); },
  addVideo: () => addVideo(),
  saveVideo,
  openVideo: b => openVideo(b.dataset.id),
  vFilter: b => { vFilter = b.dataset.t; render(); },
  stampNow: () => { try { player?.pauseVideo?.(); } catch (e) { /* not ready */ } stampForm(null, playerTime()); },
  editStamp: b => { const s = vById(curVid).stamps.find(x => x.id === b.dataset.id); if (s) { stampForm(s, s.t); seek(s.t); } },
  cancelStamp: () => { $('#stampForm').innerHTML = ''; },
  saveStamp: b => {
    const v = vById(curVid), t = parseClock($('#sT').value), ex = resolveEx($('#sEx').value);
    if (t == null) { toast('Time should look like 4:35'); return; }
    if (!ex) { toast('Type the exercise name'); return; }
    exById(ex).group = $('#sGroup').value;
    const note = $('#sNote').value.trim(), level = $('#sLevel').value, old = v.stamps.find(x => x.id === b.dataset.id);
    if (old) Object.assign(old, { t, ex, note, level }); else v.stamps.push({ id: uid(), t, ex, note, level });
    save(); $('#stampForm').innerHTML = ''; renderStamps(); toast(`Stamped ${exName(ex)} at ${clock(t)}`);
    try { player?.playVideo?.(); } catch (e) { /* not ready */ }
  },
  delStamp: b => { const v = vById(curVid); v.stamps = v.stamps.filter(x => x.id !== b.dataset.id); save(); $('#stampForm').innerHTML = ''; renderStamps(); },
  readChap: () => {
    const rows = parseChapters($('#chap').value);
    if (!rows.length) { $('#chapPrev').innerHTML = '<p class="muted small">No timestamps found. Lines should start or end with a time like 2:15.</p>'; return; }
    const lvOpts = l => `<option value="">All</option>${Object.entries(LEVELS).map(([k, x]) => `<option value="${k}" ${k === l ? 'selected' : ''}>${x}</option>`).join('')}`;
    $('#chapPrev').innerHTML = `<p class="muted small">Check the names, body parts and levels. Untick anything that is not an exercise.</p>
      ${rows.map(r => {
        const hit = findEx(r.name);
        return `<div class="chrow"><input type="checkbox" checked aria-label="Include"><input class="cT" inputmode="numeric" value="${clock(r.t)}"><input class="cN" list="exList" value="${esc(hit?.name || r.name)}">
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
    S.plans.forEach(p => { if (p.vid === curVid) delete p.vid; });
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
  exportJson: () => download(`lift-log-backup-${isoDay(Date.now())}.json`, JSON.stringify(S, null, 1), 'application/json'),
  importJson: () => $('#importFile').click(),
  exportCsv: () => {
    const q = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const rows = [['date', 'workout', 'exercise', 'set', 'weight_kg', 'reps']];
    S.sessions.forEach(s => s.items.forEach(it => it.sets.forEach((x, k) => rows.push([isoDay(s.start), s.name, exName(it.ex), k + 1, x.w || 0, x.r]))));
    download(`lift-log-sets-${isoDay(Date.now())}.csv`, rows.map(r => r.map(q).join(',')).join('\n'), 'text/csv');
  },
  install: async () => { if (!installEvt) return; installEvt.prompt(); await installEvt.userChoice; installEvt = null; closeSheet(); },
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
  if (t) { bodyDate = null; go(t.dataset.view); }
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
});
document.addEventListener('change', e => {
  const el = e.target, k = el.dataset.in;
  if (el.id === 'vUrl') { lookupVideo(); return; }
  if (!k) return;
  if (k === 'progEx') { progEx = el.value; render(); }
  else if (k === 'weekday') { S.week[+el.dataset.d] = el.value || null; save(); render(); }
  else if (k === 'rest') { S.settings.rest = +el.value; save(); }
  else if (k === 'level') { S.settings.level = el.value; save(); }
  else if (k === 'exGroup') { const x = exById(el.dataset.id); if (x) { x.group = el.value; save(); render(); } }
  else if (k === 'goal') { S.settings.goal = num(el.value); save(); render(); }
  else if (k === 'wake') { S.settings.wake = el.checked; save(); if (el.checked) wake(); else unwake(); }
});
document.addEventListener('paste', e => { if (e.target.id === 'vUrl') setTimeout(lookupVideo, 0); });
$('#setBtn').addEventListener('click', openSettings);

/* ---------- rest timer, elapsed clock, screen wake ---------- */
let restEnd = 0, restBuzzed = false;
function startRest(sec = S.settings.rest) { if (!sec) return; restEnd = Date.now() + sec * 1000; restBuzzed = false; tickRest(); }
function stopRest() { restEnd = 0; $('#rest').hidden = true; }
function tickRest() {
  if (!restEnd) return;
  const left = Math.round((restEnd - Date.now()) / 1000);
  if (left < -10) { stopRest(); return; }
  const el = $('#rest');
  el.hidden = false;
  el.classList.toggle('over', left <= 0);
  $('#restTime').textContent = left > 0 ? clock(left) : 'Go!';
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
}
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e; });

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
