// ============================================================
//  STORAGE
// ============================================================
function createDefaultState() {
  const state = {
    predictions: {},
    bank: {},
    matchResults: {},
    bracketPredictions: {},
    bracketActual: {},
  };
  PLAYERS.forEach(p => {
    state.bank[p] = { balance: 1000, invested: 0 };
    state.bracketPredictions[p] = {};
  });
  return state;
}

function normalizeState(state) {
  const base = createDefaultState();
  const merged = { ...base, ...(state || {}) };
  merged.predictions = merged.predictions || {};
  merged.matchResults = merged.matchResults || {};
  merged.bank = merged.bank || {};
  merged.bracketPredictions = merged.bracketPredictions || {};
  merged.bracketActual = merged.bracketActual || {};

  PLAYERS.forEach(p => {
    merged.bank[p] = { ...base.bank[p], ...(merged.bank[p] || {}) };
    merged.bracketPredictions[p] = merged.bracketPredictions[p] || {};
  });

  return merged;
}

function loadState() {
  const raw = localStorage.getItem("wc26_state");
  if (raw) {
    try { return normalizeState(JSON.parse(raw)); }
    catch (e) { console.warn("Could not parse saved state, using defaults", e); }
  }
  return createDefaultState();
}

function saveState() {
  localStorage.setItem("wc26_state", JSON.stringify(STATE));
  // Push the shared blob to Supabase (no-op for non-admins / when sync is off).
  if (window.WCSync && WCSync.enabled) WCSync.pushState(STATE);
}

// True when the current user may edit. With online sync this means "signed-in
// admin"; with sync off (local dev) editing is always allowed.
function canEdit() {
  if (window.WCSync && WCSync.enabled) return document.body.classList.contains("is-admin");
  return true;
}

let STATE = loadState();

function flagImg(teamName, size = 20) {
  const team = TEAMS[teamName];
  if (!team?.iso) return '';
  return `<img src="https://flagcdn.com/w40/${team.iso}.png" width="${size}" height="${Math.round(size * 0.75)}" alt="${team.code}" style="vertical-align:middle;image-rendering:pixelated;">`;
}

function getMatchData(id) {
  const base = MATCHES.find(m => m.id === id);
  if (!base) return null;
  const override = STATE.matchResults[id];
  if (override) {
    return { ...base, ...override };
  }
  return base;
}

// ============================================================
//  SCORING
// ============================================================
function getOutcome(s1, s2) {
  if (s1 > s2) return "H";
  if (s1 < s2) return "A";
  return "D";
}

function calcPoints(predHome, predAway, actHome, actAway) {
  if (predHome == null || predAway == null || actHome == null || actAway == null) return null;
  if (predHome === actHome && predAway === actAway) return 4;
  if (getOutcome(predHome, predAway) === getOutcome(actHome, actAway)) return 1;
  return 0;
}

function getPlayerPoints(player) {
  let total = 0;
  MATCHES.forEach(m => {
    const md = getMatchData(m.id);
    if (!md.completed) return;
    const pred = STATE.predictions[m.id]?.[player];
    if (!pred) return;
    const pts = calcPoints(pred.home, pred.away, md.homeScore, md.awayScore);
    if (pts !== null) total += pts;
  });
  return total;
}

function getPlayerOverallPoints(player) {
  return getPlayerPoints(player) + getPlayerBracketPoints(player);
}

function getPlayerStats(player) {
  let total = 0, correct = 0, perfect = 0, predicted = 0;
  const pointsOverTime = [];
  let running = 0;

  const completed = MATCHES.filter(m => getMatchData(m.id).completed)
    .sort((a, b) => a.id - b.id);

  completed.forEach(m => {
    const md = getMatchData(m.id);
    const pred = STATE.predictions[m.id]?.[player];
    if (!pred) {
      pointsOverTime.push(running);
      return;
    }
    predicted++;
    const pts = calcPoints(pred.home, pred.away, md.homeScore, md.awayScore);
    if (pts === 4) { perfect++; correct++; }
    else if (pts === 1) { correct++; }
    if (pts !== null) running += pts;
    total = running;
    pointsOverTime.push(running);
  });

  return { total, correct, perfect, predicted, pointsOverTime };
}

// Last N completed predictions as outcome tags (most recent last)
function getPlayerForm(player, n = 5) {
  const completed = MATCHES.filter(m => getMatchData(m.id).completed).sort((a, b) => a.id - b.id);
  const res = [];
  completed.forEach(m => {
    const md = getMatchData(m.id);
    const pred = STATE.predictions[m.id]?.[player];
    if (!pred) return;
    const pts = calcPoints(pred.home, pred.away, md.homeScore, md.awayScore);
    res.push(pts === 4 ? "perfect" : pts === 1 ? "correct" : "wrong");
  });
  return res.slice(-n);
}

const FORM_COLORS = { perfect: "#44cc44", correct: "#ffd700", wrong: "#ff4444" };

function getFormStatus(player) {
  const form = getPlayerForm(player, 5);
  if (!form.length) return { emoji: "⚪", label: "No form yet", cls: "neutral" };
  const last = form[form.length - 1];
  let streak = 0;
  for (let i = form.length - 1; i >= 0; i--) {
    const ok = form[i] === "perfect" || form[i] === "correct";
    if (!ok) break;
    streak++;
  }
  let cold = 0;
  for (let i = form.length - 1; i >= 0; i--) {
    if (form[i] !== "wrong") break;
    cold++;
  }
  if (last === "perfect") return { emoji: "🎯", label: "Perfect last match", cls: "perfect" };
  if (streak >= 3) return { emoji: "🔥", label: `${streak} correct in a row`, cls: "hot" };
  if (cold >= 2) return { emoji: "🧊", label: `${cold} misses in a row`, cls: "cold" };
  if (last === "correct") return { emoji: "✅", label: "Correct last match", cls: "good" };
  return { emoji: "💀", label: "Missed last match", cls: "bad" };
}


// ============================================================
//  PLAYER META, RANK MOVEMENT, AND ARENA PANELS
// ============================================================
function getLeaderboard() {
  return PLAYERS.map(p => {
    const base = getPlayerStats(p);
    const bracket = getPlayerBracketPoints(p);
    return { name: p, ...base, bracket, overall: base.total + bracket };
  }).sort((a, b) =>
    b.overall - a.overall || b.total - a.total || b.perfect - a.perfect || b.correct - a.correct || a.name.localeCompare(b.name)
  );
}

function rankMapFromRows(rows) {
  const out = {};
  rows.forEach((r, i) => out[r.name] = i + 1);
  return out;
}

function getPlayerMatchPointsUntilDate(player, dateStr) {
  let total = 0;
  MATCHES.forEach(m => {
    if (m.date > dateStr) return;
    const md = getMatchData(m.id);
    if (!md.completed) return;
    const pred = STATE.predictions[m.id]?.[player];
    if (!pred) return;
    const pts = calcPoints(pred.home, pred.away, md.homeScore, md.awayScore);
    if (pts !== null) total += pts;
  });
  return total;
}

function getLeaderboardUntilDate(dateStr) {
  return PLAYERS.map(p => ({
    name: p,
    overall: getPlayerMatchPointsUntilDate(p, dateStr),
    total: getPlayerMatchPointsUntilDate(p, dateStr),
    perfect: getPlayerStatsUntilDate(p, dateStr).perfect,
    correct: getPlayerStatsUntilDate(p, dateStr).correct,
  })).sort((a, b) => b.overall - a.overall || b.perfect - a.perfect || b.correct - a.correct || a.name.localeCompare(b.name));
}

function getPlayerStatsUntilDate(player, dateStr) {
  let correct = 0, perfect = 0;
  MATCHES.forEach(m => {
    if (m.date > dateStr) return;
    const md = getMatchData(m.id);
    if (!md.completed) return;
    const pred = STATE.predictions[m.id]?.[player];
    if (!pred) return;
    const pts = calcPoints(pred.home, pred.away, md.homeScore, md.awayScore);
    if (pts === 4) { perfect++; correct++; }
    else if (pts === 1) correct++;
  });
  return { correct, perfect };
}

function getCompletedDates() {
  return [...new Set(MATCHES.filter(m => getMatchData(m.id).completed).map(m => m.date))].sort();
}

function getRankMovementMap() {
  const current = rankMapFromRows(getLeaderboard());
  const dates = getCompletedDates();
  const movement = {};
  PLAYERS.forEach(p => movement[p] = 0);
  if (dates.length < 2) return movement;
  const previous = rankMapFromRows(getLeaderboardUntilDate(dates[dates.length - 2]));
  PLAYERS.forEach(p => {
    if (previous[p] && current[p]) movement[p] = previous[p] - current[p]; // positive = moved up
  });
  return movement;
}

function movementBadge(delta) {
  if (delta > 0) return `<span class="rank-move up">▲${delta}</span>`;
  if (delta < 0) return `<span class="rank-move down">▼${Math.abs(delta)}</span>`;
  return `<span class="rank-move same">—</span>`;
}

function getCurrentStreak(player) {
  const completed = MATCHES.filter(m => getMatchData(m.id).completed).sort((a, b) => b.id - a.id);
  let streak = 0;
  for (const m of completed) {
    const md = getMatchData(m.id);
    const pred = STATE.predictions[m.id]?.[player];
    if (!pred) break;
    const pts = calcPoints(pred.home, pred.away, md.homeScore, md.awayScore);
    if (pts >= 1) streak++;
    else break;
  }
  return streak;
}

function getDrawPredictionCount(player) {
  let count = 0;
  Object.values(STATE.predictions || {}).forEach(preds => {
    const pred = preds?.[player];
    if (pred && pred.home === pred.away) count++;
  });
  return count;
}

function getFavoriteTeamPredicted(player) {
  const counts = {};
  MATCHES.forEach(m => {
    const pred = STATE.predictions[m.id]?.[player];
    if (!pred) return;
    let team = null;
    if (pred.home > pred.away) team = m.home;
    else if (pred.home < pred.away) team = m.away;
    if (team) counts[team] = (counts[team] || 0) + 1;
  });
  const best = Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
  return best ? { team: best[0], count: best[1] } : null;
}

function getMostPredictedScore(player) {
  const counts = {};
  Object.values(STATE.predictions || {}).forEach(preds => {
    const pred = preds?.[player];
    if (!pred) return;
    const key = `${pred.home}-${pred.away}`;
    counts[key] = (counts[key] || 0) + 1;
  });
  const best = Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
  return best ? { score: best[0], count: best[1] } : null;
}

function getUpcomingMatches(count = 3) {
  return MATCHES.map(m => getMatchData(m.id)).filter(m => !m.completed).sort((a, b) => a.id - b.id).slice(0, count);
}

function getOutcomeLabelForPrediction(match, pred) {
  if (!pred) return "Missing";
  if (pred.home > pred.away) return TEAMS[match.home]?.code || match.home;
  if (pred.home < pred.away) return TEAMS[match.away]?.code || match.away;
  return "DRAW";
}

// Detect whether an upcoming match is contested between the players.
// Strongest rivalry first: a split on the winner; otherwise an exact-score split
// (e.g. everyone backs the same winner but one player has a different scoreline).
function getMatchRivalry(m) {
  const preds = PLAYERS
    .map(p => ({ player: p, pred: STATE.predictions[m.id]?.[p] }))
    .filter(x => x.pred);
  if (preds.length < 2) return null;

  // Group by predicted outcome (H / D / A)
  const camps = {};
  preds.forEach(x => {
    const o = getOutcome(x.pred.home, x.pred.away);
    (camps[o] = camps[o] || []).push(x.player);
  });

  if (Object.keys(camps).length > 1) {
    const labelFor = o => o === "H" ? (TEAMS[m.home]?.code || m.home)
      : o === "A" ? (TEAMS[m.away]?.code || m.away) : "DRAW";
    const sides = Object.keys(camps)
      .sort((a, b) => camps[b].length - camps[a].length)
      .map(o => ({ label: labelFor(o), players: camps[o] }));
    return { type: "outcome", sides };
  }

  // Same winner for everyone — look for a scoreline disagreement
  const scoreGroups = {};
  preds.forEach(x => {
    const key = `${x.pred.home}-${x.pred.away}`;
    (scoreGroups[key] = scoreGroups[key] || []).push(x.player);
  });
  if (Object.keys(scoreGroups).length > 1) {
    const sides = Object.keys(scoreGroups)
      .sort((a, b) => scoreGroups[b].length - scoreGroups[a].length)
      .map(k => ({ label: k, players: scoreGroups[k] }));
    const oddOne = sides.length === 2 && sides[0].players.length >= 2 && sides[1].players.length === 1
      ? sides[1].players[0] : null;
    return { type: "score", sides, oddOne };
  }

  return null; // everyone predicted exactly the same — no rivalry
}

function renderArenaRivalries() {
  const wrap = document.getElementById("arena-rivalries-list");
  if (!wrap) return;
  const upcoming = getUpcomingMatches(12);
  if (!upcoming.length) {
    wrap.innerHTML = `<div class="arena-live-empty">No upcoming matches.</div>`;
    return;
  }

  const rivalries = upcoming
    .map(m => ({ m, riv: getMatchRivalry(m) }))
    .filter(x => x.riv)
    .slice(0, 6);

  if (!rivalries.length) {
    wrap.innerHTML = `<div class="arena-live-empty">No rivalries in the upcoming matches &mdash; the squad mostly agrees (or hasn't predicted yet).</div>`;
    return;
  }

  wrap.innerHTML = rivalries.map(({ m, riv }) => {
    const header = `<div class="rivalry-title"><span class="match-group-tag">GROUP ${m.group}</span> #${m.id} ${flagImg(m.home, 16)} ${TEAMS[m.home]?.code || m.home} vs ${TEAMS[m.away]?.code || m.away} ${flagImg(m.away, 16)}</div>`;

    let tag, line;
    if (riv.type === "outcome") {
      tag = `<span class="rivalry-tag rivalry-tag-hot">WINNER SPLIT</span>`;
      line = riv.sides
        .map(s => `<b>${escapeHtml(s.label)}</b> &mdash; ${s.players.join(" + ")}`)
        .join(`<span class="rivalry-vs">VS</span>`);
    } else {
      tag = `<span class="rivalry-tag rivalry-tag-mild">SCORE SPLIT</span>`;
      const intro = riv.oddOne
        ? `Same winner, but <b>${riv.oddOne}</b> is the odd one out:`
        : `Same winner, different scorelines:`;
      line = `${intro} ` + riv.sides
        .map(s => `${escapeHtml(s.label)} (${s.players.join(", ")})`)
        .join(" &middot; ");
    }

    const picks = `<div class="rivalry-picks">${PLAYERS.map(p => {
      const pred = STATE.predictions[m.id]?.[p];
      return `<span class="rivalry-pick" style="border-color:${PLAYER_COLORS[p]};color:${PLAYER_COLORS[p]}">${p}: ${pred ? pred.home + '-' + pred.away : '—'}</span>`;
    }).join("")}</div>`;

    return `<div class="rivalry-card">${header}<div class="rivalry-line">${tag}${line}</div>${picks}</div>`;
  }).join("");
}

function buildAiRecapPrompt() {
  const rows = getLeaderboard();
  const next = getUpcomingMatches(3);
  const unlocked = getUnlockedAchievements();
  return [
    "Write a short, funny World Cup prediction league recap for a friend group.",
    "Tone: playful sports newspaper / commentator, light trash talk, not too mean.",
    "Standings:",
    ...rows.map((r, i) => `${i + 1}. ${r.name}: ${r.overall} pts (${r.total} match, ${r.bracket} bracket), ${r.perfect} perfect, ${r.correct} correct`),
    "Upcoming matches and predictions:",
    ...next.map(m => `${TEAMS[m.home]?.code || m.home} vs ${TEAMS[m.away]?.code || m.away}: ` + PLAYERS.map(p => {
      const pred = STATE.predictions[m.id]?.[p];
      return `${p} ${pred ? pred.home + '-' + pred.away : 'missing'}`;
    }).join(", ")),
    "Achievements:",
    ...PLAYERS.map(p => `${p}: ${(unlocked[p] || []).join(", ") || "none"}`),
  ].join("\n");
}

function renderArenaRecap() {
  const wrap = document.getElementById("arena-recap-text");
  if (!wrap) return;
  const rows = getLeaderboard();
  const leader = rows[0];
  const last = rows[rows.length - 1];
  const next = getUpcomingMatches(1)[0];
  const move = getRankMovementMap();
  const climber = PLAYERS.map(p => ({ player: p, delta: move[p] || 0 })).sort((a, b) => b.delta - a.delta)[0];
  const nextText = next
    ? `Next chaos: ${TEAMS[next.home]?.code || next.home} vs ${TEAMS[next.away]?.code || next.away}.`
    : "No upcoming matches left.";
  wrap.innerHTML = `<p><b>${leader.name}</b> is currently sitting on the throne with <b>${leader.overall}</b> points, while <b>${last.name}</b> is stuck in the raincloud zone.</p>
    <p>${climber?.delta > 0 ? `<b>${climber.player}</b> is the biggest climber right now (${movementBadge(climber.delta)}).` : "No major rank movement yet."} ${nextText}</p>
    <p class="recap-muted">Use <b>COPY AI PROMPT</b> to paste the current league state into ChatGPT or an API backend for custom recaps/trash talk.</p>`;
}

function copyAiPrompt() {
  const prompt = buildAiRecapPrompt();
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(prompt);
    const btn = document.getElementById("copy-ai-prompt-btn");
    if (btn) {
      const old = btn.textContent;
      btn.textContent = "COPIED!";
      setTimeout(() => btn.textContent = old, 1200);
    }
  } else {
    window.prompt("Copy this prompt:", prompt);
  }
}

function getCrowdSections(width = 480) {
  const rows = getLeaderboard();
  const totalRaw = rows.reduce((sum, r) => sum + Math.max(0, r.overall), 0);
  const weights = totalRaw > 0
    ? rows.map(r => Math.max(0, r.overall))
    : rows.map(() => 1);
  const total = weights.reduce((sum, w) => sum + w, 0) || 1;
  let x = 0;
  return rows.map((r, i) => {
    const start = x;
    const end = i === rows.length - 1 ? width : start + (weights[i] / total) * width;
    x = end;
    return {
      name: r.name,
      color: PLAYER_COLORS[r.name],
      start,
      end,
      percent: Math.round(((end - start) / width) * 100),
    };
  });
}

function crowdColorByX(cx, sections = null) {
  const list = sections || getCrowdSections();
  const section = list.find(sec => cx >= sec.start && cx < sec.end) || list[list.length - 1];
  return section?.color || "#ffffff";
}

function drawCrowdSectionLabels(sections) {
  ctx.font = "6px 'Press Start 2P'";
  ctx.textAlign = "center";
  sections.forEach(sec => {
    const w = sec.end - sec.start;
    if (w < 38) return;
    ctx.fillStyle = sec.color;
    ctx.fillRect(sec.start, 78, w, 2);
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(sec.start + 2, 68, Math.min(w - 4, 84), 9);
    ctx.fillStyle = sec.color;
    ctx.fillText(`${sec.name} ${sec.percent}%`, sec.start + Math.min(w / 2, 44), 75);
  });
  ctx.textAlign = "left";
}

// ============================================================
//  TABS
// ============================================================
document.querySelectorAll(".tab").forEach(btn => {
  btn.addEventListener("click", () => {
    sfx.click();
    document.querySelectorAll(".tab").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById("tab-" + btn.dataset.tab).classList.add("active");

    if (btn.dataset.tab === "matches") renderMatches();
    if (btn.dataset.tab === "standings") renderStandings();
    if (btn.dataset.tab === "brackets") renderBrackets();
    if (btn.dataset.tab === "achievements") renderAchievements();
    if (btn.dataset.tab === "bank") renderBank();
    if (btn.dataset.tab === "arena") { renderArenaScoreboard(); }
  });
});

// ============================================================
//  ARENA (pixel art canvas)
// ============================================================
const canvas = document.getElementById("arena-canvas");
const ctx = canvas.getContext("2d");

// The arena is drawn in a fixed 480x270 logical coordinate space but displayed
// up to ~2x larger via CSS. To keep small text (crowd %, banner) crisp instead
// of blurry, we render into a higher-resolution backing store and scale the
// context, accounting for the device pixel ratio. All draw code keeps using
// 480x270 coordinates unchanged.
const ARENA_W = 480, ARENA_H = 270;
const ARENA_SS = 2 * Math.min(window.devicePixelRatio || 1, 2);
canvas.width = ARENA_W * ARENA_SS;
canvas.height = ARENA_H * ARENA_SS;
ctx.setTransform(ARENA_SS, 0, 0, ARENA_SS, 0, 0);

const CHAR_W = 10, CHAR_H = 14;
const SCALE = 3;

const characters = PLAYERS.map((name, i) => ({
  name,
  x: 80 + i * 90,
  y: 210,
  vx: 0,
  color: PLAYER_COLORS[name],
  state: "idle",
  frame: 0,
  timer: Math.random() * 200 | 0,
  dir: 1,
  bobOffset: i * 15,
  reaction: null,
}));

// ---- Sound effects (Web Audio, no assets needed) ----
let audioCtx = null;
function initAudio() {
  if (!audioCtx) {
    try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); }
    catch (e) { audioCtx = null; }
  }
  if (audioCtx && audioCtx.state === "suspended") audioCtx.resume();
}
function tone(freq, start, dur, type = "square", vol = 0.15) {
  if (!audioCtx) return;
  const t0 = audioCtx.currentTime + start;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  gain.gain.setValueAtTime(vol, t0);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(gain).connect(audioCtx.destination);
  osc.start(t0);
  osc.stop(t0 + dur);
}
const sfx = {
  click() { initAudio(); tone(440, 0, 0.07, "square", 0.10); },
  perfect() { initAudio(); [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.09, 0.18, "square", 0.18)); },
  correct() { initAudio(); tone(523, 0, 0.10); tone(784, 0.10, 0.14); },
  miss() { initAudio(); tone(200, 0, 0.18, "sawtooth", 0.14); tone(140, 0.12, 0.22, "sawtooth", 0.14); },
};

// ---- Confetti particles ----
let confetti = [];
function spawnConfetti(cx, cy) {
  const colors = ["#ffd700", "#ff4444", "#44cc44", "#4488ff", "#ffffff", "#ff66ff"];
  for (let i = 0; i < 30; i++) {
    confetti.push({
      x: cx, y: cy,
      vx: (Math.random() - 0.5) * 4.5,
      vy: -Math.random() * 4.5 - 1,
      size: 2 + Math.random() * 3,
      color: colors[i % colors.length],
      life: 70 + Math.random() * 30,
      maxLife: 100,
    });
  }
}
function updateConfetti() {
  confetti.forEach(p => {
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.15; // gravity
    p.life--;
  });
  confetti = confetti.filter(p => p.life > 0);
  confetti.forEach(p => {
    ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x | 0, p.y | 0, p.size, p.size);
  });
  ctx.globalAlpha = 1;
}

// ---- Reactions ----
let arenaLeader = null;
let arenaLast = null;
function triggerReaction(playerName, type) {
  const ch = characters.find(c => c.name === playerName);
  if (!ch) return;
  ch.reaction = { type, until: tick + 150 };
  if (type === "perfect") spawnConfetti(ch.x, ch.y - 40);
}
function getLeaderName() {
  const rows = getLeaderboard();
  return rows[0]?.overall > 0 ? rows[0].name : null;
}

function getLastRankedName() {
  const rows = getLeaderboard();
  return rows.length ? rows[rows.length - 1].name : null;
}

function drawRainCloud(x, y, tick) {
  const bob = Math.sin(tick * 0.08) * 2;
  const cx = x;
  const cy = y - 38 + bob;
  ctx.fillStyle = "rgba(70,70,95,0.95)";
  ctx.fillRect(cx - 14, cy, 28, 8);
  ctx.fillRect(cx - 10, cy - 5, 14, 10);
  ctx.fillRect(cx + 2, cy - 3, 12, 8);
  ctx.fillStyle = "#6bbcff";
  if (tick % 40 < 24) {
    ctx.fillRect(cx - 9, cy + 13, 2, 5);
    ctx.fillRect(cx + 1, cy + 16, 2, 5);
    ctx.fillRect(cx + 10, cy + 12, 2, 5);
  }
}

function drawPixel(x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

function drawChar(ch, tick) {
  if (ch.reaction && tick >= ch.reaction.until) ch.reaction = null;
  const rtype = ch.reaction ? ch.reaction.type : null;

  let bob;
  if (rtype === "perfect") {
    bob = -Math.abs(Math.sin(tick * 0.4)) * 8; // excited hops
  } else if (rtype === "wrong") {
    bob = 2; // slumped down
  } else {
    bob = Math.sin((tick + ch.bobOffset) * 0.08) * 2;
  }
  const x = ch.x | 0;
  const y = (ch.y + bob) | 0;
  const s = ch.rankScale || 2;
  const status = getFormStatus(ch.name);
  const skinColor = "#ffcc99";
  const hairColors = { Kim: "#6b4226", Sander: "#e8d44d", Jonatan: "#222222", Sebastian: "#cc4422" };
  const hair = hairColors[ch.name] || "#333";
  const pants = "#334";
  const shoes = "#222";

  // Leader glow (pulsing) — drawn behind the sprite
  if (ch.name === arenaLeader) {
    const pulse = 0.30 + Math.abs(Math.sin(tick * 0.06)) * 0.30;
    const radius = 30 + ((ch.rankScale || 2) - 2) * 10;
    const g = ctx.createRadialGradient(x, y, 2, x, y, radius);
    g.addColorStop(0, `rgba(255,215,0,${pulse})`);
    g.addColorStop(1, "rgba(255,215,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(x - radius - 4, y - radius - 4, (radius + 4) * 2, (radius + 4) * 2);
  }

  if (ch.name === arenaLast && ch.name !== arenaLeader) {
    drawRainCloud(x, y, tick);
  }

  // Hair
  drawPixel(x - 3*s, y - 7*s, 6*s, 2*s, hair);

  // Leader crown
  if (ch.name === arenaLeader) {
    drawPixel(x - 3*s, y - 9*s, 6*s, s, "#ffd700");
    drawPixel(x - 3*s, y - 11*s, s, 2*s, "#ffd700");
    drawPixel(x, y - 11*s, s, 2*s, "#ffd700");
    drawPixel(x + 2*s, y - 11*s, s, 2*s, "#ffd700");
  }
  // Head
  drawPixel(x - 3*s, y - 5*s, 6*s, 3*s, skinColor);
  // Eyes
  drawPixel(x - 2*s, y - 4*s, s, s, "#333");
  drawPixel(x + 1*s, y - 4*s, s, s, "#333");
  // Shirt
  drawPixel(x - 4*s, y - 2*s, 8*s, 4*s, ch.color);
  // Arms
  if (rtype === "perfect") {
    // arms raised in celebration
    drawPixel(x - 5*s, y - 4*s, s, 3*s, skinColor);
    drawPixel(x + 4*s, y - 4*s, s, 3*s, skinColor);
  } else {
    const armSwing = ch.state === "walk" ? Math.sin(tick * 0.15) * 2 * s : 0;
    drawPixel(x - 5*s, y - 1*s + armSwing, s, 3*s, skinColor);
    drawPixel(x + 4*s, y - 1*s - armSwing, s, 3*s, skinColor);
  }
  // Pants
  drawPixel(x - 3*s, y + 2*s, 3*s, 3*s, pants);
  drawPixel(x, y + 2*s, 3*s, 3*s, pants);
  // Legs/shoes walk animation
  if (ch.state === "walk") {
    const legOff = Math.sin(tick * 0.15) * 2 * s;
    drawPixel(x - 2*s, y + 5*s + legOff, 2*s, s, shoes);
    drawPixel(x + 0*s, y + 5*s - legOff, 2*s, s, shoes);
  } else {
    drawPixel(x - 2*s, y + 5*s, 2*s, s, shoes);
    drawPixel(x + 0*s, y + 5*s, 2*s, s, shoes);
  }

  // Current form emoji above the tag
  ctx.font = "13px serif";
  ctx.textAlign = "center";
  ctx.fillStyle = "#ffffff";
  ctx.fillText(status.emoji, x, y - 31 * s);

  // Name tag background — positioned well above the sprite
  ctx.font = "8px 'Press Start 2P'";
  ctx.textAlign = "center";
  const nameWidth = ctx.measureText(ch.name).width;
  const tagW = Math.max(nameWidth + 12, 30);
  const tagH = 31;
  const tagX = x - tagW / 2;
  const tagY = y - 27*s;

  ctx.fillStyle = "rgba(0,0,0,0.85)";
  ctx.fillRect(tagX, tagY, tagW, tagH);
  ctx.strokeStyle = ch.color;
  ctx.lineWidth = 1;
  ctx.strokeRect(tagX, tagY, tagW, tagH);

  // Name
  ctx.fillStyle = ch.color;
  ctx.fillText(ch.name, x, tagY + 10);

  // Points
  const pts = getPlayerOverallPoints(ch.name);
  ctx.fillStyle = "#ffd700";
  ctx.font = "7px 'Press Start 2P'";
  ctx.fillText(pts + " pts", x, tagY + 20);
  ctx.textAlign = "left";

  // Form dots (last 5) under the points
  const form = getPlayerForm(ch.name, 5);
  if (form.length) {
    const dotSize = 3, gap = 2;
    const totalW = form.length * (dotSize + gap) - gap;
    let fx = x - totalW / 2;
    const fy = tagY + 24;
    form.forEach(r => {
      ctx.fillStyle = FORM_COLORS[r];
      ctx.fillRect(fx, fy, dotSize, dotSize);
      fx += dotSize + gap;
    });
  }
}

function drawStadium(tick) {
  // Sky gradient
  const grad = ctx.createLinearGradient(0, 0, 0, 120);
  grad.addColorStop(0, "#1a0a3e");
  grad.addColorStop(1, "#2d1b69");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 480, 120);

  // Stars
  ctx.fillStyle = "#fff";
  for (let i = 0; i < 30; i++) {
    const sx = (i * 97 + 13) % 480;
    const sy = (i * 43 + 7) % 100;
    const twinkle = Math.sin(tick * 0.02 + i) > 0.3 ? 1 : 0;
    if (twinkle) ctx.fillRect(sx, sy, 1, 1);
  }

  // Stadium structure
  const crowdSections = getCrowdSections(480);
  ctx.fillStyle = "#383858";
  ctx.fillRect(0, 80, 480, 60);
  drawCrowdSectionLabels(crowdSections);
  // Stand rows
  for (let row = 0; row < 4; row++) {
    ctx.fillStyle = row % 2 === 0 ? "#404068" : "#383858";
    ctx.fillRect(0, 80 + row * 15, 480, 15);
    // Crowd dots
    for (let i = 0; i < 60; i++) {
      const cx = i * 8 + ((row * 3) % 8);
      const cy = 85 + row * 15;
      ctx.fillStyle = crowdColorByX(cx, crowdSections);
      ctx.fillRect(cx, cy, 3, 4);
    }
  }

  // Pitch
  ctx.fillStyle = "#2d8a4e";
  ctx.fillRect(0, 140, 480, 130);
  // Lighter stripes
  for (let i = 0; i < 8; i++) {
    if (i % 2 === 0) {
      ctx.fillStyle = "#339956";
      ctx.fillRect(i * 60, 140, 60, 130);
    }
  }
  // Field lines
  ctx.strokeStyle = "rgba(255,255,255,0.4)";
  ctx.lineWidth = 1;
  // Center line
  ctx.beginPath();
  ctx.moveTo(240, 140);
  ctx.lineTo(240, 270);
  ctx.stroke();
  // Center circle
  ctx.beginPath();
  ctx.arc(240, 205, 30, 0, Math.PI * 2);
  ctx.stroke();
  // Center dot
  ctx.fillStyle = "rgba(255,255,255,0.4)";
  ctx.fillRect(239, 204, 2, 2);
  // Penalty areas
  ctx.strokeRect(0, 170, 50, 70);
  ctx.strokeRect(430, 170, 50, 70);
  // Goals
  ctx.fillStyle = "#eee";
  ctx.fillRect(0, 190, 4, 30);
  ctx.fillRect(476, 190, 4, 30);

  // FIFA World Cup 2026 banner — at the top
  ctx.fillStyle = "rgba(0,0,0,0.7)";
  ctx.fillRect(120, 4, 240, 22);
  ctx.strokeStyle = "#ffd700";
  ctx.lineWidth = 1;
  ctx.strokeRect(120, 4, 240, 22);
  ctx.fillStyle = "#ffd700";
  ctx.font = "10px 'Press Start 2P'";
  ctx.textAlign = "center";
  ctx.fillText("WORLD CUP 2026", 240, 20);
  ctx.textAlign = "left";
}

function drawBall(tick) {
  const bx = 240 + Math.sin(tick * 0.01) * 40;
  const by = 220 + Math.cos(tick * 0.015) * 15;
  ctx.fillStyle = "#fff";
  ctx.fillRect(bx - 2, by - 2, 5, 5);
  ctx.fillStyle = "#333";
  ctx.fillRect(bx - 1, by - 1, 2, 2);
}

let tick = 0;
function animateArena() {
  tick++;
  if (tick % 30 === 0) {
    arenaLeader = getLeaderName();
    arenaLast = getLastRankedName();
  }
  ctx.clearRect(0, 0, 480, 270);

  drawStadium(tick);
  drawBall(tick);

  const ranked = getLeaderboard();
  const rankIndex = {};
  ranked.forEach((r, i) => rankIndex[r.name] = i + 1);
  const rankSizes = { 1: 3.0, 2: 2.6, 3: 2.25, 4: 2.0 };

  characters.forEach(ch => {
    ch.rankScale = rankSizes[rankIndex[ch.name]] || 2;

    // Movement is intentionally closer to the original arena: players wander around
    // freely, while rank is communicated by size, glow/raincloud and the cards below.
    if (ch.reaction && tick < ch.reaction.until && ch.reaction.type === "perfect") {
      ch.state = "idle";
      ch.vx = 0;
    } else {
      ch.timer--;
      if (ch.timer <= 0) {
        if (ch.state === "idle") {
          ch.state = "walk";
          ch.vx = (Math.random() > 0.5 ? 1 : -1) * (0.25 + Math.random() * 0.45);
          ch.dir = ch.vx > 0 ? 1 : -1;
          ch.timer = 80 + Math.random() * 120 | 0;
        } else {
          ch.state = "idle";
          ch.vx = 0;
          ch.timer = 90 + Math.random() * 140 | 0;
        }
      }
      ch.x += ch.vx;
      const pad = 34 + (ch.rankScale - 2) * 12;
      if (ch.x < pad) { ch.x = pad; ch.vx *= -1; ch.dir *= -1; }
      if (ch.x > 480 - pad) { ch.x = 480 - pad; ch.vx *= -1; ch.dir *= -1; }
      // Keep them on the pitch, but let larger characters stand slightly forward.
      ch.y += (210 + (2.6 - ch.rankScale) * 7 - ch.y) * 0.02;
    }

    drawChar(ch, tick);
  });

  updateConfetti();

  requestAnimationFrame(animateArena);
}

function formDotsHtml(player) {
  const form = getPlayerForm(player, 5);
  if (!form.length) return `<div class="form-row"><span class="form-empty">no results yet</span></div>`;
  return `<div class="form-row">${form
    .map(r => `<span class="form-dot" title="${r}" style="background:${FORM_COLORS[r]}"></span>`)
    .join("")}</div>`;
}

function renderArenaScoreCardsOnly() {
  const stats = getLeaderboard();
  const movement = getRankMovementMap();
  stats.forEach((s, i) => {
    const el = document.getElementById("arena-p" + i);
    if (!el) return;
    const isLeader = i === 0 && s.overall > 0;
    const isLast = i === stats.length - 1;
    const color = PLAYER_COLORS[s.name];
    el.className = `arena-player rank-card rank-card-${i + 1}${isLeader ? ' leader' : ''}${isLast ? ' last' : ''}`;
    el.dataset.player = s.name;
    el.style.setProperty('--card-color', color);
    const formStatus = getFormStatus(s.name);
    const icon = isLeader ? "&#128081;" : isLast ? "&#127783;" : "";
    el.title = `Click for ${s.name}'s full stats`;
    el.innerHTML = `
      <div class="rc-head">
        <span class="rc-rank">#${i + 1}</span>
        <span class="rc-head-right">${movementBadge(movement[s.name] || 0)}${icon ? `<span class="rc-icon">${icon}</span>` : ""}<span class="rc-info">&#128202;</span></span>
      </div>
      <div class="rc-name" style="color:${color}">${s.name}</div>
      <div class="rc-pts"><b>${s.overall}</b><span>pts</span></div>
      <div class="rc-split">${s.total} match &middot; ${s.bracket} bracket</div>
      <div class="rc-form form-status-${formStatus.cls}" title="${formStatus.label}">
        <span class="rc-form-icon">${formStatus.emoji}</span>${formDotsHtml(s.name)}
      </div>
      <div class="rc-cta">VIEW STATS &#9656;</div>
    `;
    el.onclick = () => openPlayerModal(s.name);
  });
}

function renderArenaScoreboard() {
  renderArenaScoreCardsOnly();
  renderArenaLiveMatches();
  renderArenaRivalries();
  renderArenaRecap();
}


function predictionRowsForPlayer(player, mode = "recent") {
  const matches = MATCHES.map(m => getMatchData(m.id));
  const filtered = mode === "upcoming"
    ? matches.filter(m => !m.completed).sort((a, b) => a.id - b.id).slice(0, 12)
    : matches.filter(m => m.completed).sort((a, b) => b.id - a.id).slice(0, 12);

  if (!filtered.length) return `<div class="player-empty">No ${mode} matches.</div>`;

  return `<div class="player-pred-list">${filtered.map(m => {
    const pred = STATE.predictions[m.id]?.[player];
    const pts = m.completed && pred ? calcPoints(pred.home, pred.away, m.homeScore, m.awayScore) : null;
    const cls = pts === 4 ? "perfect" : pts === 1 ? "correct" : pts === 0 ? "wrong" : "pending";
    return `<div class="player-pred-row ${cls}">
      <div><span class="match-group-tag">${m.group}</span> #${m.id}</div>
      <div>${flagImg(m.home, 14)} ${TEAMS[m.home]?.code || m.home} vs ${TEAMS[m.away]?.code || m.away} ${flagImg(m.away, 14)}</div>
      <div class="player-pred-score">${pred ? pred.home + '-' + pred.away : '—'} ${m.completed ? `<span class="actual-score">(${m.homeScore}-${m.awayScore})</span>` : ''}</div>
      <div>${pts !== null ? '+' + pts : 'open'}</div>
    </div>`;
  }).join("")}</div>`;
}

let modalPlayer = null;

function openPlayerModal(player) {
  const modal = document.getElementById("player-modal");
  const title = document.getElementById("player-modal-title");
  const body = document.getElementById("player-modal-body");
  if (!modal || !title || !body) return;
  modalPlayer = player;

  const base = getPlayerStats(player);
  const bracket = getPlayerBracketPoints(player);
  const total = base.total + bracket;
  const hitRate = base.predicted ? Math.round((base.correct / base.predicted) * 100) : 0;
  const fav = getFavoriteTeamPredicted(player);
  const score = getMostPredictedScore(player);
  const achievements = getUnlockedAchievements()[player] || [];
  const achNames = achievements.map(id => ACHIEVEMENTS.find(a => a.id === id)?.name || id);

  title.innerHTML = `<span style="color:${PLAYER_COLORS[player]}">${player}</span> PLAYER CARD`;
  body.innerHTML = `
    <div class="player-stat-grid">
      <div class="player-stat"><span>Total</span><b>${total}</b></div>
      <div class="player-stat"><span>Match</span><b>${base.total}</b></div>
      <div class="player-stat"><span>Bracket</span><b>${bracket}</b></div>
      <div class="player-stat"><span>Perfect</span><b>${base.perfect}</b></div>
      <div class="player-stat"><span>Correct</span><b>${base.correct}</b></div>
      <div class="player-stat"><span>Hit rate</span><b>${hitRate}%</b></div>
      <div class="player-stat"><span>Draw picks</span><b>${getDrawPredictionCount(player)}</b></div>
      <div class="player-stat"><span>Streak</span><b>${getCurrentStreak(player)}</b></div>
    </div>

    <div class="player-extra-grid">
      <div class="player-extra"><span>Favorite team predicted</span><b>${fav ? teamBadge(fav.team, 16) + ` x${fav.count}` : '—'}</b></div>
      <div class="player-extra"><span>Most predicted score</span><b>${score ? score.score + ` x${score.count}` : '—'}</b></div>
      <div class="player-extra"><span>Achievements</span><b>${achNames.length ? achNames.join(', ') : 'None yet'}</b></div>
    </div>

    <h4 class="player-section-title">Upcoming predictions</h4>
    ${predictionRowsForPlayer(player, "upcoming")}
    <h4 class="player-section-title">Recent results</h4>
    ${predictionRowsForPlayer(player, "recent")}
  `;

  modal.classList.remove("hidden");
}

function cyclePlayerModal(dir) {
  const order = getLeaderboard().map(s => s.name);
  const idx = order.indexOf(modalPlayer);
  if (idx === -1) return;
  openPlayerModal(order[(idx + dir + order.length) % order.length]);
}

function setupPlayerModal() {
  const modal = document.getElementById("player-modal");
  const close = document.getElementById("player-modal-close");
  if (!modal || !close) return;
  close.onclick = () => modal.classList.add("hidden");
  modal.onclick = (e) => { if (e.target === modal) modal.classList.add("hidden"); };

  const prev = document.getElementById("player-modal-prev");
  const next = document.getElementById("player-modal-next");
  if (prev) prev.onclick = (e) => { e.stopPropagation(); cyclePlayerModal(-1); };
  if (next) next.onclick = (e) => { e.stopPropagation(); cyclePlayerModal(1); };

  document.addEventListener("keydown", (e) => {
    if (modal.classList.contains("hidden")) return;
    if (e.key === "Escape") modal.classList.add("hidden");
    else if (e.key === "ArrowLeft") cyclePlayerModal(-1);
    else if (e.key === "ArrowRight") cyclePlayerModal(1);
  });

  canvas.addEventListener("click", (e) => {
    const rect = canvas.getBoundingClientRect();
    // Map click position to the 480x270 logical space the characters live in.
    const x = (e.clientX - rect.left) / rect.width * ARENA_W;
    const y = (e.clientY - rect.top) / rect.height * ARENA_H;
    const hit = characters.find(ch => Math.abs(ch.x - x) < 30 && Math.abs(ch.y - y) < 45);
    if (hit) openPlayerModal(hit.name);
  });
}

// Matches whose kickoff (date @ 12:00) is within ±`hours` of now
function getNearbyMatches(hours = 12) {
  const now = Date.now();
  const win = hours * 3600 * 1000;
  return MATCHES
    .filter(m => Math.abs(new Date(m.date + "T12:00:00").getTime() - now) <= win)
    .sort((a, b) => a.id - b.id);
}

function renderArenaLiveMatches() {
  const wrap = document.getElementById("arena-live-matches");
  if (!wrap) return;
  const matches = getNearbyMatches(12).map(m => getMatchData(m.id));

  if (matches.length === 0) {
    wrap.innerHTML = `<div class="arena-live-empty">No matches within 12 hours of now.</div>`;
    return;
  }

  const editable = canEdit();
  let html = "";
  matches.forEach(m => {
    const home = TEAMS[m.home], away = TEAMS[m.away];
    const hs = m.homeScore ?? "";
    const as = m.awayScore ?? "";
    const scoreInner = editable
      ? `<div class="stepper">
              <button type="button" class="step-btn" data-live="${m.id}" data-side="home" data-dir="-1">-</button>
              <input type="number" class="live-input" data-live="${m.id}" data-side="home" min="0" max="20" value="${hs}">
              <button type="button" class="step-btn" data-live="${m.id}" data-side="home" data-dir="1">+</button>
            </div>
            <span class="live-dash">-</span>
            <div class="stepper">
              <button type="button" class="step-btn" data-live="${m.id}" data-side="away" data-dir="-1">-</button>
              <input type="number" class="live-input" data-live="${m.id}" data-side="away" min="0" max="20" value="${as}">
              <button type="button" class="step-btn" data-live="${m.id}" data-side="away" data-dir="1">+</button>
            </div>
            <button type="button" class="live-clear" data-live="${m.id}" title="Clear result">&#8635;</button>`
      : `<span class="match-score${m.completed ? '' : ' pending'}">${m.completed ? `${hs} - ${as}` : 'vs'}</span>`;
    html += `
      <div class="live-card ${m.completed ? 'completed' : 'upcoming'}">
        <div class="live-card-top">
          <span class="match-group-tag">GROUP ${m.group}</span>
          <span>#${m.id} &middot; ${formatDate(m.date)}</span>
        </div>
        <div class="live-card-row">
          <span class="live-team">${flagImg(m.home, 22)} ${home?.code || m.home}</span>
          <div class="live-score">${scoreInner}</div>
          <span class="live-team">${flagImg(m.away, 22)} ${away?.code || m.away}</span>
        </div>
      </div>`;
  });
  wrap.innerHTML = html;

  wrap.querySelectorAll(".step-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = parseInt(btn.dataset.live);
      const input = wrap.querySelector(`.live-input[data-live="${id}"][data-side="${btn.dataset.side}"]`);
      let v = parseInt(input.value);
      if (isNaN(v)) v = 0;
      v += parseInt(btn.dataset.dir);
      if (v < 0) v = 0;
      if (v > 20) v = 20;
      input.value = v;
      commitLiveScore(id);
    });
  });
  wrap.querySelectorAll(".live-input").forEach(inp => {
    inp.addEventListener("change", () => commitLiveScore(parseInt(inp.dataset.live)));
  });
  wrap.querySelectorAll(".live-clear").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = parseInt(btn.dataset.live);
      wrap.querySelector(`.live-input[data-live="${id}"][data-side="home"]`).value = "";
      wrap.querySelector(`.live-input[data-live="${id}"][data-side="away"]`).value = "";
      commitLiveScore(id);
    });
  });
}

// Shared: apply a result for a match, fire reactions/sounds, and sync all views
function applyMatchResult(matchId, homeScore, awayScore) {
  if (homeScore === "" || homeScore == null || awayScore === "" || awayScore == null) {
    delete STATE.matchResults[matchId];
  } else {
    STATE.matchResults[matchId] = {
      homeScore: parseInt(homeScore),
      awayScore: parseInt(awayScore),
      completed: true,
    };
  }
  saveState();

  const md = getMatchData(matchId);
  if (md.completed) {
    let anyPerfect = false, anyResult = false;
    PLAYERS.forEach(p => {
      const pred = STATE.predictions[matchId]?.[p];
      if (!pred) return;
      anyResult = true;
      const pts = calcPoints(pred.home, pred.away, md.homeScore, md.awayScore);
      if (pts === 4) { triggerReaction(p, "perfect"); anyPerfect = true; }
      else if (pts === 1) triggerReaction(p, "correct");
      else triggerReaction(p, "wrong");
    });
    if (anyPerfect) sfx.perfect();
    else if (anyResult) sfx.correct();
  }

  // Keep all views in sync without rebuilding the live score form mid-entry.
  renderArenaScoreCardsOnly();
  if (md.completed) {
    renderArenaRivalries();
    renderArenaRecap();
  }
  renderMatches();
  renderBracketsIfVisible();
  checkAchievements();
}

function commitLiveScore(matchId) {
  const wrap = document.getElementById("arena-live-matches");
  const hi = wrap.querySelector(`.live-input[data-live="${matchId}"][data-side="home"]`);
  const ai = wrap.querySelector(`.live-input[data-live="${matchId}"][data-side="away"]`);
  applyMatchResult(matchId, hi.value, ai.value);
  // Update only this card's styling — do NOT rebuild the panel, which would
  // wipe a score that's still being entered one side at a time.
  const card = hi.closest(".live-card");
  if (card) {
    const done = getMatchData(matchId).completed;
    card.classList.toggle("completed", done);
    card.classList.toggle("upcoming", !done);
  }
}

// ============================================================
//  MATCHES
// ============================================================
function formatDate(dateStr) {
  const d = new Date(dateStr + "T12:00:00");
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${days[d.getDay()]} ${d.getDate()} ${months[d.getMonth()]}`;
}

function renderMatches() {
  const filter = document.getElementById("match-filter").value;
  const groupFilter = document.getElementById("group-filter").value;

  let matches = MATCHES.map(m => getMatchData(m.id));
  if (filter === "completed") matches = matches.filter(m => m.completed);
  if (filter === "upcoming") matches = matches.filter(m => !m.completed);
  if (groupFilter !== "all") matches = matches.filter(m => m.group === groupFilter);

  const byDate = {};
  matches.forEach(m => {
    if (!byDate[m.date]) byDate[m.date] = [];
    byDate[m.date].push(m);
  });

  let html = "";
  Object.keys(byDate).sort().forEach(date => {
    html += `<div class="match-day-header">${formatDate(date)}</div>`;
    byDate[date].forEach(m => {
      const home = TEAMS[m.home];
      const away = TEAMS[m.away];
      const scoreHtml = m.completed
        ? `<span class="match-score">${m.homeScore} - ${m.awayScore}</span>`
        : `<span class="match-score pending">vs</span>`;

      let predsHtml = "";
      const preds = STATE.predictions[m.id];
      if (preds && m.completed) {
        predsHtml = '<div class="match-predictions">';
        PLAYERS.forEach(p => {
          const pred = preds[p];
          if (!pred) {
            predsHtml += `<div class="pred-cell"><span class="pred-name">${p}</span><div class="pred-score">-</div></div>`;
            return;
          }
          const pts = calcPoints(pred.home, pred.away, m.homeScore, m.awayScore);
          const cls = pts === 4 ? "perfect" : pts === 1 ? "correct" : "wrong";
          predsHtml += `<div class="pred-cell ${cls}">
            <span class="pred-name">${p}</span>
            <div class="pred-score">${pred.home}-${pred.away} (+${pts})</div>
          </div>`;
        });
        predsHtml += "</div>";
      } else if (preds) {
        predsHtml = '<div class="match-predictions">';
        PLAYERS.forEach(p => {
          const pred = preds[p];
          predsHtml += `<div class="pred-cell">
            <span class="pred-name">${p}</span>
            <div class="pred-score">${pred ? pred.home + "-" + pred.away : "-"}</div>
          </div>`;
        });
        predsHtml += "</div>";
      }

      html += `
        <div class="match-card ${m.completed ? 'completed' : 'upcoming'}" data-id="${m.id}">
          <div class="match-top">
            <span class="match-group-tag">GROUP ${m.group}</span>
            <span>#${m.id}</span>
          </div>
          <div class="match-teams">
            <div class="match-team">
              <span class="flag">${flagImg(m.home, 28)}</span>
              <span class="team-name">${home?.code || m.home}</span>
              <span class="code">${m.home}</span>
            </div>
            ${scoreHtml}
            <div class="match-team">
              <span class="flag">${flagImg(m.away, 28)}</span>
              <span class="team-name">${away?.code || m.away}</span>
              <span class="code">${m.away}</span>
            </div>
          </div>
          ${predsHtml}
        </div>`;
    });
  });

  document.getElementById("matches-list").innerHTML = html;

  // Only admins open the editing modal; viewers see predictions read-only above.
  if (canEdit()) {
    document.querySelectorAll(".match-card").forEach(card => {
      card.classList.add("editable");
      card.addEventListener("click", () => openPredictionModal(parseInt(card.dataset.id)));
    });
  }
}

function openPredictionModal(matchId) {
  const m = getMatchData(matchId);
  const modal = document.getElementById("prediction-modal");
  const home = TEAMS[m.home];
  const away = TEAMS[m.away];

  document.getElementById("modal-match-title").textContent =
    `${home?.code || m.home} vs ${away?.code || m.away}`;

  let html = "";

  // Result edit section
  html += `<div class="result-edit-section">
    <h4>MATCH RESULT</h4>
    <div class="result-edit-row">
      <span class="team-label">${flagImg(m.home, 22)} ${home?.code || ''}</span>
      <div class="stepper">
        <button type="button" class="step-btn" data-target="result-home" data-dir="-1">-</button>
        <input type="number" id="result-home" min="0" max="20" value="${m.homeScore ?? ''}">
        <button type="button" class="step-btn" data-target="result-home" data-dir="1">+</button>
      </div>
      <span style="color:var(--text-dim)">-</span>
      <div class="stepper">
        <button type="button" class="step-btn" data-target="result-away" data-dir="-1">-</button>
        <input type="number" id="result-away" min="0" max="20" value="${m.awayScore ?? ''}">
        <button type="button" class="step-btn" data-target="result-away" data-dir="1">+</button>
      </div>
      <span class="team-label">${flagImg(m.away, 22)} ${away?.code || ''}</span>
    </div>
    <div class="result-clear-row">
      <button type="button" class="btn btn-clear" id="result-clear">&#8635; CLEAR RESULT</button>
    </div>
  </div>`;

  // Prediction rows
  html += `<h4 style="font-size:8px;color:var(--accent);margin-bottom:8px;">PREDICTIONS</h4>`;
  PLAYERS.forEach(p => {
    const pred = STATE.predictions[matchId]?.[p];
    const pts = m.completed && pred
      ? calcPoints(pred.home, pred.away, m.homeScore, m.awayScore)
      : null;
    const ptsHtml = pts !== null
      ? `<span class="pts-badge" style="color:${pts === 4 ? 'var(--green)' : pts === 1 ? 'var(--gold)' : 'var(--red)'}">+${pts}</span>`
      : "";

    const homeId = `pred-${p}-home`;
    const awayId = `pred-${p}-away`;
    html += `
      <div class="pred-form-row" style="border-left:3px solid ${PLAYER_COLORS[p]}">
        <span class="player-name" style="color:${PLAYER_COLORS[p]}">${p}</span>
        <div class="stepper">
          <button type="button" class="step-btn" data-target="${homeId}" data-dir="-1">-</button>
          <input type="number" class="pred-input" id="${homeId}" data-player="${p}" data-side="home" min="0" max="20" value="${pred?.home ?? ''}">
          <button type="button" class="step-btn" data-target="${homeId}" data-dir="1">+</button>
        </div>
        <span class="dash">-</span>
        <div class="stepper">
          <button type="button" class="step-btn" data-target="${awayId}" data-dir="-1">-</button>
          <input type="number" class="pred-input" id="${awayId}" data-player="${p}" data-side="away" min="0" max="20" value="${pred?.away ?? ''}">
          <button type="button" class="step-btn" data-target="${awayId}" data-dir="1">+</button>
        </div>
        ${ptsHtml}
      </div>`;
  });

  document.getElementById("modal-body").innerHTML = html;
  modal.classList.remove("hidden");

  // Wire stepper buttons
  modal.querySelectorAll(".step-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const input = document.getElementById(btn.dataset.target);
      if (!input) return;
      const dir = parseInt(btn.dataset.dir);
      let val = parseInt(input.value);
      if (isNaN(val)) val = dir > 0 ? 0 : 0;
      else val += dir;
      if (val < 0) val = 0;
      if (val > 20) val = 20;
      input.value = val;
    });
  });

  document.getElementById("result-clear").onclick = () => {
    document.getElementById("result-home").value = "";
    document.getElementById("result-away").value = "";
  };
  document.getElementById("modal-save").onclick = () => savePredictions(matchId);
  document.getElementById("modal-close").onclick = () => modal.classList.add("hidden");
  modal.onclick = (e) => { if (e.target === modal) modal.classList.add("hidden"); };
}

function savePredictions(matchId) {
  // Save result
  const rh = document.getElementById("result-home").value;
  const ra = document.getElementById("result-away").value;
  if (rh !== "" && ra !== "") {
    if (!STATE.matchResults[matchId]) STATE.matchResults[matchId] = {};
    STATE.matchResults[matchId].homeScore = parseInt(rh);
    STATE.matchResults[matchId].awayScore = parseInt(ra);
    STATE.matchResults[matchId].completed = true;
  } else {
    if (STATE.matchResults[matchId]) {
      delete STATE.matchResults[matchId];
    }
  }

  // Save predictions
  if (!STATE.predictions[matchId]) STATE.predictions[matchId] = {};
  document.querySelectorAll(".pred-input").forEach(input => {
    const player = input.dataset.player;
    const side = input.dataset.side;
    if (!STATE.predictions[matchId][player]) STATE.predictions[matchId][player] = {};
    const val = input.value;
    STATE.predictions[matchId][player][side] = val !== "" ? parseInt(val) : null;
  });

  // Clean up incomplete predictions
  PLAYERS.forEach(p => {
    const pred = STATE.predictions[matchId][p];
    if (pred && (pred.home == null || pred.away == null)) {
      delete STATE.predictions[matchId][p];
    }
  });

  saveState();
  document.getElementById("prediction-modal").classList.add("hidden");
  renderMatches();
  renderBracketsIfVisible();
  checkAchievements();

  // Arena reactions + sound based on this match's outcome
  const md = getMatchData(matchId);
  if (md.completed) {
    let anyPerfect = false, anyResult = false;
    PLAYERS.forEach(p => {
      const pred = STATE.predictions[matchId]?.[p];
      if (!pred) return;
      anyResult = true;
      const pts = calcPoints(pred.home, pred.away, md.homeScore, md.awayScore);
      if (pts === 4) { triggerReaction(p, "perfect"); anyPerfect = true; }
      else if (pts === 1) triggerReaction(p, "correct");
      else if (pts === 0) triggerReaction(p, "wrong");
    });
    if (anyPerfect) sfx.perfect();
    else if (anyResult) sfx.correct();
  }
  renderArenaScoreboard();
}

// Group filter setup
function setupGroupFilter() {
  const sel = document.getElementById("group-filter");
  Object.keys(GROUPS).forEach(g => {
    const opt = document.createElement("option");
    opt.value = g;
    opt.textContent = "Group " + g;
    sel.appendChild(opt);
  });
}

document.getElementById("match-filter").addEventListener("change", renderMatches);
document.getElementById("group-filter").addEventListener("change", renderMatches);

// ============================================================
//  STANDINGS
// ============================================================
function renderStandings() {
  const stats = PLAYERS.map(p => {
    const base = getPlayerStats(p);
    const bracket = getPlayerBracketPoints(p);
    return { name: p, ...base, bracket, overall: base.total + bracket };
  });
  stats.sort((a, b) => b.overall - a.overall || b.total - a.total || b.perfect - a.perfect || b.correct - a.correct);

  let html = `<table class="standings-table">
    <thead><tr>
      <th>#</th><th>PLAYER</th><th>MATCH</th><th>BRACKET</th><th>TOTAL</th><th>CORRECT</th><th>PERFECT</th><th>PREDICTED</th>
    </tr></thead><tbody>`;

  stats.forEach((s, i) => {
    const rankClass = `rank-${i + 1}`;
    html += `<tr class="${rankClass}">
      <td><span class="rank-badge">${i + 1}</span></td>
      <td><span class="player-dot" style="background:${PLAYER_COLORS[s.name]}"></span>${s.name}</td>
      <td>${s.total}</td>
      <td>${s.bracket}</td>
      <td>${s.overall}</td>
      <td>${s.correct}</td>
      <td>${s.perfect}</td>
      <td>${s.predicted}</td>
    </tr>`;
  });

  html += "</tbody></table>";
  document.getElementById("standings-table-wrap").innerHTML = html;

  renderChart(stats);
}

function renderChart(stats) {
  const chart = document.getElementById("standings-chart");
  const cctx = chart.getContext("2d");
  const W = 600, H = 250;
  chart.width = W;
  chart.height = H;
  cctx.clearRect(0, 0, W, H);

  const pad = { top: 20, right: 20, bottom: 30, left: 35 };
  const plotW = W - pad.left - pad.right;
  const plotH = H - pad.top - pad.bottom;

  const maxLen = Math.max(...stats.map(s => s.pointsOverTime.length), 1);
  const maxPts = Math.max(...stats.map(s => Math.max(...s.pointsOverTime, 0)), 1);

  // Grid
  cctx.strokeStyle = "#333355";
  cctx.lineWidth = 1;
  for (let i = 0; i <= 5; i++) {
    const y = pad.top + (plotH / 5) * i;
    cctx.beginPath();
    cctx.moveTo(pad.left, y);
    cctx.lineTo(W - pad.right, y);
    cctx.stroke();
    cctx.fillStyle = "#666688";
    cctx.font = "8px 'Press Start 2P'";
    cctx.textAlign = "right";
    cctx.fillText(Math.round(maxPts * (1 - i / 5)), pad.left - 4, y + 3);
  }

  // X axis label
  cctx.fillStyle = "#666688";
  cctx.font = "7px 'Press Start 2P'";
  cctx.textAlign = "center";
  cctx.fillText("MATCHES", W / 2, H - 4);

  // Lines
  stats.forEach(s => {
    if (s.pointsOverTime.length === 0) return;
    cctx.strokeStyle = PLAYER_COLORS[s.name];
    cctx.lineWidth = 2;
    cctx.beginPath();
    s.pointsOverTime.forEach((pt, i) => {
      const x = pad.left + (i / Math.max(maxLen - 1, 1)) * plotW;
      const y = pad.top + plotH - (pt / maxPts) * plotH;
      if (i === 0) cctx.moveTo(x, y);
      else cctx.lineTo(x, y);
    });
    cctx.stroke();

    // Endpoint dot
    const lastI = s.pointsOverTime.length - 1;
    const ex = pad.left + (lastI / Math.max(maxLen - 1, 1)) * plotW;
    const ey = pad.top + plotH - (s.pointsOverTime[lastI] / maxPts) * plotH;
    cctx.fillStyle = PLAYER_COLORS[s.name];
    cctx.fillRect(ex - 3, ey - 3, 6, 6);
  });
}


// ============================================================
//  BRACKETS
// ============================================================
let selectedBracketView = "actual";

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function normalizeTeamName(value) {
  if (value == null) return "";
  const raw = String(value).trim();
  if (!raw) return "";
  if (TEAMS[raw]) return raw;
  const upper = raw.toUpperCase();
  const found = Object.keys(TEAMS).find(name =>
    name.toUpperCase() === upper || TEAMS[name].code.toUpperCase() === upper
  );
  return found || raw;
}

function isRealTeam(value) {
  return !!TEAMS[normalizeTeamName(value)];
}

function getTeamLabel(teamName) {
  const normalized = normalizeTeamName(teamName);
  const team = TEAMS[normalized];
  if (!normalized) return "—";
  if (!team) return normalized;
  return `${team.code} ${normalized}`;
}

function teamBadge(teamName, size = 16) {
  const normalized = normalizeTeamName(teamName);
  if (!normalized) return `<span class="bracket-placeholder">—</span>`;
  const team = TEAMS[normalized];
  if (!team) return `<span class="bracket-placeholder">${escapeHtml(normalized)}</span>`;
  return `${flagImg(normalized, size)} <span class="bracket-team-code">${team.code}</span>`;
}

function setupBracketControls() {
  const view = document.getElementById("bracket-view");
  if (!view) return;

  let html = `<option value="actual">Actual Bracket</option>`;
  PLAYERS.forEach(p => {
    html += `<option value="${p}">${p}'s Bracket</option>`;
  });
  view.innerHTML = html;
  view.value = selectedBracketView;
  view.addEventListener("change", () => {
    selectedBracketView = view.value;
    renderBrackets();
  });

  const importBtn = document.getElementById("bracket-import-btn");
  const importFile = document.getElementById("bracket-import-file");
  if (importBtn && importFile) {
    importBtn.addEventListener("click", () => importFile.click());
    importFile.addEventListener("change", importBracketFile);
  }
}

function isGroupStageComplete() {
  return MATCHES.every(m => getMatchData(m.id).completed);
}

function getGroupTables() {
  const tables = {};
  Object.keys(GROUPS).forEach(g => {
    tables[g] = GROUPS[g].map(team => ({ team, played: 0, pts: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, gd: 0 }));
  });

  MATCHES.forEach(m => {
    const md = getMatchData(m.id);
    if (!md.completed || md.homeScore == null || md.awayScore == null) return;
    const home = tables[m.group].find(t => t.team === m.home);
    const away = tables[m.group].find(t => t.team === m.away);
    if (!home || !away) return;

    home.played++; away.played++;
    home.gf += md.homeScore; home.ga += md.awayScore;
    away.gf += md.awayScore; away.ga += md.homeScore;
    home.gd = home.gf - home.ga;
    away.gd = away.gf - away.ga;

    if (md.homeScore > md.awayScore) { home.pts += 3; home.w++; away.l++; }
    else if (md.homeScore < md.awayScore) { away.pts += 3; away.w++; home.l++; }
    else { home.pts++; away.pts++; home.d++; away.d++; }
  });

  Object.keys(tables).forEach(g => {
    tables[g].sort((a, b) =>
      b.pts - a.pts || b.gd - a.gd || b.gf - a.gf || a.ga - b.ga || a.team.localeCompare(b.team)
    );
  });

  return tables;
}

function getBestThirds(groupTables) {
  return Object.keys(groupTables)
    .map(group => ({ group, ...groupTables[group][2] }))
    .sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf || a.ga - b.ga || a.team.localeCompare(b.team));
}

function seedLabel(seed) {
  if (seed.type === "groupRank") return `${seed.group}${seed.rank}`;
  if (seed.type === "bestThird") return `3RD #${seed.rank}`;
  return "TBD";
}

function resolveBracketSeed(seed, groupTables, bestThirds, complete) {
  if (!complete) return seedLabel(seed);
  if (seed.type === "groupRank") return groupTables[seed.group]?.[seed.rank - 1]?.team || seedLabel(seed);
  if (seed.type === "bestThird") return bestThirds[seed.rank - 1]?.team || seedLabel(seed);
  return seedLabel(seed);
}

function getAutoR32Slots() {
  const tables = getGroupTables();
  const bestThirds = getBestThirds(tables);
  const complete = isGroupStageComplete();
  const slots = [];
  BRACKET_R32_MATCHES.forEach(match => {
    slots.push(resolveBracketSeed(match[0], tables, bestThirds, complete));
    slots.push(resolveBracketSeed(match[1], tables, bestThirds, complete));
  });
  return slots;
}

function applyBronzeFallback(slots) {
  if (!slots.bronze) slots.bronze = ["", ""];
  const bronzeHasTeams = slots.bronze.filter(t => isRealTeam(t)).length >= 2;
  if (bronzeHasTeams) return slots;

  const semiTeams = (slots.sf || []).map(normalizeTeamName).filter(isRealTeam);
  const finalists = new Set((slots.final || []).map(normalizeTeamName).filter(isRealTeam));
  if (semiTeams.length < 4 || finalists.size < 2) return slots;

  const losers = semiTeams.filter(t => !finalists.has(t));
  if (losers.length >= 2) slots.bronze = losers.slice(0, 2);
  return slots;
}

function getActualBracketSlots() {
  const actual = { r32: getAutoR32Slots() };
  BRACKET_ROUNDS.forEach(round => {
    if (round.key === "r32") return;
    const saved = STATE.bracketActual[round.key];
    actual[round.key] = Array.isArray(saved) ? saved.slice(0, round.slots) : [];
    while (actual[round.key].length < round.slots) actual[round.key].push("");
  });
  return applyBronzeFallback(actual);
}

function getBracketSlotsForView(view) {
  if (view === "actual") return getActualBracketSlots();

  const saved = STATE.bracketPredictions[view] || {};
  const slots = {};
  BRACKET_ROUNDS.forEach(round => {
    const arr = Array.isArray(saved[round.key]) ? saved[round.key] : [];
    slots[round.key] = arr.slice(0, round.slots);
    while (slots[round.key].length < round.slots) slots[round.key].push("");
  });
  return applyBronzeFallback(slots);
}

function getPlayerBracketStats(player) {
  const actual = getActualBracketSlots();
  const pred = getBracketSlotsForView(player);
  const byRound = {};
  let total = 0;

  BRACKET_ROUNDS.forEach(round => {
    byRound[round.key] = { correct: 0, possible: 0, points: 0 };
    for (let i = 0; i < round.slots; i++) {
      const actualTeam = normalizeTeamName(actual[round.key]?.[i]);
      const predTeam = normalizeTeamName(pred[round.key]?.[i]);
      if (!isRealTeam(actualTeam)) continue;
      byRound[round.key].possible++;
      if (predTeam && predTeam === actualTeam) {
        byRound[round.key].correct++;
        byRound[round.key].points += round.points;
        total += round.points;
      }
    }
  });

  return { total, byRound };
}

function getPlayerBracketPoints(player) {
  return getPlayerBracketStats(player).total;
}

function bracketStatusClass(view, roundKey, index) {
  if (view === "actual") return "";
  const actual = getActualBracketSlots();
  const pred = getBracketSlotsForView(view);
  const actualTeam = normalizeTeamName(actual[roundKey]?.[index]);
  const predTeam = normalizeTeamName(pred[roundKey]?.[index]);
  if (!predTeam || !isRealTeam(actualTeam)) return "pending";
  return predTeam === actualTeam ? "correct" : "wrong";
}

// Slots where the viewed player is the only one to pick that team — the
// contrarian / "lone wolf" picks that set their bracket apart from the group.
let loneSlotSet = new Set();

function computeLoneSlots(view) {
  const set = new Set();
  if (view === "actual") return set;
  const mine = getBracketSlotsForView(view);
  const others = PLAYERS.filter(p => p !== view).map(p => getBracketSlotsForView(p));
  if (!others.length) return set;

  BRACKET_ROUNDS.forEach(round => {
    for (let i = 0; i < round.slots; i++) {
      const myTeam = normalizeTeamName(mine[round.key]?.[i]);
      if (!myTeam || !isRealTeam(myTeam)) continue;
      let othersPredicted = 0, sameAsMe = 0;
      others.forEach(o => {
        const t = normalizeTeamName(o[round.key]?.[i]);
        if (!t || !isRealTeam(t)) return;
        othersPredicted++;
        if (t === myTeam) sameAsMe++;
      });
      if (othersPredicted >= 1 && sameAsMe === 0) set.add(round.key + ":" + i);
    }
  });
  return set;
}

function loneMark(view, roundKey, index, value) {
  if (view === "actual" || !value) return "";
  return loneSlotSet.has(roundKey + ":" + index)
    ? `<span class="lone-mark" title="Only you picked this team here">&#9670;</span>`
    : "";
}


function renderBracketInfo() {
  const wrap = document.getElementById("bracket-info-wrap");
  if (!wrap) return;
  wrap.innerHTML = `<div class="bracket-info-card">
    <h3>SPILLTIPSET-STYLE POINT SYSTEM</h3>
    <p><b>Match predictions:</b> Exact score gives <b>+4</b>. Correct outcome only gives <b>+1</b>. Wrong gives <b>0</b>.</p>
    <p><b>Bracket predictions:</b> ${BRACKET_ROUNDS.map(r => `${r.label} +${r.points}`).join(" · ")}.</p>
    <p class="recap-muted">The values are configurable in <code>data.js</code>. I kept the app's current match scoring and added the knockout rounds as editable bracket scoring.</p>
  </div>`;
}

function championAdvances(finalSlot, champion) {
  return !!champion && normalizeTeamName(finalSlot) === normalizeTeamName(champion);
}

function slotMini(view, roundKey, index, value, advances = false) {
  const round = BRACKET_ROUNDS.find(r => r.key === roundKey);
  const cls = view === "actual" ? "" : bracketStatusClass(view, roundKey, index);
  const adv = advances && value ? " advances" : "";
  return `<div class="tree-team ${cls}${adv}">${teamBadge(value, 13)}${cls === "correct" ? `<span>+${round.points}</span>` : ""}${loneMark(view, roundKey, index, value)}</div>`;
}

// A team advances if it appears in the next round's set of predicted teams.
function advancingSet(nextSlots) {
  return nextSlots ? new Set(nextSlots.map(normalizeTeamName).filter(isRealTeam)) : null;
}

function treeMatch(view, roundKey, matchIndex, slots, nextSet) {
  const a = slots[matchIndex * 2] || "";
  const b = slots[matchIndex * 2 + 1] || "";
  const aAdv = !!nextSet && !!a && nextSet.has(normalizeTeamName(a));
  const bAdv = !!nextSet && !!b && nextSet.has(normalizeTeamName(b));
  return `<div class="tree-match">
    ${slotMini(view, roundKey, matchIndex * 2, a, aAdv)}
    ${slotMini(view, roundKey, matchIndex * 2 + 1, b, bAdv)}
  </div>`;
}

function treeColumn(view, roundKey, slots, start, count, reverse = false, nextSlots = null) {
  const indices = Array.from({ length: count }, (_, i) => start + i);
  if (reverse) indices.reverse();
  const nextSet = advancingSet(nextSlots);
  return `<div class="tree-col tree-${roundKey}">${indices.map(i => treeMatch(view, roundKey, i, slots, nextSet)).join("")}</div>`;
}

function renderRocketBracket(view, slotsByRound) {
  const r32 = slotsByRound.r32 || [];
  const r16 = slotsByRound.r16 || [];
  const qf = slotsByRound.qf || [];
  const sf = slotsByRound.sf || [];
  const final = slotsByRound.final || [];
  const champion = slotsByRound.champion || [];
  const bronze = slotsByRound.bronze || [];

  return `<div class="rocket-bracket-wrap">
    <div class="rocket-title">ROCKET-STYLE KNOCKOUT TREE</div>
    <div class="rocket-bracket">
      <div class="tree-side left-side">
        ${treeColumn(view, "r32", r32, 0, 8, false, r16)}
        ${treeColumn(view, "r16", r16, 0, 4, false, qf)}
        ${treeColumn(view, "qf", qf, 0, 2, false, sf)}
        ${treeColumn(view, "sf", sf, 0, 1, false, final)}
      </div>
      <div class="tree-center">
        <div class="final-box">
          <div class="tree-label">FINAL</div>
          ${slotMini(view, "final", 0, final[0] || "", championAdvances(final[0], champion[0]))}
          ${slotMini(view, "final", 1, final[1] || "", championAdvances(final[1], champion[0]))}
        </div>
        <div class="champion-box">
          <div class="tree-label">WINNER</div>
          ${slotMini(view, "champion", 0, champion[0] || "")}
        </div>
        <div class="bronze-box">
          <div class="tree-label">BRONZE</div>
          ${slotMini(view, "bronze", 0, bronze[0] || "")}
          ${slotMini(view, "bronze", 1, bronze[1] || "")}
        </div>
      </div>
      <div class="tree-side right-side">
        ${treeColumn(view, "sf", sf, 1, 1, true, final)}
        ${treeColumn(view, "qf", qf, 2, 2, true, sf)}
        ${treeColumn(view, "r16", r16, 4, 4, true, qf)}
        ${treeColumn(view, "r32", r32, 8, 8, true, r16)}
      </div>
    </div>
  </div>`;
}

function renderBracketScores() {
  const complete = isGroupStageComplete();
  let html = `
    <div class="bracket-status-card ${complete ? 'ready' : 'waiting'}">
      <div class="bracket-status-title">${complete ? 'GROUP STAGE COMPLETE' : 'GROUP STAGE NOT COMPLETE'}</div>
      <div class="bracket-status-text">
        ${complete
          ? 'Round of 32 actual teams are now generated from the group tables.'
          : 'Round of 32 actual teams are placeholders until every group-stage match has a result.'}
      </div>
    </div>
    <table class="bracket-score-table">
      <thead><tr>
        <th>PLAYER</th><th>TOTAL</th>
        ${BRACKET_ROUNDS.map(r => `<th>${r.short}</th>`).join("")}
      </tr></thead><tbody>`;

  const rows = PLAYERS.map(p => ({ player: p, stats: getPlayerBracketStats(p) }))
    .sort((a, b) => b.stats.total - a.stats.total);

  rows.forEach(row => {
    html += `<tr class="${selectedBracketView === row.player ? 'selected' : ''}">
      <td><span class="player-dot" style="background:${PLAYER_COLORS[row.player]}"></span>${row.player}</td>
      <td class="bracket-total">${row.stats.total}</td>
      ${BRACKET_ROUNDS.map(r => {
        const rr = row.stats.byRound[r.key];
        return `<td>${rr.points}<span class="bracket-mini"> ${rr.correct}/${rr.possible}</span></td>`;
      }).join("")}
    </tr>`;
  });

  html += `</tbody></table>`;
  document.getElementById("bracket-score-wrap").innerHTML = html;
}

function renderActualSlot(round, index, value, advances = false) {
  const normalized = normalizeTeamName(value);
  const adv = advances ? " advances" : "";
  if (round.key === "r32") {
    const real = isRealTeam(normalized);
    return `<div class="bracket-team actual ${real ? 'real' : 'placeholder'}${adv}">
      <span class="bracket-slot-no">${index + 1}</span>
      <span class="bracket-team-main">${teamBadge(normalized, 16)}</span>
    </div>`;
  }

  // Viewers see the actual knockout result read-only; only admins get the picker.
  if (!canEdit()) {
    const real = isRealTeam(normalized);
    return `<div class="bracket-team actual ${real ? 'real' : 'placeholder'}${adv}">
      <span class="bracket-slot-no">${index + 1}</span>
      <span class="bracket-team-main">${teamBadge(normalized, 16)}</span>
    </div>`;
  }

  const options = [`<option value="">—</option>`]
    .concat(Object.keys(TEAMS).map(team => {
      const selected = normalizeTeamName(team) === normalized ? "selected" : "";
      return `<option value="${escapeHtml(team)}" ${selected}>${escapeHtml(TEAMS[team].code)} - ${escapeHtml(team)}</option>`;
    })).join("");

  return `<div class="bracket-team actual editable${adv}">
    <span class="bracket-slot-no">${index + 1}</span>
    <select class="bracket-select" data-round="${round.key}" data-index="${index}">${options}</select>
  </div>`;
}

function renderPredictionSlot(view, round, index, value, advances = false) {
  const normalized = normalizeTeamName(value);
  const cls = bracketStatusClass(view, round.key, index);
  const adv = advances ? " advances" : "";
  const actual = getActualBracketSlots();
  const actualTeam = normalizeTeamName(actual[round.key]?.[index]);
  const pts = cls === "correct" ? `+${round.points}` : "";
  const actualHint = isRealTeam(actualTeam) && normalized && normalized !== actualTeam
    ? `<div class="bracket-actual-hint">actual: ${teamBadge(actualTeam, 12)}</div>`
    : "";

  return `<div class="bracket-team prediction ${cls}${adv}">
    <span class="bracket-slot-no">${index + 1}</span>
    <span class="bracket-team-main">${teamBadge(normalized, 16)}</span>
    ${pts ? `<span class="bracket-slot-points">${pts}</span>` : ""}
    ${loneMark(view, round.key, index, normalized)}
    ${actualHint}
  </div>`;
}

// Maps each knockout round to the round its match winners advance into.
const BRACKET_NEXT = { r32: "r16", r16: "qf", qf: "sf", sf: "final", final: "champion" };

function renderBracketRound(view, round, slots, nextSlots = null) {
  if (round.key === "champion") {
    const value = slots[0] || "";
    const slotHtml = view === "actual"
      ? renderActualSlot(round, 0, value)
      : renderPredictionSlot(view, round, 0, value);
    return `<div class="bracket-round champion-round">
      <h3>${round.label} <span>+${round.points}</span></h3>
      <div class="bracket-match champion-match">${slotHtml}</div>
    </div>`;
  }

  let html = `<div class="bracket-round"><h3>${round.label} <span>+${round.points}</span></h3>`;
  // A team advances if it appears in the next round's set of predicted teams.
  const nextSet = advancingSet(nextSlots);
  for (let i = 0; i < round.slots; i += 2) {
    const matchNo = i / 2 + 1;
    const aAdv = !!nextSet && !!slots[i] && nextSet.has(normalizeTeamName(slots[i]));
    const bAdv = !!nextSet && !!slots[i + 1] && nextSet.has(normalizeTeamName(slots[i + 1]));
    const slotA = view === "actual" ? renderActualSlot(round, i, slots[i], aAdv) : renderPredictionSlot(view, round, i, slots[i], aAdv);
    const slotB = view === "actual" ? renderActualSlot(round, i + 1, slots[i + 1], bAdv) : renderPredictionSlot(view, round, i + 1, slots[i + 1], bAdv);
    html += `<div class="bracket-match">
      <div class="bracket-match-no">M${matchNo}</div>
      ${slotA}
      ${slotB}
    </div>`;
  }
  html += `</div>`;
  return html;
}

function renderBrackets() {
  const board = document.getElementById("bracket-board");
  if (!board) return;

  const viewSelect = document.getElementById("bracket-view");
  if (viewSelect && viewSelect.value !== selectedBracketView) viewSelect.value = selectedBracketView;

  renderBracketInfo();
  renderBracketScores();

  const slotsByRound = getBracketSlotsForView(selectedBracketView);
  loneSlotSet = computeLoneSlots(selectedBracketView);
  let title = selectedBracketView === "actual"
    ? "ACTUAL KNOCKOUT BRACKET"
    : `${selectedBracketView.toUpperCase()}'S PREDICTED BRACKET`;

  let html = `<div class="bracket-board-title">
    <h2>${escapeHtml(title)}</h2>
    <div>${selectedBracketView === "actual"
      ? 'Edit actual winners as knockout matches finish.'
      : 'Green = correct slot, red = wrong once actual slot is known. <span class="lone-mark">&#9670;</span> = only this player picked that team.'}</div>
  </div>
  ${renderRocketBracket(selectedBracketView, slotsByRound)}
  <div class="bracket-scroll"><div class="bracket-grid">`;

  BRACKET_ROUNDS.forEach(round => {
    const nextKey = BRACKET_NEXT[round.key];
    const nextSlots = nextKey ? (slotsByRound[nextKey] || []) : null;
    html += renderBracketRound(selectedBracketView, round, slotsByRound[round.key] || [], nextSlots);
  });

  html += `</div></div>`;
  board.innerHTML = html;

  board.querySelectorAll(".bracket-select").forEach(sel => {
    sel.addEventListener("change", () => {
      const roundKey = sel.dataset.round;
      const index = parseInt(sel.dataset.index);
      if (!STATE.bracketActual[roundKey]) STATE.bracketActual[roundKey] = [];
      const round = BRACKET_ROUNDS.find(r => r.key === roundKey);
      while (STATE.bracketActual[roundKey].length < round.slots) STATE.bracketActual[roundKey].push("");
      STATE.bracketActual[roundKey][index] = normalizeTeamName(sel.value);
      saveState();
      renderBrackets();
    });
  });
}

function renderBracketsIfVisible() {
  const section = document.getElementById("tab-brackets");
  if (section?.classList.contains("active")) renderBrackets();
}

function normalizeBracketData(raw) {
  const out = {};
  BRACKET_ROUNDS.forEach(round => {
    let value = raw?.[round.key];
    if (round.key === "champion") {
      if (Array.isArray(value)) value = value[0];
      value = value || raw?.winner || raw?.champion;
      out[round.key] = value ? [normalizeTeamName(value)] : [];
      return;
    }

    if (!Array.isArray(value)) value = [];
    out[round.key] = value.slice(0, round.slots).map(normalizeTeamName);
    while (out[round.key].length < round.slots) out[round.key].push("");
  });

  if (raw?.slots && typeof raw.slots === "object") {
    Object.entries(raw.slots).forEach(([key, value]) => {
      const m = key.match(/^(r32|r16|qf|sf|bronze|final|champion)[-_]?(\d+)?$/i);
      if (!m) return;
      const roundKey = m[1].toLowerCase();
      const round = BRACKET_ROUNDS.find(r => r.key === roundKey);
      if (!round) return;
      const idx = m[2] ? parseInt(m[2]) - 1 : 0;
      if (idx >= 0 && idx < round.slots) out[roundKey][idx] = normalizeTeamName(value);
    });
  }

  return out;
}

function importBracketFile(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    try {
      const data = JSON.parse(ev.target.result);
      let imported = 0;

      if (Array.isArray(data)) {
        data.forEach(entry => {
          const player = entry.player;
          if (!PLAYERS.includes(player)) return;
          STATE.bracketPredictions[player] = normalizeBracketData(entry.bracket || entry);
          imported++;
        });
      } else if (data && typeof data === "object") {
        PLAYERS.forEach(player => {
          if (!data[player]) return;
          STATE.bracketPredictions[player] = normalizeBracketData(data[player].bracket || data[player]);
          imported++;
        });
      } else {
        throw new Error("Bracket JSON must be an object or array");
      }

      saveState();
      selectedBracketView = imported === 1
        ? PLAYERS.find(p => STATE.bracketPredictions[p] && Object.keys(STATE.bracketPredictions[p]).length) || selectedBracketView
        : selectedBracketView;
      renderBrackets();
      showBracketStatus(`Imported ${imported} bracket prediction${imported === 1 ? '' : 's'}!`, "success");
    } catch (err) {
      showBracketStatus("Error: " + err.message, "error");
    }
    e.target.value = "";
  };
  reader.readAsText(file);
}

function showBracketStatus(msg, type) {
  const existing = document.querySelector(".bracket-import-status");
  if (existing) existing.remove();
  const el = document.createElement("div");
  el.className = "bracket-import-status import-status " + type;
  el.textContent = msg;
  const wrap = document.getElementById("bracket-score-wrap");
  if (wrap) wrap.insertAdjacentElement("beforebegin", el);
  setTimeout(() => el.remove(), 5000);
}

// ============================================================
//  ACHIEVEMENTS
// ============================================================

function applyLoneWolfAchievements(unlocked) {
  const completed = MATCHES.filter(m => getMatchData(m.id).completed);
  completed.forEach(m => {
    const md = getMatchData(m.id);
    const outcomeGroups = {};
    const perfectHits = [];
    PLAYERS.forEach(p => {
      const pred = STATE.predictions[m.id]?.[p];
      if (!pred) return;
      const predOutcome = getOutcome(pred.home, pred.away);
      if (!outcomeGroups[predOutcome]) outcomeGroups[predOutcome] = [];
      outcomeGroups[predOutcome].push(p);
      if (pred.home === md.homeScore && pred.away === md.awayScore) perfectHits.push(p);
    });
    const actualOutcome = getOutcome(md.homeScore, md.awayScore);
    const correctOutcomeGroup = outcomeGroups[actualOutcome] || [];
    if (correctOutcomeGroup.length === 1) {
      const p = correctOutcomeGroup[0];
      if (!unlocked[p].includes("lone_wolf")) unlocked[p].push("lone_wolf");
    }
    if (perfectHits.length === 1) {
      const p = perfectHits[0];
      if (!unlocked[p].includes("lone_wolf_plus")) unlocked[p].push("lone_wolf_plus");
    }
  });
}

function getRankHistoryByDate() {
  const dates = getCompletedDates();
  return dates.map(date => ({ date, ranks: rankMapFromRows(getLeaderboardUntilDate(date)) }));
}

function applyRankHistoryAchievements(unlocked) {
  const history = getRankHistoryByDate();
  if (!history.length) return;
  const current = rankMapFromRows(getLeaderboard());

  PLAYERS.forEach(p => {
    const wasLast = history.some(h => h.ranks[p] === PLAYERS.length);
    if (wasLast && current[p] === 1 && !unlocked[p].includes("comeback_king")) {
      unlocked[p].push("comeback_king");
    }

    let leadStreak = 0;
    let hadThreeDayLead = false;
    history.forEach(h => {
      if (h.ranks[p] === 1) {
        leadStreak++;
        if (leadStreak >= 3) hadThreeDayLead = true;
      } else {
        leadStreak = 0;
      }
    });
    if (hadThreeDayLead && current[p] !== 1 && !unlocked[p].includes("bottler")) {
      unlocked[p].push("bottler");
    }
  });
}

function getUnlockedAchievements() {
  const unlocked = {};
  PLAYERS.forEach(p => {
    unlocked[p] = [];
    const stats = getPlayerStats(p);
    const completedMatches = MATCHES.filter(m => getMatchData(m.id).completed).sort((a, b) => a.id - b.id);
    let streak = 0, perfectStreak = 0;

    completedMatches.forEach(m => {
      const md = getMatchData(m.id);
      const pred = STATE.predictions[m.id]?.[p];
      if (!pred) { streak = 0; perfectStreak = 0; return; }
      const pts = calcPoints(pred.home, pred.away, md.homeScore, md.awayScore);
      if (pts >= 1) {
        streak++;
        if (pts === 4) perfectStreak++;
        else perfectStreak = 0;
      } else {
        streak = 0;
        perfectStreak = 0;
      }

      if (pts >= 1 && !unlocked[p].includes("first_blood")) unlocked[p].push("first_blood");
      if (streak >= 3 && !unlocked[p].includes("hat_trick")) unlocked[p].push("hat_trick");
      if (streak >= 5 && !unlocked[p].includes("on_fire")) unlocked[p].push("on_fire");
      if (streak >= 10 && !unlocked[p].includes("unstoppable")) unlocked[p].push("unstoppable");
      if (perfectStreak >= 3 && !unlocked[p].includes("sniper")) unlocked[p].push("sniper");

      if (pts === 4 && md.homeScore === 0 && md.awayScore === 0) {
        if (!unlocked[p].includes("clean_sheet")) unlocked[p].push("clean_sheet");
      }
      if (pts >= 1 && (md.homeScore + md.awayScore) >= 5) {
        if (!unlocked[p].includes("goal_fest")) unlocked[p].push("goal_fest");
      }
    });

    if (stats.perfect >= 5 && !unlocked[p].includes("oracle")) unlocked[p].push("oracle");
    if (stats.correct >= 10 && !unlocked[p].includes("consistent")) unlocked[p].push("consistent");

    const bank = STATE.bank[p];
    if (bank) {
      if (bank.balance >= 2000 && !unlocked[p].includes("whale")) unlocked[p].push("whale");
      if (bank.balance <= 200 && !unlocked[p].includes("broke")) unlocked[p].push("broke");
    }
  });

  applyLoneWolfAchievements(unlocked);
  applyRankHistoryAchievements(unlocked);

  return unlocked;
}

let selectedAchPlayer = "all";

function renderAchievements() {
  const unlocked = getUnlockedAchievements();

  // Player buttons
  const btnRow = document.querySelector(".player-select-row");
  let btnHtml = `<button class="player-btn ${selectedAchPlayer === 'all' ? 'active' : ''}" data-player="all">ALL</button>`;
  PLAYERS.forEach(p => {
    btnHtml += `<button class="player-btn ${selectedAchPlayer === p ? 'active' : ''}" data-player="${p}" style="border-color:${PLAYER_COLORS[p]}">${p.toUpperCase()}</button>`;
  });
  btnRow.innerHTML = btnHtml;
  btnRow.querySelectorAll(".player-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      selectedAchPlayer = btn.dataset.player;
      renderAchievements();
    });
  });

  let html = "";
  ACHIEVEMENTS.forEach(ach => {
    let owners = [];
    PLAYERS.forEach(p => {
      if (unlocked[p]?.includes(ach.id)) owners.push(p);
    });

    const isRelevant = selectedAchPlayer === "all" || owners.includes(selectedAchPlayer);
    const isUnlocked = selectedAchPlayer === "all" ? owners.length > 0 : owners.includes(selectedAchPlayer);
    if (selectedAchPlayer !== "all" && !isRelevant && !isUnlocked) {
      // Still show but locked
    }

    const cls = isUnlocked ? "unlocked" : "locked";
    let ownersHtml = "";
    if (owners.length > 0) {
      ownersHtml = `<div class="achievement-players">${owners.map(o =>
        `<span class="dot" style="background:${PLAYER_COLORS[o]}" title="${o}"></span>`
      ).join("")}</div>`;
    }

    html += `<div class="achievement-card ${cls}">
      <div class="achievement-icon">${ach.icon}</div>
      <div class="achievement-name">${ach.name}</div>
      <div class="achievement-desc">${ach.desc}</div>
      ${ownersHtml}
    </div>`;
  });

  document.getElementById("achievements-grid").innerHTML = html;
}

function checkAchievements() {
  // Called after saving predictions — just recalculate
}

// ============================================================
//  BANK
// ============================================================
let bankEditPlayer = null;

function renderBank() {
  let html = `<table class="bank-table">
    <thead><tr>
      <th>PLAYER</th><th>BALANCE</th><th>INVESTED</th><th>TOTAL</th><th>P/L</th><th></th>
    </tr></thead><tbody>`;

  PLAYERS.forEach(p => {
    const b = STATE.bank[p] || { balance: 1000, invested: 0 };
    const total = b.balance + b.invested;
    const pl = total - 1000;
    const plClass = pl >= 0 ? "positive" : "negative";
    const plStr = (pl >= 0 ? "+" : "") + pl;

    html += `<tr>
      <td><span class="player-dot" style="background:${PLAYER_COLORS[p]}"></span>${p}</td>
      <td>${b.balance} kr</td>
      <td>${b.invested} kr</td>
      <td>${total} kr</td>
      <td class="${plClass}">${plStr} kr</td>
      <td><button class="edit-btn" data-player="${p}">EDIT</button></td>
    </tr>`;
  });

  html += "</tbody></table>";
  document.getElementById("bank-table-wrap").innerHTML = html;

  document.querySelectorAll(".bank-table .edit-btn").forEach(btn => {
    btn.addEventListener("click", () => openBankEdit(btn.dataset.player));
  });

  if (!bankEditPlayer) {
    document.getElementById("bank-edit").classList.add("hidden");
  }
}

function openBankEdit(player) {
  bankEditPlayer = player;
  const b = STATE.bank[player] || { balance: 1000, invested: 0 };
  const el = document.getElementById("bank-edit");
  el.classList.remove("hidden");
  document.getElementById("bank-edit-title").textContent = player + " - EDIT BALANCE";
  document.getElementById("bank-edit-title").style.color = PLAYER_COLORS[player];

  el.querySelector(".bank-fields").innerHTML = `
    <div class="bank-field">
      <label>BALANCE (kr)</label>
      <input type="number" id="bank-bal" value="${b.balance}">
    </div>
    <div class="bank-field">
      <label>INVESTED (kr)</label>
      <input type="number" id="bank-inv" value="${b.invested}">
    </div>
  `;

  document.getElementById("bank-save").onclick = () => {
    STATE.bank[player] = {
      balance: parseInt(document.getElementById("bank-bal").value) || 0,
      invested: parseInt(document.getElementById("bank-inv").value) || 0,
    };
    saveState();
    bankEditPlayer = null;
    renderBank();
  };

  document.getElementById("bank-cancel").onclick = () => {
    bankEditPlayer = null;
    document.getElementById("bank-edit").classList.add("hidden");
  };
}

// ============================================================
//  JSON IMPORT
// ============================================================
document.getElementById("import-btn").addEventListener("click", () => {
  document.getElementById("import-file").click();
});

document.getElementById("import-file").addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    try {
      const data = JSON.parse(ev.target.result);
      let imported = 0;
      if (!Array.isArray(data)) throw new Error("JSON must be an array of match predictions");
      data.forEach(entry => {
        const matchId = entry.matchId;
        if (!matchId || !MATCHES.find(m => m.id === matchId)) return;
        if (!STATE.predictions[matchId]) STATE.predictions[matchId] = {};
        const preds = entry.predictions || {};
        PLAYERS.forEach(p => {
          if (preds[p] && preds[p].home != null && preds[p].away != null) {
            STATE.predictions[matchId][p] = {
              home: parseInt(preds[p].home),
              away: parseInt(preds[p].away),
            };
            imported++;
          }
        });
      });
      saveState();
      renderMatches();
      showImportStatus(`Imported ${imported} predictions!`, "success");
    } catch (err) {
      showImportStatus("Error: " + err.message, "error");
    }
    e.target.value = "";
  };
  reader.readAsText(file);
});

function showImportStatus(msg, type) {
  const existing = document.querySelector(".import-status");
  if (existing) existing.remove();
  const el = document.createElement("div");
  el.className = "import-status " + type;
  el.textContent = msg;
  document.getElementById("matches-list").insertAdjacentElement("beforebegin", el);
  setTimeout(() => el.remove(), 5000);
}

// ============================================================
//  INIT
// ============================================================
// Re-render whichever tab is currently visible (used after remote state lands).
function refreshActiveTab() {
  const active = document.querySelector(".tab.active")?.dataset.tab || "arena";
  if (active === "matches") renderMatches();
  else if (active === "standings") renderStandings();
  else if (active === "brackets") renderBrackets();
  else if (active === "achievements") renderAchievements();
  else if (active === "bank") renderBank();
  else renderArenaScoreboard();
}

// Reflect the current auth/admin state in the UI (login gate, account bar, edit access).
function applyAuthUI() {
  if (!(window.WCSync && WCSync.enabled)) {
    document.body.classList.add("is-admin"); // local/offline dev: full access
    return;
  }
  const authed = WCSync.isAuthed();
  const admin = authed && WCSync.isAdmin();
  document.body.classList.toggle("logged-in", authed);
  document.body.classList.toggle("is-admin", admin);

  const bar = document.getElementById("account-bar");
  if (bar) {
    bar.innerHTML = authed
      ? `<span class="account-email">${escapeHtml(WCSync.getEmail())}</span>` +
        `<span class="account-role ${admin ? 'admin' : 'viewer'}">${admin ? 'ADMIN' : 'VIEWER'}</span>` +
        `<button class="btn" id="signout-btn">SIGN OUT</button>`
      : "";
    const so = document.getElementById("signout-btn");
    if (so) so.onclick = async () => { await WCSync.signOut(); };
  }
}

function setupAuthUI() {
  const sendBtn = document.getElementById("login-send");
  const emailInput = document.getElementById("login-email");
  const status = document.getElementById("login-status");
  if (!sendBtn || !emailInput) return;

  async function send() {
    const email = emailInput.value.trim();
    if (!email) { status.textContent = "Enter your email first."; return; }
    sendBtn.disabled = true;
    status.textContent = "Sending…";
    try {
      await WCSync.signInWithEmail(email);
      status.textContent = "Check your email for a sign-in link.";
    } catch (e) {
      status.textContent = "Error: " + (e.message || e);
    } finally {
      sendBtn.disabled = false;
    }
  }
  sendBtn.addEventListener("click", send);
  emailInput.addEventListener("keydown", (e) => { if (e.key === "Enter") send(); });
}

function init() {
  setupGroupFilter();
  setupBracketControls();
  setupPlayerModal();
  setupAuthUI();
  const copyBtn = document.getElementById("copy-ai-prompt-btn");
  if (copyBtn) copyBtn.addEventListener("click", copyAiPrompt);

  renderArenaScoreboard();
  animateArena();

  if (window.WCSync && WCSync.enabled) {
    document.body.classList.add("sync-enabled");
    applyAuthUI();

    // Live updates from other devices / admin edits.
    WCSync.onRemoteState(data => {
      STATE = normalizeState(data);
      localStorage.setItem("wc26_state", JSON.stringify(STATE));
      refreshActiveTab();
    });
    // Auth changes (sign in/out, magic-link return).
    WCSync.onAuthChange(() => { applyAuthUI(); refreshActiveTab(); });

    WCSync.start().then(async () => {
      applyAuthUI();
      if (WCSync.isAuthed()) {
        const remote = await WCSync.fetchState();
        if (remote) {
          STATE = normalizeState(remote);
          localStorage.setItem("wc26_state", JSON.stringify(STATE));
        }
        refreshActiveTab();
      }
    });
  } else {
    document.body.classList.add("is-admin"); // local/offline dev: full access
  }
}

init();
