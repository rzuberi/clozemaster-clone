import { StorageManager } from "./storage_manager.js";
import { DataPipeline } from "./data_pipeline.js";
import { DifficultyManager } from "./difficulty_manager.js";
import { SRSScheduler } from "./srs.js";
import { SessionManager, SESSION_TYPE_ASSESSMENT, SESSION_TYPE_PRACTICE, SESSION_TYPE_QUICK } from "./session_manager.js";
import { AnalyticsDashboard } from "./analytics.js";

const PRACTICE_MODES = [
  { id: "typing", label: "Escribir" },
  { id: "multiple", label: "Opciones" },
  { id: "listening", label: "Escuchar" },
];

let storage;
let pipeline;
let difficulty;
let srs;
let sessionManager;
let analytics;
let currentMode = "typing";
let waitingForNext = false;
let hintVisible = false;

const elements = {};

const BADGES = [
  { id: "first-correct", title: "Primer acierto", description: "Tu primera respuesta correcta" },
  { id: "hundred-correct", title: "Cien aciertos", description: "100 respuestas correctas" },
  { id: "streak-3", title: "Racha x3", description: "Tres días seguidos practicando" },
  { id: "streak-7", title: "Racha x7", description: "Una semana completa de práctica" },
  { id: "assessment-complete", title: "Evaluación completa", description: "Completaste una evaluación diagnóstica" },
  { id: "perfect-streak", title: "Racha perfecta", description: "Diez respuestas seguidas correctas" },
];

const themeSequence = ["auto", "light", "dark"];

window.addEventListener("DOMContentLoaded", init);

async function init() {
  storage = new StorageManager();
  pipeline = new DataPipeline(storage);
  await pipeline.init();
  difficulty = new DifficultyManager(storage, pipeline);
  srs = new SRSScheduler(storage, difficulty, pipeline);
  analytics = new AnalyticsDashboard(storage, difficulty, srs);
  sessionManager = new SessionManager({
    storage,
    pipeline,
    difficulty,
    srs,
    onSessionUpdate: handleSessionUpdate,
    onAssessmentComplete: handleAssessmentComplete,
  });

  mapElements();
  setupUI();
  currentMode = storage.getState().settings.defaultMode || "typing";
  updateModeButtons();
  populatePlanForm();
  updateTheme();
  analytics.render();
  updateOverview();
  updateBadges();

  const resumed = sessionManager.resume();
  if (resumed) {
    renderSentence(resumed);
  } else {
    renderIdleState();
  }
}

function mapElements() {
  [
    "startPractice",
    "startQuick",
    "startAssessment",
    "resumeButton",
    "answerForm",
    "answerInput",
    "skipButton",
    "hintButton",
    "audioButton",
    "submitAnswer",
    "choiceButtons",
    "sentenceText",
    "translationHint",
    "feedback",
    "practiceModeGroup",
    "themeToggle",
    "dailyGoalInput",
    "quickLengthInput",
    "audioToggle",
    "planGrammar",
    "planVocabulary",
    "planDifficulty",
    "planSave",
    "planReset",
    "sessionProgress",
    "sessionAccuracy",
    "sessionTypeLabel",
    "sessionStats",
    "assessmentStatus",
    "endSessionButton",
    "overviewAnswered",
    "overviewAccuracy",
    "overviewLevel",
    "overviewGoal",
    "overviewStreak",
    "overviewLastAssessment",
    "heatmapGrid",
    "planSummary",
    "badgesList",
    "recommendations",
    "velocityWeekly",
    "velocityStreak",
    "dueNow",
    "dueSoon",
    "dueTotal",
    "toasts",
    "assessmentDialog",
    "assessmentClose",
    "assessmentSummary",
  ].forEach((id) => {
    elements[id] = document.getElementById(id);
  });
}

function setupUI() {
  PRACTICE_MODES.forEach((mode) => {
    const button = document.querySelector(`[data-mode="${mode.id}"]`);
    if (button) {
      button.addEventListener("click", () => setPracticeMode(mode.id));
    }
  });

  elements.startPractice?.addEventListener("click", () => {
    const plan = storage.getState().settings.plan || {};
    const focusPlan = {
      grammar: plan.grammar?.length ? plan.grammar : undefined,
      vocabulary: plan.vocabulary?.length ? plan.vocabulary : undefined,
      difficulty: plan.difficulty?.length ? plan.difficulty : undefined,
    };
    const sentence = sessionManager.startPractice({ focusPlan });
    if (sentence) {
      renderSentence(sentence);
      showToast("Sesión de práctica iniciada");
    }
  });

  elements.startQuick?.addEventListener("click", () => {
    const plan = storage.getState().settings.plan || {};
    const sentence = sessionManager.startQuickPractice({
      focusPlan: {
        grammar: plan.grammar,
        vocabulary: plan.vocabulary,
        difficulty: plan.difficulty,
      },
      length: storage.getState().settings.quickPracticeLength || 10,
    });
    if (sentence) {
      renderSentence(sentence);
      showToast("Práctica rápida lista");
    }
  });

  elements.startAssessment?.addEventListener("click", () => {
    const sentence = sessionManager.startAssessment();
    if (sentence) {
      currentMode = "typing";
      updateModeButtons();
      renderSentence(sentence);
      showToast("Evaluación diagnóstica iniciada");
    }
  });

  elements.resumeButton?.addEventListener("click", () => {
    const resumed = sessionManager.resume();
    if (resumed) {
      renderSentence(resumed);
      showToast("Sesión recuperada");
    } else {
      showToast("No hay sesión activa");
    }
  });

  elements.answerForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    if (currentMode !== "typing") return;
    submitAnswer(elements.answerInput?.value || "");
  });

  elements.skipButton?.addEventListener("click", () => {
    if (!sessionManager.getCurrentSentence()) return;
    sessionManager.advanceQueue();
    const next = sessionManager.getCurrentSentence();
    if (next) renderSentence(next);
  });

  elements.hintButton?.addEventListener("click", () => {
    const sentence = sessionManager.getCurrentSentence();
    if (!sentence) return;
    hintVisible = true;
    showHint(sentence);
  });

  elements.audioButton?.addEventListener("click", () => {
    const sentence = sessionManager.getCurrentSentence();
    if (sentence) speak(sentence);
  });

  elements.endSessionButton?.addEventListener("click", () => {
    sessionManager.endSession("user-ended");
    renderIdleState();
    analytics.render();
  });

  elements.themeToggle?.addEventListener("click", cycleTheme);

  elements.dailyGoalInput?.addEventListener("change", (event) => {
    const value = Number.parseInt(event.target.value, 10);
    storage.updateState((draft) => {
      draft.settings.dailyGoal = Number.isFinite(value) && value > 0 ? value : draft.settings.dailyGoal;
    });
    analytics.render();
    updateOverview();
  });

  elements.quickLengthInput?.addEventListener("change", (event) => {
    const value = Number.parseInt(event.target.value, 10);
    storage.updateState((draft) => {
      draft.settings.quickPracticeLength = Number.isFinite(value) && value > 0 ? value : 10;
    });
  });

  elements.audioToggle?.addEventListener("change", (event) => {
    const enabled = event.target.checked;
    storage.updateState((draft) => {
      draft.settings.audioEnabled = enabled;
    });
  });

  elements.planSave?.addEventListener("click", () => {
    const plan = readPlanForm();
    storage.updateState((draft) => {
      draft.settings.plan = plan;
    });
    updatePlanSummary();
    showToast("Plan de práctica guardado");
  });

  elements.planReset?.addEventListener("click", () => {
    storage.updateState((draft) => {
      draft.settings.plan = { grammar: [], vocabulary: [], difficulty: [], categories: [], dailyTarget: draft.settings.dailyGoal, mode: draft.settings.defaultMode };
    });
    populatePlanForm();
    updatePlanSummary();
  });

  elements.assessmentClose?.addEventListener("click", () => {
    if (elements.assessmentDialog) elements.assessmentDialog.close();
  });

  document.addEventListener("keydown", (event) => {
    if (currentMode === "multiple" && /^\d$/.test(event.key)) {
      const index = Number.parseInt(event.key, 10) - 1;
      const button = elements.choiceButtons?.querySelectorAll("button")[index];
      if (button) button.click();
    }
    if (event.key === "Enter" && currentMode !== "typing") {
      event.preventDefault();
    }
  });
}

function renderSentence(sentence) {
  if (!sentence) {
    renderIdleState();
    return;
  }
  waitingForNext = false;
  hintVisible = false;
  if (elements.sentenceText) {
    elements.sentenceText.textContent = sentence.clozeText || sentence.text;
  }
  if (elements.answerInput) {
    elements.answerInput.value = "";
    elements.answerInput.disabled = currentMode !== "typing";
    if (currentMode === "typing") elements.answerInput.focus();
  }
  if (elements.choiceButtons) {
    elements.choiceButtons.innerHTML = "";
  }
  if (elements.translationHint) {
    elements.translationHint.textContent = "";
    elements.translationHint.hidden = true;
  }
  setFeedback("");
  if (currentMode === "multiple") {
    renderMultipleChoice(sentence);
  }
  if (currentMode === "listening") {
    speak(sentence);
  }
}

function renderMultipleChoice(sentence) {
  if (!elements.choiceButtons) return;
  const distractors = pipeline.getDistractors(sentence.answer, {
    vocabulary: sentence.vocabulary,
    grammar: sentence.grammar,
  });
  const options = [sentence.answer, ...distractors];
  const shuffled = shuffle(options).slice(0, 4);
  elements.choiceButtons.innerHTML = "";
  shuffled.forEach((option, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = `${index + 1}. ${option}`;
    button.addEventListener("click", () => submitAnswer(option));
    elements.choiceButtons.appendChild(button);
  });
}

function submitAnswer(answer) {
  if (waitingForNext) return;
  if (currentMode === "typing" && (!answer || !answer.trim())) {
    return;
  }
  const result = sessionManager.submitAnswer(answer);
  if (!result) return;
  waitingForNext = true;
  const message = result.correct ? "✅ Correcto" : `❌ Correcto: ${result.expected}`;
  setFeedback(message, result.correct ? "success" : "error");
  animateCard(result.correct ? "correct" : "wrong");
  analytics.render();
  updateOverview();
  updateBadges();
  if (result.next) {
    setTimeout(() => {
      waitingForNext = false;
      renderSentence(result.next);
    }, 700);
  } else {
    renderIdleState();
  }
}

function setFeedback(message, variant) {
  if (!elements.feedback) return;
  elements.feedback.textContent = message;
  elements.feedback.className = "feedback";
  if (variant) elements.feedback.classList.add(`feedback--${variant}`);
}

function animateCard(kind) {
  const card = document.getElementById("card");
  if (!card) return;
  card.classList.remove("card--correct", "card--wrong");
  void card.offsetWidth;
  if (kind === "correct") card.classList.add("card--correct");
  if (kind === "wrong") card.classList.add("card--wrong");
}

function handleSessionUpdate(session) {
  updateModeButtons();
  updateSessionStats(session);
  if (session?.current) renderSentence(session.current);
  else renderIdleState();
  analytics.render();
}

function updateSessionStats(session) {
  if (!elements.sessionStats) return;
  if (!session) {
    elements.sessionStats.textContent = "Sin sesión activa";
    if (elements.sessionProgress) elements.sessionProgress.textContent = "0";
    if (elements.sessionAccuracy) elements.sessionAccuracy.textContent = "0%";
    if (elements.sessionTypeLabel) elements.sessionTypeLabel.textContent = "Modo libre";
    return;
  }
  const accuracy = session.answered ? Math.round((session.correct / session.answered) * 100) : 0;
  elements.sessionStats.textContent = `${session.correct}/${session.answered} aciertos`;
  if (elements.sessionProgress) elements.sessionProgress.textContent = `${session.answered}`;
  if (elements.sessionAccuracy) elements.sessionAccuracy.textContent = `${accuracy}%`;
  if (elements.sessionTypeLabel) {
    const labels = {
      [SESSION_TYPE_PRACTICE]: "Práctica",
      [SESSION_TYPE_QUICK]: "Rápida",
      [SESSION_TYPE_ASSESSMENT]: "Evaluación",
    };
    elements.sessionTypeLabel.textContent = labels[session.type] || "Práctica";
  }
  if (session.type === SESSION_TYPE_ASSESSMENT) {
    renderAssessmentStatus(session);
  } else if (elements.assessmentStatus) {
    elements.assessmentStatus.textContent = "";
  }
}

function renderAssessmentStatus(session) {
  if (!elements.assessmentStatus) return;
  const accuracy = session.answered ? Math.round((session.correct / session.answered) * 100) : 0;
  elements.assessmentStatus.textContent = `Evaluación · ${session.answered} ítems · ${accuracy}%`;
}

function renderIdleState() {
  if (elements.sentenceText) elements.sentenceText.textContent = "Inicia una práctica para comenzar";
  if (elements.choiceButtons) elements.choiceButtons.innerHTML = "";
  if (elements.answerInput) {
    elements.answerInput.value = "";
    elements.answerInput.disabled = false;
  }
  setFeedback("");
}

function updateModeButtons() {
  PRACTICE_MODES.forEach((mode) => {
    const button = document.querySelector(`[data-mode="${mode.id}"]`);
    if (!button) return;
    button.classList.toggle("is-active", mode.id === currentMode);
  });
  if (elements.answerInput) elements.answerInput.hidden = currentMode !== "typing";
  if (elements.choiceButtons) elements.choiceButtons.hidden = currentMode !== "multiple";
  if (elements.audioButton) elements.audioButton.hidden = currentMode !== "listening" && !storage.getState().settings.audioEnabled;
}

function setPracticeMode(mode) {
  currentMode = mode;
  storage.updateState((draft) => {
    draft.settings.defaultMode = mode;
  });
  updateModeButtons();
  const sentence = sessionManager.getCurrentSentence();
  renderSentence(sentence);
}

function showHint(sentence) {
  if (!elements.translationHint) return;
  const translation = sentence.translations?.find((t) => t.lang?.startsWith("en"))?.text || sentence.hint || "Piensa en el contexto";
  elements.translationHint.textContent = translation;
  elements.translationHint.hidden = false;
}

function speak(sentence) {
  if (!storage.getState().settings.audioEnabled) return;
  if (!window.speechSynthesis) return;
  const utterance = new SpeechSynthesisUtterance();
  utterance.text = sentence.text || sentence.clozeText?.replace("___", sentence.answer) || "";
  utterance.lang = "es-ES";
  speechSynthesis.cancel();
  speechSynthesis.speak(utterance);
}

function cycleTheme() {
  const current = storage.getState().settings.theme || "auto";
  const index = themeSequence.indexOf(current);
  const next = themeSequence[(index + 1) % themeSequence.length];
  storage.updateState((draft) => {
    draft.settings.theme = next;
  });
  updateTheme();
}

function updateTheme() {
  const mode = storage.getState().settings.theme || "auto";
  let theme = mode;
  if (mode === "auto") {
    const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    theme = prefersDark ? "dark" : "light";
  }
  document.documentElement.setAttribute("data-theme", theme);
  if (elements.themeToggle) {
    const icon = theme === "dark" ? "🌙" : theme === "light" ? "☀️" : "🌓";
    elements.themeToggle.textContent = `${icon} ${mode}`;
  }
}

function updateOverview() {
  const state = storage.getState();
  const answered = state.profile.totalAnswered || 0;
  const correct = state.profile.totalCorrect || 0;
  const accuracy = answered ? Math.round((correct / answered) * 100) : 0;
  if (elements.overviewAnswered) elements.overviewAnswered.textContent = answered;
  if (elements.overviewAccuracy) elements.overviewAccuracy.textContent = `${accuracy}%`;
  if (elements.overviewLevel) elements.overviewLevel.textContent = state.profile.overallLevel || "A1";
  if (elements.overviewGoal) elements.overviewGoal.textContent = state.settings.dailyGoal;
  if (elements.overviewStreak) elements.overviewStreak.textContent = state.streak.current || 0;
  if (elements.overviewLastAssessment) {
    elements.overviewLastAssessment.textContent = state.profile.lastAssessment?.completedAt
      ? new Date(state.profile.lastAssessment.completedAt).toLocaleDateString()
      : "—";
  }
}

function populatePlanForm() {
  const categories = pipeline.categories();
  populateSelect(elements.planGrammar, categories.grammar);
  populateSelect(elements.planVocabulary, categories.vocabulary);
  populateSelect(elements.planDifficulty, categories.difficulty);
  const settings = storage.getState().settings;
  setSelectedOptions(elements.planGrammar, settings.plan?.grammar || []);
  setSelectedOptions(elements.planVocabulary, settings.plan?.vocabulary || []);
  setSelectedOptions(elements.planDifficulty, settings.plan?.difficulty || []);
  if (elements.dailyGoalInput) elements.dailyGoalInput.value = settings.dailyGoal || 20;
  if (elements.quickLengthInput) elements.quickLengthInput.value = settings.quickPracticeLength || 10;
  if (elements.audioToggle) elements.audioToggle.checked = settings.audioEnabled || false;
  updatePlanSummary();
}

function populateSelect(select, options) {
  if (!select) return;
  select.innerHTML = "";
  options.sort().forEach((option) => {
    const opt = document.createElement("option");
    opt.value = option;
    opt.textContent = option;
    select.appendChild(opt);
  });
}

function setSelectedOptions(select, values) {
  if (!select || !Array.isArray(values)) return;
  Array.from(select.options).forEach((option) => {
    option.selected = values.includes(option.value);
  });
}

function readPlanForm() {
  return {
    grammar: getSelected(elements.planGrammar),
    vocabulary: getSelected(elements.planVocabulary),
    difficulty: getSelected(elements.planDifficulty),
    dailyTarget: Number.parseInt(elements.dailyGoalInput?.value, 10) || storage.getState().settings.dailyGoal || 20,
    mode: storage.getState().settings.defaultMode,
  };
}

function getSelected(select) {
  if (!select) return [];
  return Array.from(select.selectedOptions || []).map((opt) => opt.value);
}

function updatePlanSummary() {
  const plan = storage.getState().settings.plan || {};
  if (!elements.planSummary) return;
  const grammar = plan.grammar?.length ? plan.grammar.join(", ") : "—";
  const vocabulary = plan.vocabulary?.length ? plan.vocabulary.join(", ") : "—";
  const difficulty = plan.difficulty?.length ? plan.difficulty.join(", ") : "—";
  elements.planSummary.textContent = `Gramática: ${grammar} · Vocabulario: ${vocabulary} · Dificultad: ${difficulty}`;
}

function updateBadges() {
  const stateBefore = storage.getState();
  const totalCorrect = stateBefore.profile.totalCorrect || 0;
  if (totalCorrect >= 1) storage.registerBadge("first-correct", {});
  if (totalCorrect >= 100) storage.registerBadge("hundred-correct", {});
  if ((stateBefore.streak?.current || 0) >= 3) storage.registerBadge("streak-3", {});
  if ((stateBefore.streak?.best || 0) >= 7) storage.registerBadge("streak-7", {});
  if (stateBefore.profile.lastAssessment) storage.registerBadge("assessment-complete", {});
  const lastTen = (stateBefore.progressLog || []).slice(-10);
  if (lastTen.length === 10 && lastTen.every((entry) => entry.correct)) storage.registerBadge("perfect-streak", {});
  const stateAfter = storage.getState();
  renderBadges(stateAfter.gamification.badges || {});
}

function renderBadges(badges) {
  if (!elements.badgesList) return;
  elements.badgesList.innerHTML = "";
  BADGES.forEach((badge) => {
    const item = document.createElement("div");
    item.className = "badge";
    const achieved = Boolean(badges && badges[badge.id]);
    item.classList.toggle("badge--earned", achieved);
    const title = document.createElement("strong");
    title.textContent = badge.title;
    const desc = document.createElement("span");
    desc.textContent = badge.description;
    item.appendChild(title);
    item.appendChild(desc);
    if (achieved) {
      const date = document.createElement("small");
      date.textContent = new Date(badges[badge.id].achievedAt).toLocaleDateString();
      item.appendChild(date);
    }
    elements.badgesList.appendChild(item);
  });
}

function handleAssessmentComplete(report) {
  if (!elements.assessmentDialog || !elements.assessmentSummary) return;
  const accuracy = report.total ? Math.round((report.correct / report.total) * 100) : 0;
  const weak = report.weak?.map((entry) => `${entry.name} (${Math.round(entry.accuracy * 100)}%)`).join(", ") || "—";
  const strong = report.strong?.map((entry) => `${entry.name} (${Math.round(entry.accuracy * 100)}%)`).join(", ") || "—";
  elements.assessmentSummary.innerHTML = `
    <p><strong>Total:</strong> ${report.total} · ${accuracy}%</p>
    <p><strong>Nivel estimado:</strong> ${report.overall}</p>
    <p><strong>Puntos fuertes:</strong> ${strong}</p>
    <p><strong>Áreas a reforzar:</strong> ${weak}</p>
  `;
  elements.assessmentDialog.showModal();
  analytics.render();
  updateOverview();
}

function showToast(message) {
  if (!elements.toasts) return;
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = message;
  elements.toasts.appendChild(toast);
  setTimeout(() => toast.remove(), 3500);
}

function shuffle(list) {
  const arr = list.slice();
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export {};
