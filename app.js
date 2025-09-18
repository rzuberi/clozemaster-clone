/* =========================================
   Spanish Cloze Trainer (3-file static app)
   Added in this version:
   • Progress dashboard with richer statistics
   • Responsive, touch-friendly layout and animated feedback
   • Theme toggle with light / dark / auto modes
   ========================================= */

(function () {
  "use strict";

  const APP_VERSION = "v0.4.0";
  const STORAGE_KEY = "cloze.v1.progress";
  const THEME_SEQUENCE = ["auto", "light", "dark"];

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
  const setText = (id, text) => { const node = el(id); if (node) node.textContent = text; };

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
    });
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
    const A = dateStrToUTC(a);
    const B = dateStrToUTC(b);
    return Math.round((B - A) / 86400000);
  }

  function datasetHash() {
    const ids = DATASET.map((x) => x.id).join("|");
    let h = 0;
    for (let i = 0; i < ids.length; i += 1) h = (h * 31 + ids.charCodeAt(i)) >>> 0;
    return h.toString(16);
  }

  function withStateDefaults(raw) {
    const base = DEFAULT_STATE();
    return {
      ...base,
      ...raw,
      streak: { ...base.streak, ...(raw?.streak || {}) },
      daily: { byDate: { ...(raw?.daily?.byDate || {}) } },
      settings: { ...base.settings, ...(raw?.settings || {}) },
      mastery: { ...(raw?.mastery || {}) },
    };
  }

  // ---------- State (LocalStorage) ----------
  const DEFAULT_STATE = () => ({
    version: 1,
    userId: "default",
    lastPracticeAt: null,
    streak: { current: 0, best: 0, lastDate: null },
    daily: { byDate: {} },
    settings: { dailyGoal: 20, mode: "input", darkMode: "auto", tts: false },
    mastery: {},
  });

  let state = loadState();
  let session = { correct: 0, answered: 0 };
  let currentId = null;
  let waitingForNext = false;
  let mcFocusIdx = 0;
  let currentChoices = [];
  const HASH = datasetHash();
  const mediaDark = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;

  applyTheme();
  if (mediaDark) {
    const listener = () => {
      if ((state.settings.darkMode || "auto") === "auto") {
        applyTheme();
        updateThemeToggle();
      }
    };
    if (typeof mediaDark.addEventListener === "function") mediaDark.addEventListener("change", listener);
    else if (typeof mediaDark.addListener === "function") mediaDark.addListener(listener);
  }

  document.addEventListener("DOMContentLoaded", init);

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return DEFAULT_STATE();
      const parsed = JSON.parse(raw);
      if (!parsed.version || !parsed.daily || !parsed.streak) return DEFAULT_STATE();
      return withStateDefaults(parsed);
    } catch {
      return DEFAULT_STATE();
    }
  }

  function saveState() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {}
  }

  function showToast(msg) {
    const wrap = el("toasts");
    if (!wrap) return;
    const div = document.createElement("div");
    div.className = "toast";
    div.textContent = msg;
    wrap.appendChild(div);
    setTimeout(() => div.remove(), 3200);
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
    if (last === today) return;
    if (last === addDaysStr(today, -1)) {
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
        correct: 0,
        wrong: 0,
        ef: 2.5,
        interval: 0,
        nextDue: londonToday(),
        lastAnswer: null,
        lastReviewedAt: null,
      };
    }
    return state.mastery[id];
  }

  function gradeCorrect(id, userAnswer) {
    const m = ensureMastery(id);
    m.correct += 1;
    if (m.interval <= 0) m.interval = 1;
    else if (m.interval === 1) m.interval = 2;
    else m.interval = Math.max(3, Math.round(m.interval * m.ef));
    m.ef = Math.min(3.0, Math.max(1.3, m.ef + 0.1));
    const today = londonToday();
    m.nextDue = addDaysStr(today, m.interval);
    m.lastAnswer = userAnswer;
    m.lastReviewedAt = new Date().toISOString();
  }

  function gradeWrong(id, userAnswer) {
    const m = ensureMastery(id);
    m.wrong += 1;
    m.ef = Math.min(3.0, Math.max(1.3, m.ef - 0.2));
    m.interval = 1;
    const today = londonToday();
    m.nextDue = today;
    m.lastAnswer = userAnswer;
    m.lastReviewedAt = new Date().toISOString();
  }

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
      const choices = arr.length > 1 && preferDifferentFrom ? arr.filter((id) => id !== preferDifferentFrom) : arr;
      return choices[Math.floor(Math.random() * choices.length)];
    }
    return pick(due) || pick(unseen) || pick(review) || DATASET[0].id;
  }

  // ---------- Rendering ----------
  function renderHeaderStats() {
    setText("streakCurrent", state.streak.current);
    setText("streakBest", state.streak.best);
    const version = el("appVersion");
    if (version) version.textContent = `· ${APP_VERSION}`;
  }

  function renderTodayAndRing() {
    const today = londonToday();
    const goal = Math.max(1, state.settings.dailyGoal || 20);
    setText("dailyGoalText", goal);
    const stats = state.daily.byDate[today] || { correct: 0, wrong: 0 };
    setText("todayCorrect", stats.correct);
    setText("todayWrong", stats.wrong);
    const frac = Math.max(0, Math.min(1, stats.correct / goal));
    setText("ringText", `${stats.correct}/${goal}`);
    const r = 45;
    const circumference = 2 * Math.PI * r;
    const filled = circumference * frac;
    const remaining = circumference - filled;
    const ringFg = el("ringFg");
    if (ringFg) ringFg.setAttribute("stroke-dasharray", `${filled} ${remaining}`);
  }

  function renderSessionBar() {
    const goal = Math.max(1, state.settings.dailyGoal || 20);
    const frac = Math.max(0, Math.min(1, session.correct / goal));
    setText("sessionCorrect", session.correct);
    const fill = el("sessionFill");
    if (fill) fill.style.width = `${frac * 100}%`;
    const bar = el("sessionBar");
    if (bar) {
      bar.setAttribute("aria-valuenow", Math.round(frac * 100));
      bar.setAttribute("aria-valuetext", `${session.correct} of ${goal}`);
    }
  }

  function setFeedback(message, variant) {
    const feedback = el("feedback");
    if (!feedback) return;
    feedback.textContent = message;
    feedback.className = "feedback";
    if (variant) {
      void feedback.offsetWidth;
      feedback.classList.add(variant);
    }
  }

  function triggerCardAnimation(kind) {
    const card = el("card");
    if (!card) return;
    card.classList.remove("animate-correct", "animate-wrong");
    if (!kind) return;
    void card.offsetWidth;
    card.classList.add(kind === "correct" ? "animate-correct" : "animate-wrong");
  }

  function renderSentence() {
    const item = DATASET.find((x) => x.id === currentId);
    if (!item) return;
    const sentence = el("sentence");
    if (sentence) sentence.innerHTML = item.text.replace("___", `<span class="blank">___</span>`);
    triggerCardAnimation(null);
    setFeedback("", null);

    const mode = state.settings.mode || "input";
    if (mode === "input") {
      const answer = el("answer");
      const choices = el("choices");
      if (answer) {
        answer.hidden = false;
        answer.value = "";
        answer.focus();
      }
      if (choices) choices.hidden = true;
    } else {
      renderChoices(item);
      const answer = el("answer");
      const choices = el("choices");
      if (answer) answer.hidden = true;
      if (choices) choices.hidden = false;
      mcFocusIdx = 0;
      focusChoice(mcFocusIdx);
    }
    updateModeChips();
  }

  function renderChoices(item) {
    const pool = [item.cloze, ...item.distractors];
    currentChoices = shuffle(pool).slice(0, 4);
    const cdiv = el("choices");
    if (!cdiv) return;
    cdiv.innerHTML = "";
    currentChoices.forEach((opt, i) => {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = `${i + 1}. ${opt}`;
      b.dataset.index = String(i);
      b.addEventListener("click", () => checkAnswer(opt));
      cdiv.appendChild(b);
    });
  }

  function updateModeChips() {
    const inputOn = state.settings.mode === "input";
    const inputBtn = el("modeInputBtn");
    const mcBtn = el("modeMcBtn");
    if (inputBtn) {
      inputBtn.classList.toggle("chip--on", inputOn);
      inputBtn.setAttribute("aria-pressed", inputOn ? "true" : "false");
    }
    if (mcBtn) {
      mcBtn.classList.toggle("chip--on", !inputOn);
      mcBtn.setAttribute("aria-pressed", !inputOn ? "true" : "false");
    }
  }

  function shuffle(arr) {
    const copy = arr.slice();
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  // ---------- Heatmap ----------
  function renderHeatmap() {
    const grid = el("heatGrid");
    if (!grid) return;
    grid.innerHTML = "";
    const today = londonToday();
    const start = addDaysStr(today, -89);
    const byDate = state.daily.byDate || {};

    let maxCount = 0;
    for (let i = 0; i < 90; i += 1) {
      const d = addDaysStr(start, i);
      const c = byDate[d]?.correct || 0;
      if (c > maxCount) maxCount = c;
    }

    const todayCount = byDate[today]?.correct || 0;
    let seven = 0;
    let thirty = 0;
    for (let i = 0; i < 7; i += 1) seven += byDate[addDaysStr(today, -i)]?.correct || 0;
    for (let i = 0; i < 30; i += 1) thirty += byDate[addDaysStr(today, -i)]?.correct || 0;
    setText("hmToday", todayCount);
    setText("hm7d", seven);
    setText("hm30d", thirty);

    const totalCells = 13 * 7;
    const offset = totalCells - 90;
    for (let i = 0; i < totalCells; i += 1) {
      const cell = document.createElement("div");
      cell.className = "hm-cell";
      if (i < offset) {
        cell.style.visibility = "hidden";
      } else {
        const dayIdx = i - offset;
        const d = addDaysStr(start, dayIdx);
        const cnt = byDate[d]?.correct || 0;
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
    if (max <= 1) return Math.min(5, cnt);
    const ratio = cnt / max;
    if (ratio > 0.8) return 5;
    if (ratio > 0.6) return 4;
    if (ratio > 0.4) return 3;
    if (ratio > 0.2) return 2;
    return 1;
  }
  // ---------- Progress Dashboard ----------
  function renderProgressDashboard() {
    const totalItems = DATASET.length || 1;
    const masteryValues = DATASET.map((item) => ensureMastery(item.id));
    const today = londonToday();
    const goal = Math.max(1, state.settings.dailyGoal || 20);

    let totalCorrect = 0;
    let totalWrong = 0;
    let newCount = 0;
    let learningCount = 0;
    let reviewCount = 0;
    let masteredCount = 0;
    let dueNow = 0;
    let dueSoon = 0;
    let intervalsSum = 0;
    let intervalsCount = 0;

    masteryValues.forEach((m) => {
      const correct = m?.correct || 0;
      const wrong = m?.wrong || 0;
      const interval = m?.interval || 0;
      const nextDue = m?.nextDue;
      const totalAnswers = correct + wrong;

      totalCorrect += correct;
      totalWrong += wrong;

      if (!m || totalAnswers === 0) {
        newCount += 1;
      } else if (interval >= 21 || correct >= 5) {
        masteredCount += 1;
      } else if (interval <= 2) {
        learningCount += 1;
      } else {
        reviewCount += 1;
      }

      if (!nextDue || nextDue <= today) dueNow += 1;
      else if (diffDays(today, nextDue) <= 3) dueSoon += 1;

      if (interval > 0) {
        intervalsSum += interval;
        intervalsCount += 1;
      }
    });

    const totalTracked = newCount + learningCount + reviewCount + masteredCount;
    if (totalTracked < totalItems) newCount += totalItems - totalTracked;

    const totalReviews = totalCorrect + totalWrong;
    const accuracy = totalReviews ? Math.round((totalCorrect / totalReviews) * 100) : 0;
    const sessionAccuracy = session.answered ? Math.round((session.correct / session.answered) * 100) : 0;

    const activeDates = Object.keys(state.daily.byDate || {});
    const activeDays = activeDates.length;
    const totalAttempts = activeDates.reduce((sum, date) => {
      const entry = state.daily.byDate[date] || { correct: 0, wrong: 0 };
      return sum + (entry.correct || 0) + (entry.wrong || 0);
    }, 0);
    const avgPerActiveDay = activeDays ? Math.round(totalAttempts / activeDays) : 0;

    let rolling7 = 0;
    for (let i = 0; i < 7; i += 1) {
      const entry = state.daily.byDate[addDaysStr(today, -i)];
      if (entry) rolling7 += (entry.correct || 0) + (entry.wrong || 0);
    }
    const avgInterval = intervalsCount ? (intervalsSum / intervalsCount).toFixed(1) : "0";

    setText("statTotalReviews", totalReviews);
    setText("statAccuracy", totalReviews ? `Accuracy — ${accuracy}% (${totalCorrect}✓ / ${totalWrong}✗)` : "Accuracy — 0% (0✓ / 0✗)");
    setText("statSessionAccuracy", session.answered ? `${sessionAccuracy}%` : "—");
    setText("statSessionTotals", session.answered ? `${session.correct} correct · ${session.answered} attempts` : "No answers yet this session");
    setText("statActiveDays", activeDays);
    setText("statAvgDaily", activeDays ? `Average — ${avgPerActiveDay} / day · 7d ${Math.round(rolling7 / 7)}` : `Goal — ${goal} / day`);
    setText("statCurrentStreak", state.streak.current);
    setText("statBestStreak", `Best — ${state.streak.best} days`);
    const started = Math.max(0, totalItems - newCount);
    setText("statItemsLearned", started);
    setText("statItemsMastered", `Mastered — ${masteredCount}`);
    setText("statDueNow", dueNow);
    setText("statDueSoon", `Next 3 days — ${dueSoon}`);
    setText("statAvgInterval", intervalsCount ? `Avg interval — ${avgInterval} d` : "Avg interval — 0 d");
    setText("statNewCount", newCount);
    setText("statLearningCount", learningCount);
    setText("statReviewCount", reviewCount);
    setText("statMasteredCount", masteredCount);

    const breakdownBar = el("breakdownBar");
    if (breakdownBar) breakdownBar.setAttribute("aria-label", `New ${newCount}, learning ${learningCount}, review ${reviewCount}, mastered ${masteredCount}`);

    const setWidth = (id, value) => {
      const node = el(id);
      if (node) {
        const clamped = Math.max(0, Math.min(value, totalItems));
        node.style.width = `${(clamped / totalItems) * 100}%`;
      }
    };
    setWidth("breakdownNew", newCount);
    setWidth("breakdownLearning", learningCount);
    setWidth("breakdownReview", reviewCount);
    setWidth("breakdownMastered", masteredCount);
  }

  // ---------- Answering ----------
  function checkAnswer(inputVal) {
    const item = DATASET.find((x) => x.id === currentId);
    if (!item) return;
    const mode = state.settings.mode || "input";
    const answerInput = el("answer");
    const userRaw = mode === "input" ? (answerInput ? answerInput.value : "") : inputVal;
    const user = normalize(userRaw);
    const correct = normalize(item.cloze);
    if (!user) return;

    if (user === correct) {
      setFeedback("✅ Correct!", "correct");
      triggerCardAnimation("correct");
      session.correct += 1;
      session.answered += 1;
      incDaily("correct");
      handleStreakOnCorrect();
      gradeCorrect(item.id, userRaw);
      renderTodayAndRing();
      renderSessionBar();
      renderHeaderStats();
      renderHeatmap();
      renderProgressDashboard();
      waitingForNext = true;
      saveState();
    } else {
      setFeedback(`❌ Incorrect. Correct: ${item.cloze}`, "wrong");
      triggerCardAnimation("wrong");
      session.answered += 1;
      incDaily("wrong");
      gradeWrong(item.id, userRaw);
      renderTodayAndRing();
      renderSessionBar();
      renderHeatmap();
      renderProgressDashboard();
      waitingForNext = false;
      saveState();
    }
  }

  function nextItem() {
    const nextId = pickNextId(currentId);
    currentId = nextId;
    waitingForNext = false;
    renderSentence();
  }

  function repeatItem() {
    waitingForNext = false;
    renderSentence();
  }

  function toggleMode() {
    state.settings.mode = state.settings.mode === "input" ? "mc" : "input";
    saveState();
    renderSentence();
  }

  function showHint() {
    const item = DATASET.find((x) => x.id === currentId);
    if (!item) return;
    const msg = item.hint ? `Hint: ${item.hint}` : `Starts with: ${item.cloze[0]}`;
    setFeedback(msg, null);
  }

  function focusChoice(i) {
    const choices = el("choices");
    if (!choices) return;
    const buttons = choices.querySelectorAll("button");
    buttons.forEach((b) => b.classList.remove("choice--focused"));
    const target = buttons[i];
    if (target) target.classList.add("choice--focused");
  }

  function chooseChoice(i) {
    const opt = currentChoices[i];
    if (typeof opt === "string") checkAnswer(opt);
  }

  // ---------- Shortcuts & Modal ----------
  function openShortcuts() {
    const modal = el("shortcutsModal");
    if (!modal) return;
    modal.hidden = false;
    const close = el("closeShortcuts");
    if (close) close.focus();
  }

  function closeShortcuts() {
    const modal = el("shortcutsModal");
    if (modal) modal.hidden = true;
  }

  function isTypingTarget(t) {
    if (!t) return false;
    if (t.isContentEditable) return true;
    if (t.tagName === "TEXTAREA") return true;
    if (t.tagName === "INPUT") {
      const type = (t.getAttribute("type") || "text").toLowerCase();
      return !["button","submit","checkbox","radio","range","color","file","image","reset","hidden"].includes(type)
        && !t.readOnly && !t.disabled;
    }
    return false;
  }

  function onKeyDown(e) {
    const shortcutsModal = el("shortcutsModal");
    const settingsModal = el("settingsModal");
    const importModal = el("importModal");
    const modalOpen = (shortcutsModal && !shortcutsModal.hidden) || (settingsModal && !settingsModal.hidden) || (importModal && !importModal.hidden);
    if (modalOpen) {
      if (e.key === "Escape" || e.key === "Esc") {
        if (shortcutsModal && !shortcutsModal.hidden) shortcutsModal.hidden = true;
        else if (settingsModal && !settingsModal.hidden) settingsModal.hidden = true;
        else if (importModal && !importModal.hidden) importModal.hidden = true;
      }
      return;
    }

    const typing = isTypingTarget(e.target);
    const mode = state.settings.mode || "input";

    if (e.key === "?" || (e.shiftKey && e.key === "/")) {
      e.preventDefault();
      openShortcuts();
      return;
    }

    if (typing) {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        if (waitingForNext) { waitingForNext = false; nextItem(); }
        else checkAnswer();
      } else if (e.key === "Enter" && e.shiftKey) {
        e.preventDefault();
        nextItem();
      }
      return;
    }

    if (e.key === "/") {
      e.preventDefault();
      const answer = el("answer");
      if (answer && !answer.hidden) {
        answer.focus();
        answer.select();
      }
      return;
    }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (waitingForNext) { waitingForNext = false; nextItem(); }
      else if (mode === "mc") { chooseChoice(mcFocusIdx); }
      else { checkAnswer(); }
      return;
    }

    if (e.key === "Enter" && e.shiftKey) {
      e.preventDefault();
      nextItem();
      return;
    }

    if (e.key.toLowerCase() === "r") { e.preventDefault(); repeatItem(); return; }
    if (e.key.toLowerCase() === "g" || e.key.toLowerCase() === "n") { e.preventDefault(); nextItem(); return; }
    if (e.key.toLowerCase() === "h") { e.preventDefault(); showHint(); return; }
    if (e.key.toLowerCase() === "m") { e.preventDefault(); toggleMode(); return; }
    if (e.key.toLowerCase() === "d") { e.preventDefault(); exportProgress(); return; }
    if (e.key.toLowerCase() === "u") { e.preventDefault(); const input = el("importFile"); if (input) input.click(); return; }
    if (e.key.toLowerCase() === "t") { e.preventDefault(); cycleThemePreference(); return; }

    if (mode === "mc" && ["1", "2", "3", "4"].includes(e.key)) {
      e.preventDefault();
      chooseChoice(parseInt(e.key, 10) - 1);
      return;
    }

    if (mode === "mc" && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
      e.preventDefault();
      const count = currentChoices.length;
      if (!count) return;
      mcFocusIdx = (mcFocusIdx + (e.key === "ArrowDown" ? 1 : -1) + count) % count;
      focusChoice(mcFocusIdx);
    }
  }

  function bindEvents() {
    const submitBtn = el("submitBtn");
    if (submitBtn) submitBtn.addEventListener("click", () => {
      if (waitingForNext) { waitingForNext = false; nextItem(); }
      else if ((state.settings.mode || "input") === "mc") { chooseChoice(mcFocusIdx); }
      else checkAnswer();
    });

    const nextBtn = el("nextBtn");
    if (nextBtn) nextBtn.addEventListener("click", nextItem);
    const repeatBtn = el("repeatBtn");
    if (repeatBtn) repeatBtn.addEventListener("click", repeatItem);
    const skipBtn = el("skipBtn");
    if (skipBtn) skipBtn.addEventListener("click", nextItem);
    const hintBtn = el("hintBtn");
    if (hintBtn) hintBtn.addEventListener("click", showHint);

    const modeInputBtn = el("modeInputBtn");
    if (modeInputBtn) modeInputBtn.addEventListener("click", () => { state.settings.mode = "input"; saveState(); renderSentence(); });
    const modeMcBtn = el("modeMcBtn");
    if (modeMcBtn) modeMcBtn.addEventListener("click", () => { state.settings.mode = "mc"; saveState(); renderSentence(); });

    const helpBtn = el("helpBtn");
    if (helpBtn) helpBtn.addEventListener("click", openShortcuts);
    const closeShortcutsBtn = el("closeShortcuts");
    if (closeShortcutsBtn) closeShortcutsBtn.addEventListener("click", closeShortcuts);
    const okShortcuts = el("okShortcuts");
    if (okShortcuts) okShortcuts.addEventListener("click", closeShortcuts);
    const shortcutsModal = el("shortcutsModal");
    if (shortcutsModal) shortcutsModal.addEventListener("click", (e) => { if (e.target === shortcutsModal) closeShortcuts(); });

    const themeToggle = el("themeToggle");
    if (themeToggle) themeToggle.addEventListener("click", cycleThemePreference);

    const settingsBtn = el("settingsBtn");
    if (settingsBtn) settingsBtn.addEventListener("click", openSettings);
    const closeSettingsBtn = el("closeSettings");
    if (closeSettingsBtn) closeSettingsBtn.addEventListener("click", () => { const modal = el("settingsModal"); if (modal) modal.hidden = true; });
    const saveSettingsBtn = el("saveSettings");
    if (saveSettingsBtn) saveSettingsBtn.addEventListener("click", saveSettings);
    const resetBtn = el("resetBtn");
    if (resetBtn) resetBtn.addEventListener("click", resetProgress);

    const exportBtn = el("exportBtn");
    if (exportBtn) exportBtn.addEventListener("click", exportProgress);
    const importBtn = el("importBtn");
    const importFile = el("importFile");
    if (importBtn && importFile) {
      importBtn.addEventListener("click", () => importFile.click());
      importFile.addEventListener("change", (e) => {
        const file = e.target.files && e.target.files[0];
        if (file) handleImportFile(file);
        e.target.value = "";
      });
    }
    const closeImportBtn = el("closeImport");
    if (closeImportBtn) closeImportBtn.addEventListener("click", () => { const modal = el("importModal"); if (modal) modal.hidden = true; });

    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("beforeunload", saveState);
  }
  // ---------- Import / Export & Settings ----------
  function exportProgress() {
    const data = { ...state, datasetHash: HASH, exportedAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const ts = new Date().toISOString().replace(/[-:]/g, "").slice(0, 15);
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
        if (imported.datasetHash && imported.datasetHash !== HASH) {
          showToast("Dataset mismatch!");
          return;
        }
        const preview = el("importPreview");
        if (preview) preview.textContent = `Last activity: ${imported.lastPracticeAt || "n/a"} | Streak: ${(imported.streak?.current || 0)}/${(imported.streak?.best || 0)}`;
        const modal = el("importModal");
        if (modal) modal.hidden = false;
        const applyBtn = el("applyImport");
        if (applyBtn) {
          applyBtn.onclick = () => {
            const mode = document.querySelector("input[name=importMode]:checked")?.value || "merge";
            if (mode === "replace") {
              state = withStateDefaults(imported);
            } else {
              const merged = withStateDefaults(state);
              for (const [id, m2] of Object.entries(imported.mastery || {})) {
                const current = merged.mastery[id] || {};
                merged.mastery[id] = { ...current, ...m2 };
              }
              Object.assign(merged.daily.byDate, imported.daily?.byDate || {});
              merged.streak = { ...merged.streak, ...(imported.streak || {}) };
              merged.settings = { ...merged.settings, ...(imported.settings || {}) };
              merged.lastPracticeAt = imported.lastPracticeAt || merged.lastPracticeAt;
              state = merged;
            }
            applyTheme();
            updateThemeToggle();
            const themeSelect = el("themeSelect");
            if (themeSelect) themeSelect.value = state.settings.darkMode || "auto";
            const goalInput = el("goalInput");
            if (goalInput) goalInput.value = Math.max(1, state.settings.dailyGoal || 20);
            const ttsToggle = el("ttsToggle");
            if (ttsToggle) ttsToggle.checked = !!state.settings.tts;
            session = { correct: 0, answered: 0 };
            waitingForNext = false;
            currentId = computeInitialId();
            saveState();
            showToast("Import applied");
            if (modal) modal.hidden = true;
            renderHeaderStats();
            renderHeatmap();
            renderTodayAndRing();
            renderSessionBar();
            renderProgressDashboard();
            renderSentence();
          };
        }
      } catch {
        showToast("Invalid file");
      }
    };
    reader.readAsText(file);
  }

  function openSettings() {
    const goalInput = el("goalInput");
    if (goalInput) goalInput.value = Math.max(1, state.settings.dailyGoal || 20);
    const themeSelect = el("themeSelect");
    if (themeSelect) themeSelect.value = state.settings.darkMode || "auto";
    const ttsToggle = el("ttsToggle");
    if (ttsToggle) ttsToggle.checked = !!state.settings.tts;
    const modal = el("settingsModal");
    if (modal) modal.hidden = false;
  }

  function saveSettings() {
    const goalInput = el("goalInput");
    if (goalInput) {
      const goal = parseInt(goalInput.value, 10);
      if (!Number.isNaN(goal) && goal > 0) {
        state.settings.dailyGoal = Math.min(200, Math.max(1, goal));
      }
    }
    const themeSelect = el("themeSelect");
    if (themeSelect) state.settings.darkMode = themeSelect.value || "auto";
    const ttsToggle = el("ttsToggle");
    if (ttsToggle) state.settings.tts = ttsToggle.checked;
    applyTheme();
    updateThemeToggle();
    saveState();
    renderTodayAndRing();
    renderSessionBar();
    renderProgressDashboard();
    const modal = el("settingsModal");
    if (modal) modal.hidden = true;
    showToast("Settings saved");
  }

  function applyTheme() {
    const preference = state.settings.darkMode || "auto";
    let resolved = preference;
    if (preference === "auto") {
      const prefersDark = mediaDark ? mediaDark.matches : window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
      resolved = prefersDark ? "dark" : "light";
    }
    document.documentElement.dataset.theme = resolved;
    document.documentElement.dataset.themePref = preference;
  }

  function updateThemeToggle() {
    const btn = el("themeToggle");
    if (!btn) return;
    const pref = state.settings.darkMode || "auto";
    const icon = pref === "dark" ? "🌙" : pref === "light" ? "☀️" : "🌓";
    const label = pref === "dark" ? "Dark theme" : pref === "light" ? "Light theme" : "Auto theme (match system)";
    btn.textContent = icon;
    btn.setAttribute("aria-label", `${label}. Click to change theme`);
    btn.setAttribute("title", `${label} · tap to change`);
    btn.dataset.mode = pref;
  }

  function cycleThemePreference() {
    const current = state.settings.darkMode || "auto";
    const idx = THEME_SEQUENCE.indexOf(current);
    const next = THEME_SEQUENCE[(idx + 1) % THEME_SEQUENCE.length];
    state.settings.darkMode = next;
    applyTheme();
    updateThemeToggle();
    saveState();
    const labels = { auto: "Auto theme", light: "Light theme", dark: "Dark theme" };
    showToast(`${labels[next]} enabled`);
    const themeSelect = el("themeSelect");
    if (themeSelect) themeSelect.value = next;
  }

  function resetProgress() {
    if (!confirm("Reset all progress?")) return;
    state = DEFAULT_STATE();
    session = { correct: 0, answered: 0 };
    currentId = computeInitialId();
    waitingForNext = false;
    applyTheme();
    updateThemeToggle();
    const goalInput = el("goalInput");
    if (goalInput) goalInput.value = Math.max(1, state.settings.dailyGoal || 20);
    const themeSelect = el("themeSelect");
    if (themeSelect) themeSelect.value = state.settings.darkMode || "auto";
    const ttsToggle = el("ttsToggle");
    if (ttsToggle) ttsToggle.checked = !!state.settings.tts;
    saveState();
    showToast("Progress reset");
    renderHeaderStats();
    renderTodayAndRing();
    renderSessionBar();
    renderHeatmap();
    renderProgressDashboard();
    renderSentence();
  }

  // ---------- Boot ----------
  function computeInitialId() {
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
    renderProgressDashboard();
    updateThemeToggle();
  }
})();
