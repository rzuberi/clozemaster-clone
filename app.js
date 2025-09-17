/* =========================================
   Spanish Cloze Trainer (3-file static app)
   Added in this version:
   1) Shortcuts + "?" cheat-sheet modal
   2) SRS (EF/interval/nextDue) + due-first queue
   3) 90-day heatmap + Today / 7-day / 30-day stats
   ========================================= */

(function () {
  "use strict";

  const APP_VERSION = "v0.3.0";
  const STORAGE_KEY = "cloze.v1.progress";

  // ---------- Dataset (30 items) ----------
  const DATASET = [
    {id:"s_0001", lang:"es", text:"Él ___ en la casa.", cloze:"vive", distractors:["corre","come","duerme"], hint:"to live", note:"Vivir (él/ella): vive"},
    {id:"s_0002", lang:"es", text:"Yo quiero ___ agua.", cloze:"beber", distractors:["comer","tomar","correr"], hint:"to drink"},
    {id:"s_0003", lang:"es", text:"Nosotros ___ al parque.", cloze:"vamos", distractors:["voy","van","fui"], hint:"ir (nosotros): vamos"},
    {id:"s_0004", lang:"es", text:"Ella ___ estudiante.", cloze:"es", distractors:["está","eres","somos"], hint:"ser (ella): es"},
    {id:"s_0005", lang:"es", text:"Ellos ___ tarde.", cloze:"llegan", distractors:["llega","llegamos","sale"], hint:"llegar (ellos): llegan"},
    {id:"s_0006", lang:"es", text:"¿Cómo ___?", cloze:"estás", distractors:["eres","es","somos"], hint:"estar (tú): estás"},
    {id:"s_0007", lang:"es", text:"Me ___ el café.", cloze:"gusta", distractors:["gustan","encanta","odio"], hint:"gustar (sing.)"},
    {id:"s_0008", lang:"es", text:"Tengo que ___ ahora.", cloze:"ir", distractors:["venir","quedar","comer"], hint:"to go"},
    {id:"s_0009", lang:"es", text:"¿Dónde ___?", cloze:"vives", distractors:["vive","vivís","vivimos"], hint:"vivir (tú): vives"},
    {id:"s_0010", lang:"es", text:"___ español.", cloze:"Hablo", distractors:["Hablas","Hablamos","Hablan"], hint:"hablar (yo): hablo"},
    {id:"s_0011", lang:"es", text:"Quiero ___ una pregunta.", cloze:"hacer", distractors:["tener","tomar","poner"], hint:"to ask/make"},
    {id:"s_0012", lang:"es", text:"Vamos a ___ mañana.", cloze:"salir", distractors:["quedar","venir","volver"], hint:"to go out"},
    {id:"s_0013", lang:"es", text:"¿Puedes ___ más despacio?", cloze:"hablar", distractors:["correr","decir","leer"], hint:"to speak"},
    {id:"s_0014", lang:"es", text:"Necesito ___ dinero.", cloze:"ahorrar", distractors:["comprar","gastar","pedir"], hint:"to save (money)"},
    {id:"s_0015", lang:"es", text:"Él no ___ venir hoy.", cloze:"puede", distractors:["puedes","podemos","podrán"], hint:"poder (él): puede"},
    {id:"s_0016", lang:"es", text:"Hoy ___ frío.", cloze:"hace", distractors:["es","está","tiene"], hint:"weather: hace frío"},
    {id:"s_0017", lang:"es", text:"Ayer ___ a casa tarde.", cloze:"llegué", distractors:["llegó","llegamos","voy"], hint:"llegar (yo pret.): llegué"},
    {id:"s_0018", lang:"es", text:"Mañana ___ temprano.", cloze:"me levanto", distractors:["levanto","me levantaré","me levanté"], hint:"reflexive present"},
    {id:"s_0019", lang:"es", text:"Me ___ la música.", cloze:"encanta", distractors:["encantan","gusta","odio"], hint:"encantar (sing.)"},
    {id:"s_0020", lang:"es", text:"¿Qué ___ hacer?", cloze:"quieres", distractors:["quiere","quiero","queremos"], hint:"querer (tú): quieres"},
    {id:"s_0021", lang:"es", text:"No ___ tiempo.", cloze:"tengo", distractors:["tienes","hay","tuve"], hint:"tener (yo): tengo"},
    {id:"s_0022", lang:"es", text:"Ella ___ muy bien.", cloze:"canta", distractors:["canto","cantan","cantó"], hint:"cantar (ella): canta"},
    {id:"s_0023", lang:"es", text:"Estoy ___ español.", cloze:"aprendiendo", distractors:["aprendo","aprender","aprendido"], hint:"gerundio"},
    {id:"s_0024", lang:"es", text:"Vamos a ___ la cena.", cloze:"preparar", distractors:["preparando","hacer","cocinar"], hint:"to prepare"},
    {id:"s_0025", lang:"es", text:"¿Cuánto ___?", cloze:"cuesta", distractors:["costó","cuestan","vale"], hint:"to cost"},
    {id:"s_0026", lang:"es", text:"¿A qué hora ___?", cloze:"empiezas", distractors:["empieza","empezaste","empiezo"], hint:"empezar (tú)"},
    {id:"s_0027", lang:"es", text:"Me ___ la cabeza.", cloze:"duele", distractors:["duelen","dolió","duermo"], hint:"doler (sing.)"},
    {id:"s_0028", lang:"es", text:"___ a las ocho.", cloze:"Llego", distractors:["Llegas","Llegué","Llegamos"], hint:"llegar (yo): llego"},
    {id:"s_0029", lang:"es", text:"¿Puedes ___ la puerta?", cloze:"abrir", distractors:["cerrar","empujar","traer"], hint:"to open"},
    {id:"s_0030", lang:"es", text:"Quiero ___ contigo.", cloze:"hablar", distractors:["caminar","salir","ver"], hint:"to talk"}
  ];

  // ---------- Helpers ----------
  const el = (id) => document.getElementById(id);

  function normalize(s) {
    return (s ?? "")
      .toString()
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  }

  function londonToday() {
    const now = new Date();
    const s = now.toLocaleString("en-GB", {
      timeZone: "Europe/London",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }); // "dd/mm/yyyy"
    const [dd, mm, yyyy] = s.split("/");
    return `${yyyy}-${mm}-${dd}`;
  }

  function dateStrToUTC(dateStr) {
    const [y, m, d] = dateStr.split("-").map((x) => parseInt(x, 10));
    return new Date(Date.UTC(y, m - 1, d));
  }

  function addDaysStr(dateStr, delta) {
    const dt = dateStrToUTC(dateStr);
    dt.setUTCDate(dt.getUTCDate() + delta);
    const y = dt.getUTCFullYear();
    const m = String(dt.getUTCMonth() + 1).padStart(2, "0");
    const d = String(dt.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  function diffDays(a, b) {
    // days between a and b (YYYY-MM-DD)
    const A = dateStrToUTC(a); const B = dateStrToUTC(b);
    return Math.round((B - A) / 86400000);
  }

  function datasetHash() {
    const ids = DATASET.map((x) => x.id).join("|");
    let h = 0;
    for (let i = 0; i < ids.length; i++) h = (h * 31 + ids.charCodeAt(i)) >>> 0;
    return h.toString(16);
  }

  // ---------- State (LocalStorage) ----------
  const DEFAULT_STATE = () => ({
    version: 1,
    userId: "default",
    lastPracticeAt: null, // YYYY-MM-DD
    streak: { current: 0, best: 0, lastDate: null },
    daily: { byDate: {} }, // { "YYYY-MM-DD": {correct, wrong} }
    settings: { dailyGoal: 20, mode: "input" }, // mode: input|mc
    mastery: {} // id -> {correct, wrong, ef, interval, nextDue, lastAnswer, lastReviewedAt}
  });

  let state = loadState();
  let session = { correct: 0, answered: 0 };
  let currentId = null;             // current item id
  let waitingForNext = false;       // after correct, Enter advances
  let mcFocusIdx = 0;               // focused MC choice
  let currentChoices = [];          // rendered choices for MC
  const HASH = datasetHash();

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return DEFAULT_STATE();
      const parsed = JSON.parse(raw);
      if (!parsed.version || !parsed.daily || !parsed.streak) return DEFAULT_STATE();
      if (!parsed.settings) parsed.settings = { dailyGoal: 20, mode: "input" };
      return parsed;
    } catch {
      return DEFAULT_STATE();
    }
  }
  function saveState() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {}
  }

  // ---------- Streak & Daily ----------
  function incDaily(field) {
    const today = londonToday();
    const byDate = state.daily.byDate;
    if (!byDate[today]) byDate[today] = { correct: 0, wrong: 0 };
    byDate[today][field] += 1;
    state.lastPracticeAt = today;
  }
  function handleStreakOnCorrect() {
    const today = londonToday();
    const last = state.streak.lastDate;
    if (last === today) {
      // already counted today
    } else if (last === addDaysStr(today, -1)) {
      state.streak.current += 1;
      state.streak.lastDate = today;
      state.streak.best = Math.max(state.streak.best, state.streak.current);
    } else {
      state.streak.current = 1;
      state.streak.lastDate = today;
      state.streak.best = Math.max(state.streak.best, 1);
    }
  }

  // ---------- SRS (SM-2-ish) ----------
  function ensureMastery(id) {
    if (!state.mastery[id]) {
      state.mastery[id] = {
        correct: 0, wrong: 0,
        ef: 2.5,          // easiness factor
        interval: 0,      // days
        nextDue: londonToday(), // due now
        lastAnswer: null,
        lastReviewedAt: null
      };
    }
    return state.mastery[id];
  }

  function gradeCorrect(id, userAnswer) {
    const m = ensureMastery(id);
    m.correct += 1;
    // First correct → 1, then 2, then ef-multiplied
    if (m.interval <= 0) m.interval = 1;
    else if (m.interval === 1) m.interval = 2;
    else m.interval = Math.max(3, Math.round(m.interval * m.ef));
    // Adjust EF (bounded)
    m.ef = Math.min(3.0, Math.max(1.3, m.ef + 0.1));
    const today = londonToday();
    m.nextDue = addDaysStr(today, m.interval);
    m.lastAnswer = userAnswer;
    m.lastReviewedAt = new Date().toISOString();
  }

  function gradeWrong(id, userAnswer) {
    const m = ensureMastery(id);
    m.wrong += 1;
    // Make it come sooner
    m.ef = Math.min(3.0, Math.max(1.3, m.ef - 0.2));
    m.interval = 1; // short
    const today = londonToday();
    m.nextDue = today; // keep due today so it returns in queue
    m.lastAnswer = userAnswer;
    m.lastReviewedAt = new Date().toISOString();
  }

  // Build next item id: due → unseen → review
  function pickNextId(preferDifferentFrom) {
    const today = londonToday();
    const due = [];
    const unseen = [];
    const review = [];

    for (const item of DATASET) {
      const m = state.mastery[item.id];
      if (!m) { unseen.push(item.id); continue; }
      if (!m.nextDue || m.nextDue <= today) due.push(item.id);
      else review.push(item.id);
    }

    function pick(arr) {
      if (arr.length === 0) return null;
      // avoid repeating the same item unless no choice
      const choices = arr.length > 1 && preferDifferentFrom ? arr.filter(id => id !== preferDifferentFrom) : arr;
      return choices[Math.floor(Math.random() * choices.length)];
    }

    return pick(due) || pick(unseen) || pick(review) || DATASET[0].id;
  }

  // ---------- Rendering ----------
  function renderHeaderStats() {
    el("streakCurrent").textContent = state.streak.current;
    el("streakBest").textContent = state.streak.best;
    el("appVersion").textContent = `· ${APP_VERSION}`;
  }

  function renderTodayAndRing() {
    const today = londonToday();
    const goal = state.settings.dailyGoal || 20;
    el("dailyGoalText").textContent = goal;

    const stats = state.daily.byDate[today] || { correct: 0, wrong: 0 };
    el("todayCorrect").textContent = stats.correct;
    el("todayWrong").textContent = stats.wrong;

    const frac = Math.max(0, Math.min(1, stats.correct / goal));
    el("ringText").textContent = `${stats.correct}/${goal}`;

    const r = 45, C = 2 * Math.PI * r;
    const filled = C * frac, remaining = C - filled;
    el("ringFg").setAttribute("stroke-dasharray", `${filled} ${remaining}`);
  }

  function renderSessionBar() {
    const goal = state.settings.dailyGoal || 20;
    const frac = Math.max(0, Math.min(1, session.correct / goal));
    el("sessionCorrect").textContent = session.correct;
    el("sessionFill").style.width = `${frac * 100}%`;
  }

  function renderSentence() {
    const item = DATASET.find(x => x.id === currentId);
    const html = item.text.replace("___", `<span class="blank">___</span>`);
    el("sentence").innerHTML = html;
    el("feedback").textContent = "";
    el("feedback").className = "feedback";

    // Mode
    const mode = state.settings.mode || "input";
    if (mode === "input") {
      el("answer").hidden = false;
      el("choices").hidden = true;
      el("answer").value = "";
      el("answer").focus();
    } else {
      renderChoices(item);
      el("answer").hidden = true;
      el("choices").hidden = false;
      mcFocusIdx = 0;
      focusChoice(mcFocusIdx);
    }
    updateModeChips();
  }

  function renderChoices(item) {
    const pool = [item.cloze, ...item.distractors];
    currentChoices = shuffle(pool).slice(0, 4);
    const cdiv = el("choices");
    cdiv.innerHTML = "";
    currentChoices.forEach((opt, i) => {
      const b = document.createElement("button");
      b.textContent = `${i + 1}. ${opt}`;
      b.dataset.index = i;
      b.addEventListener("click", () => checkAnswer(opt));
      cdiv.appendChild(b);
    });
  }

  function updateModeChips() {
    const inputOn = state.settings.mode === "input";
    el("modeInputBtn").classList.toggle("chip--on", inputOn);
    el("modeInputBtn").setAttribute("aria-pressed", inputOn ? "true" : "false");
    el("modeMcBtn").classList.toggle("chip--on", !inputOn);
    el("modeMcBtn").setAttribute("aria-pressed", !inputOn ? "true" : "false");
  }

  function shuffle(a) {
    const arr = a.slice();
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  // ---------- Heatmap ----------
  function renderHeatmap() {
    const grid = el("heatGrid");
    grid.innerHTML = "";
    const today = londonToday();
    const start = addDaysStr(today, -89);
    const byDate = state.daily.byDate || {};

    // compute max to scale
    let maxCount = 0;
    for (let i = 0; i < 90; i++) {
      const d = addDaysStr(start, i);
      const c = (byDate[d]?.correct) || 0;
      if (c > maxCount) maxCount = c;
    }

    // stats
    const todayCount = (byDate[today]?.correct) || 0;
    let seven = 0, thirty = 0;
    for (let i = 0; i < 7; i++) seven += (byDate[addDaysStr(today, -i)]?.correct) || 0;
    for (let i = 0; i < 30; i++) thirty += (byDate[addDaysStr(today, -i)]?.correct) || 0;
    el("hmToday").textContent = todayCount;
    el("hm7d").textContent = seven;
    el("hm30d").textContent = thirty;

    // 13 columns x 7 rows grid (fill column by column)
    // We'll create 13*7 cells (may exceed 90; hide leading overflow)
    const totalCells = 13 * 7;
    const offset = totalCells - 90; // number of leading blanks
    for (let i = 0; i < totalCells; i++) {
      const cell = document.createElement("div");
      cell.className = "hm-cell";
      if (i < offset) {
        cell.style.visibility = "hidden";
      } else {
        const dayIdx = i - offset;
        const d = addDaysStr(start, dayIdx);
        const cnt = (byDate[d]?.correct) || 0;
        const lvl = levelFromCount(cnt, maxCount);
        if (lvl > 0) cell.classList.add(`hm-${lvl}`);
        if (d === today) cell.setAttribute("aria-current", "date");

        const tip = document.createElement("div");
        tip.className = "tip";
        tip.textContent = `${d}: ${cnt} correct`;
        cell.appendChild(tip);
        cell.setAttribute("role", "gridcell");
        cell.setAttribute("aria-label", `${d}: ${cnt} correct`);
      }
      grid.appendChild(cell);
    }
  }

  function levelFromCount(cnt, max) {
    if (cnt <= 0) return 0;
    if (max <= 1) return Math.min(5, cnt); // simple
    const ratio = cnt / max;
    if (ratio > 0.8) return 5;
    if (ratio > 0.6) return 4;
    if (ratio > 0.4) return 3;
    if (ratio > 0.2) return 2;
    return 1;
  }

  // ---------- Answering ----------
  function checkAnswer(inputVal) {
    const item = DATASET.find(x => x.id === currentId);
    const mode = state.settings.mode;
    const userRaw = (mode === "input") ? el("answer").value : inputVal;
    const user = normalize(userRaw);
    const correct = normalize(item.cloze);
    if (!user) return;

    if (user === correct) {
      el("feedback").textContent = "✅ Correct!";
      el("feedback").className = "feedback correct";
      session.correct += 1; session.answered += 1;
      incDaily("correct");
      handleStreakOnCorrect();
      gradeCorrect(item.id, userRaw);
      renderTodayAndRing();
      renderSessionBar();
      renderHeaderStats();
      renderHeatmap();
      waitingForNext = true;
      saveState();
    } else {
      el("feedback").textContent = `❌ Incorrect. Correct: ${item.cloze}`;
      el("feedback").className = "feedback wrong";
      session.answered += 1;
      incDaily("wrong");
      gradeWrong(item.id, userRaw);
      renderTodayAndRing();
      renderSessionBar();
      renderHeatmap();
      waitingForNext = false;
      saveState();
    }
  }

  function nextItem() {
    const nextId = pickNextId(currentId);
    currentId = nextId;
    renderSentence();
  }

  function repeatItem() {
    // simply re-render current without advancing
    waitingForNext = false;
    renderSentence();
  }

  // ---------- Mode / Hint ----------
  function toggleMode() {
    state.settings.mode = (state.settings.mode === "input") ? "mc" : "input";
    saveState();
    renderSentence();
  }
  function showHint() {
    const item = DATASET.find(x => x.id === currentId);
    if (!item) return;
    const msg = item.hint ? `Hint: ${item.hint}` : `Starts with: ${item.cloze[0]}`;
    el("feedback").textContent = msg;
    el("feedback").className = "feedback";
  }

  // ---------- MC focus helpers ----------
  function focusChoice(i) {
    const buttons = el("choices").querySelectorAll("button");
    buttons.forEach(b => b.classList.remove("choice--focused"));
    const target = buttons[i];
    if (target) target.classList.add("choice--focused");
  }
  function chooseChoice(i) {
    const opt = currentChoices[i];
    if (typeof opt === "string") checkAnswer(opt);
  }

  // ---------- Shortcuts & Modal ----------
  function openShortcuts() {
    const m = el("shortcutsModal");
    m.hidden = false;
    el("closeShortcuts").focus();
  }
  function closeShortcuts() {
    el("shortcutsModal").hidden = true;
  }

  function bindEvents() {
    // Buttons
    el("submitBtn").addEventListener("click", () => {
      if (waitingForNext) { waitingForNext = false; nextItem(); }
      else checkAnswer();
    });
    el("nextBtn").addEventListener("click", nextItem);
    el("repeatBtn").addEventListener("click", repeatItem);
    el("skipBtn").addEventListener("click", nextItem);
    el("hintBtn").addEventListener("click", showHint);
    el("modeInputBtn").addEventListener("click", () => { state.settings.mode="input"; saveState(); renderSentence(); });
    el("modeMcBtn").addEventListener("click", () => { state.settings.mode="mc"; saveState(); renderSentence(); });

    // Modal
    el("helpBtn").addEventListener("click", openShortcuts);
    el("closeShortcuts").addEventListener("click", closeShortcuts);
    el("okShortcuts").addEventListener("click", closeShortcuts);
    el("shortcutsModal").addEventListener("click", (e) => {
      if (e.target.id === "shortcutsModal") closeShortcuts();
    });

    // --- Keyboard (fixed: don't trigger G/N/etc while typing) ---
function isTypingTarget(t) {
  if (!t) return false;
  if (t.isContentEditable) return true;
  if (t.tagName === "TEXTAREA") return true;
  if (t.tagName === "INPUT") {
    const type = (t.getAttribute("type") || "text").toLowerCase();
    // treat most inputs (except buttons, checkboxes, etc.) as typing fields
    return !["button","submit","checkbox","radio","range","color","file","image","reset","hidden"].includes(type)
           && !t.readOnly && !t.disabled;
  }
  return false;
}

document.addEventListener("keydown", (e) => {
  const modalOpen = !el("shortcutsModal").hidden || !el("settingsModal").hidden || !el("importModal").hidden;
  if (modalOpen) {
    if (e.key === "Escape" || e.key === "Esc") {
      // close the topmost modal
      if (!el("shortcutsModal").hidden) el("shortcutsModal").hidden = true;
      else if (!el("settingsModal").hidden) el("settingsModal").hidden = true;
      else if (!el("importModal").hidden) el("importModal").hidden = true;
    }
    return;
  }

  const typing = isTypingTarget(e.target);
  const mode = state.settings.mode;

  // "?" opens shortcuts (Shift + / on many layouts). Allow even while typing.
  if (e.key === "?" || (e.shiftKey && e.key === "/")) { e.preventDefault(); openShortcuts(); return; }

  // When the cursor is **in a text field**, only handle Enter & Shift+Enter.
  if (typing) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (waitingForNext) { waitingForNext = false; nextItem(); }
      else checkAnswer();
    } else if (e.key === "Enter" && e.shiftKey) {
      e.preventDefault();
      nextItem();
    }
    // ignore all other shortcuts while typing (so "g" can be typed)
    return;
  }

  // "/" focuses the input (only when not already typing)
  if (e.key === "/") { e.preventDefault(); const a=el("answer"); if(!a.hidden){ a.focus(); a.select(); } return; }

  // Enter outside inputs
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    if (waitingForNext) { waitingForNext = false; nextItem(); }
    else if (mode === "mc") { chooseChoice(mcFocusIdx); }
    else { checkAnswer(); }
    return;
  }

  // Shift+Enter: skip
  if (e.key === "Enter" && e.shiftKey) { e.preventDefault(); nextItem(); return; }

  // R: repeat
  if (e.key.toLowerCase() === "r") { e.preventDefault(); repeatItem(); return; }

  // G or N: next
  if (e.key.toLowerCase() === "g" || e.key.toLowerCase() === "n") { e.preventDefault(); nextItem(); return; }

  // H: hint
  if (e.key.toLowerCase() === "h") { e.preventDefault(); showHint(); return; }

  // M: toggle mode
  if (e.key.toLowerCase() === "m") { e.preventDefault(); toggleMode(); return; }

  // D / U: export / import
  if (e.key.toLowerCase() === "d") { e.preventDefault(); exportProgress(); return; }
  if (e.key.toLowerCase() === "u") { e.preventDefault(); el("importFile").click(); return; }

  // 1–4 pick MC options (only when not typing and in MC mode)
  if (mode === "mc" && ["1","2","3","4"].includes(e.key)) {
    e.preventDefault();
    chooseChoice(parseInt(e.key, 10) - 1);
    return;
  }

  // Up/Down: cycle MC focus
  if (mode === "mc" && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
    e.preventDefault();
    const count = currentChoices.length;
    if (!count) return;
    mcFocusIdx = (mcFocusIdx + (e.key === "ArrowDown" ? 1 : -1) + count) % count;
    focusChoice(mcFocusIdx);
    return;
  }
});

    // Save on unload
    window.addEventListener("beforeunload", saveState);
  }

  // ---------- Boot ----------
  function computeInitialId() {
    // ensure mastery entries exist
    for (const item of DATASET) ensureMastery(item.id);
    return pickNextId(null);
  }

  function init() {
    bindEvents();
    currentId = computeInitialId();
    renderSentence();
    renderHeaderStats();
    renderTodayAndRing();
    renderSessionBar();
    renderHeatmap();
  }

  document.addEventListener("DOMContentLoaded", init);
})();

// --- Toast system ---
function showToast(msg) {
  const div = document.createElement("div");
  div.className = "toast";
  div.textContent = msg;
  el("toasts").appendChild(div);
  setTimeout(() => div.remove(), 3000);
}

// --- Import/Export ---
function exportProgress() {
  const data = { ...state, datasetHash: HASH, exportedAt: new Date().toISOString() };
  const blob = new Blob([JSON.stringify(data,null,2)], {type:"application/json"});
  const ts = new Date().toISOString().replace(/[-:]/g,"").slice(0,15);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `cloze-progress-${ts}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast("Progress exported");
}

function handleImportFile(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const imported = JSON.parse(e.target.result);
      if (imported.datasetHash !== HASH) { showToast("Dataset mismatch!"); return; }
      el("importPreview").textContent =
        `Last activity: ${imported.lastPracticeAt || "n/a"} | Streak: ${imported.streak.current}/${imported.streak.best}`;
      el("importModal").hidden = false;
      el("applyImport").onclick = () => {
        const mode = document.querySelector("input[name=importMode]:checked").value;
        if (mode === "replace") {
          state = imported;
        } else {
          // merge: keep higher correct counts and later timestamps
          for (const [id, m2] of Object.entries(imported.mastery||{})) {
            const m1 = state.mastery[id] || {};
            state.mastery[id] = { ...m1, ...m2 };
          }
          Object.assign(state.daily.byDate, imported.daily.byDate||{});
        }
        saveState();
        showToast("Import applied");
        el("importModal").hidden = true;
        renderHeaderStats(); renderHeatmap(); renderTodayAndRing();
      };
    } catch { showToast("Invalid file"); }
  };
  reader.readAsText(file);
}

// --- Settings modal ---
function openSettings() {
  el("goalInput").value = state.settings.dailyGoal || 20;
  el("themeSelect").value = state.settings.darkMode || "auto";
  el("ttsToggle").checked = !!state.settings.tts;
  el("settingsModal").hidden = false;
}
function saveSettings() {
  state.settings.dailyGoal = parseInt(el("goalInput").value,10)||20;
  state.settings.darkMode = el("themeSelect").value;
  state.settings.tts = el("ttsToggle").checked;
  applyTheme();
  saveState();
  el("settingsModal").hidden = true;
  showToast("Settings saved");
}
function applyTheme() {
  const mode = state.settings.darkMode || "auto";
  document.documentElement.dataset.theme = mode;
}
function resetProgress() {
  if (!confirm("Reset all progress?")) return;
  state = DEFAULT_STATE();
  saveState();
  showToast("Progress reset");
  renderHeaderStats(); renderHeatmap(); renderTodayAndRing();
}

// --- Bind events additions ---
el("exportBtn").addEventListener("click", exportProgress);
el("importBtn").addEventListener("click", ()=> el("importFile").click());
el("importFile").addEventListener("change", e=> {
  if (e.target.files.length) handleImportFile(e.target.files[0]);
});
el("closeImport").addEventListener("click", ()=> el("importModal").hidden = true);

el("settingsBtn").addEventListener("click", openSettings);
el("closeSettings").addEventListener("click", ()=> el("settingsModal").hidden = true);
el("saveSettings").addEventListener("click", saveSettings);
el("resetBtn").addEventListener("click", resetProgress);

// Keyboard shortcuts additions
document.addEventListener("keydown",(e)=>{
  if (e.key.toLowerCase()==="d"){ e.preventDefault(); exportProgress(); }
  if (e.key.toLowerCase()==="u"){ e.preventDefault(); el("importFile").click(); }
});

// Apply theme on load
applyTheme();
