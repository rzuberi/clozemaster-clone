import { todayStr } from "./storage_manager.js";

const SESSION_TYPE_ASSESSMENT = "assessment";
const SESSION_TYPE_PRACTICE = "practice";
const SESSION_TYPE_QUICK = "quick";

function normalize(input) {
  return (input || "")
    .toString()
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function generateSessionId(type) {
  return `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

class SessionManager {
  constructor({ storage, pipeline, difficulty, srs, onSessionUpdate, onAssessmentComplete }) {
    this.storage = storage;
    this.pipeline = pipeline;
    this.difficulty = difficulty;
    this.srs = srs;
    this.onSessionUpdate = onSessionUpdate;
    this.onAssessmentComplete = onAssessmentComplete;
    this.session = null;
  }

  resume() {
    const snapshot = this.storage.getState().sessions?.active;
    if (!snapshot) return null;
    this.session = this.rehydrateSession(snapshot);
    if (this.session && this.onSessionUpdate) this.onSessionUpdate(this.session);
    return this.getCurrentSentence();
  }

  startPractice(options = {}) {
    const focusPlan = options.focusPlan || this.difficulty.getFocusPlan(options.preferred);
    const pool = this.pipeline.getPracticePool({
      grammar: focusPlan.grammar,
      vocabulary: focusPlan.vocabulary,
      difficulty: focusPlan.difficulty,
      limit: 20,
    });
    const [first, ...rest] = pool;
    const sessionType = options.type || SESSION_TYPE_PRACTICE;
    const session = {
      id: generateSessionId(sessionType),
      type: sessionType,
      startedAt: new Date().toISOString(),
      practiceMode: options.practiceMode || this.storage.getState().settings.defaultMode || "typing",
      queue: rest,
      focusPlan,
      pointer: 0,
      current: first || null,
      answered: 0,
      correct: 0,
      streak: 0,
      history: [],
      perCategory: this.emptyPerCategory(),
      maxQuestions: options.maxQuestions || (sessionType === SESSION_TYPE_QUICK ? (options.length || 10) : Infinity),
      settings: options,
    };
    this.session = session;
    this.persistSession();
    if (this.onSessionUpdate) this.onSessionUpdate(this.session);
    return this.getCurrentSentence();
  }

  startQuickPractice(options = {}) {
    const config = {
      ...options,
      practiceMode: options.practiceMode || "quick",
      maxQuestions: options.length || this.storage.getState().settings.quickPracticeLength || 10,
    };
    return this.startPractice({ ...config, type: SESSION_TYPE_QUICK });
  }

  startAssessment() {
    const batch = this.pipeline.getAssessmentSeed(80);
    const session = {
      id: generateSessionId(SESSION_TYPE_ASSESSMENT),
      type: SESSION_TYPE_ASSESSMENT,
      startedAt: new Date().toISOString(),
      queue: batch,
      pointer: 0,
      current: batch[0] || null,
      answered: 0,
      correct: 0,
      streak: 0,
      perCategory: this.emptyPerCategory(),
      history: [],
      maxQuestions: 500,
      stats: { grammar: {}, vocabulary: {}, difficulty: {} },
      adaptiveStage: 0,
      focusPlan: this.difficulty.getFocusPlan(),
    };
    this.session = session;
    this.persistSession();
    if (this.onSessionUpdate) this.onSessionUpdate(this.session);
    return this.getCurrentSentence();
  }

  emptyPerCategory() {
    return {
      grammar: {},
      vocabulary: {},
      difficulty: {},
    };
  }

  rehydrateSession(snapshot) {
    const queue = (snapshot.queueIds || []).map((id) => this.pipeline.getSentenceById(id)).filter(Boolean);
    const current = snapshot.currentId ? this.pipeline.getSentenceById(snapshot.currentId) : queue[0] || null;
    return {
      id: snapshot.id,
      type: snapshot.type,
      startedAt: snapshot.startedAt,
      practiceMode: snapshot.practiceMode,
      queue,
      pointer: snapshot.pointer || 0,
      current,
      answered: snapshot.answered || 0,
      correct: snapshot.correct || 0,
      streak: snapshot.streak || 0,
      perCategory: snapshot.perCategory || this.emptyPerCategory(),
      history: snapshot.history || [],
      maxQuestions: snapshot.maxQuestions || Infinity,
      stats: snapshot.stats || { grammar: {}, vocabulary: {}, difficulty: {} },
      adaptiveStage: snapshot.adaptiveStage || 0,
      focusPlan: snapshot.focusPlan || this.difficulty.getFocusPlan(),
      settings: snapshot.settings || {},
    };
  }

  persistSession() {
    const snapshot = this.session
      ? {
          id: this.session.id,
          type: this.session.type,
          startedAt: this.session.startedAt,
          practiceMode: this.session.practiceMode,
          queueIds: (this.session.queue || []).map((item) => item.id),
          pointer: this.session.pointer,
          currentId: this.session.current?.id || null,
          answered: this.session.answered,
          correct: this.session.correct,
          streak: this.session.streak,
          perCategory: this.session.perCategory,
          history: this.session.history?.slice(-200) || [],
          maxQuestions: this.session.maxQuestions,
          stats: this.session.stats,
          adaptiveStage: this.session.adaptiveStage,
          focusPlan: this.session.focusPlan,
          settings: this.session.settings,
        }
      : null;
    this.storage.updateState((draft) => {
      if (!draft.sessions) draft.sessions = { active: null, history: [] };
      draft.sessions.active = snapshot;
    });
  }

  getCurrentSentence() {
    return this.session?.current || null;
  }

  refillQueue() {
    if (!this.session || this.session.type === SESSION_TYPE_ASSESSMENT) return;
    while ((this.session.queue || []).length < 15) {
      const next = this.srs.selectNextSentence(this.session.current?.id, {
        focusPlan: this.session.focusPlan,
        excludeIds: (this.session.queue || []).map((item) => item.id),
      });
      if (!next) break;
      this.session.queue.push(next);
    }
  }

  advanceQueue() {
    if (!this.session) return null;
    if (this.session.type === SESSION_TYPE_ASSESSMENT) {
      this.session.pointer += 1;
      if (this.session.pointer < this.session.queue.length) {
        this.session.current = this.session.queue[this.session.pointer];
      } else if (this.session.answered < this.session.maxQuestions) {
        this.expandAssessmentQueue();
        this.session.current = this.session.queue[this.session.pointer] || null;
      } else {
        this.session.current = null;
      }
    } else {
      if (!Array.isArray(this.session.queue)) this.session.queue = [];
      if (this.session.queue.length > 0) {
        this.session.current = this.session.queue.shift();
      }
      if (!this.session.current) {
        this.refillQueue();
        this.session.current = this.session.queue.shift() || null;
      }
    }
    this.persistSession();
    if (this.onSessionUpdate) this.onSessionUpdate(this.session);
    return this.session.current;
  }

  expandAssessmentQueue() {
    if (!this.session || this.session.type !== SESSION_TYPE_ASSESSMENT) return;
    const answered = this.session.answered;
    const accuracy = answered ? this.session.correct / answered : 0;
    if (answered >= this.session.maxQuestions) return;
    if (this.session.queue.length >= this.session.maxQuestions) return;
    const focusPlan = this.difficulty.getFocusPlan();
    const batch = this.pipeline.getPracticePool({
      grammar: focusPlan.grammar,
      vocabulary: focusPlan.vocabulary,
      difficulty: focusPlan.difficulty,
      limit: 30,
      excludeIds: this.session.queue.map((item) => item.id),
    });
    if (batch.length) {
      this.session.queue.push(...batch);
    } else if (accuracy > 0.85) {
      this.session.queue.push(...this.pipeline.getPracticePool({ limit: 20 }));
    }
  }

  submitAnswer(rawAnswer) {
    if (!this.session || !this.session.current) return null;
    const sentence = this.session.current;
    const expected = normalize(sentence.answer);
    const user = normalize(rawAnswer);
    const correct = user === expected;
    this.session.answered += 1;
    if (correct) {
      this.session.correct += 1;
      this.session.streak += 1;
    } else {
      this.session.streak = 0;
    }
    const timestamp = new Date().toISOString();
    this.session.history.push({
      sentenceId: sentence.id,
      correct,
      timestamp,
      categories: { grammar: sentence.grammar, vocabulary: sentence.vocabulary, difficulty: sentence.difficulty },
    });
    this.updatePerCategory(sentence, correct);
    this.logResult(sentence, correct, timestamp);
    if (this.session.type === SESSION_TYPE_ASSESSMENT) {
      this.updateAssessmentStats(sentence, correct);
    }
    if (this.session.type !== SESSION_TYPE_ASSESSMENT) {
      this.srs.recordOutcome(sentence, correct);
    }
    this.difficulty.recordResult(sentence, correct);
    this.persistSession();
    const next = this.advanceQueue();
    this.checkAssessmentCompletion();
    return { sentence, correct, expected: sentence.answer, next };
  }

  updatePerCategory(sentence, correct) {
    const perCategory = this.session.perCategory;
    ["grammar", "vocabulary"].forEach((type) => {
      (sentence[type] || []).forEach((category) => {
        if (!perCategory[type][category]) perCategory[type][category] = { correct: 0, total: 0 };
        if (correct) perCategory[type][category].correct += 1;
        perCategory[type][category].total += 1;
      });
    });
    const level = sentence.difficulty || "A1";
    if (!perCategory.difficulty[level]) perCategory.difficulty[level] = { correct: 0, total: 0 };
    if (correct) perCategory.difficulty[level].correct += 1;
    perCategory.difficulty[level].total += 1;
  }

  updateAssessmentStats(sentence, correct) {
    const stats = this.session.stats;
    ["grammar", "vocabulary"].forEach((type) => {
      (sentence[type] || []).forEach((category) => {
        if (!stats[type][category]) stats[type][category] = { correct: 0, total: 0 };
        if (correct) stats[type][category].correct += 1;
        stats[type][category].total += 1;
      });
    });
    const level = sentence.difficulty || "A1";
    if (!stats.difficulty[level]) stats.difficulty[level] = { correct: 0, total: 0 };
    if (correct) stats.difficulty[level].correct += 1;
    stats.difficulty[level].total += 1;
  }

  logResult(sentence, correct, timestamp) {
    this.storage.logInteraction({
      sentenceId: sentence.id,
      correct,
      timestamp,
      categories: { grammar: sentence.grammar, vocabulary: sentence.vocabulary, difficulty: sentence.difficulty },
      mode: this.session.practiceMode,
      sessionType: this.session.type,
    });
    this.storage.incrementDaily(correct ? "correct" : "wrong");
    this.storage.updateStreak(correct);
  }

  checkAssessmentCompletion() {
    if (!this.session || this.session.type !== SESSION_TYPE_ASSESSMENT) return;
    const answered = this.session.answered;
    const accuracy = answered ? this.session.correct / answered : 0;
    const shouldStopEarly = answered >= 40 && (accuracy >= 0.87 || accuracy <= 0.45);
    const reachedLimit = answered >= this.session.maxQuestions;
    if ((shouldStopEarly || reachedLimit || !this.session.current) && this.session) {
      const report = this.difficulty.buildAssessmentReport(this.session.history);
      report.total = this.session.answered;
      report.correct = this.session.correct;
      report.accuracy = accuracy;
      report.perCategory = this.session.stats;
      this.storage.completeAssessment(report);
      if (this.onAssessmentComplete) this.onAssessmentComplete(report);
      this.endSession("assessment-complete", report);
    }
  }

  endSession(reason, payload) {
    if (!this.session) return;
    const summary = {
      id: this.session.id,
      type: this.session.type,
      endedAt: new Date().toISOString(),
      answered: this.session.answered,
      correct: this.session.correct,
      accuracy: this.session.answered ? this.session.correct / this.session.answered : 0,
      reason,
      payload,
    };
    this.storage.updateState((draft) => {
      if (!draft.sessions) draft.sessions = { active: null, history: [] };
      draft.sessions.history = [summary, ...(draft.sessions.history || [])].slice(0, 20);
      draft.sessions.active = null;
    });
    this.session = null;
    if (this.onSessionUpdate) this.onSessionUpdate(null);
  }
}

export { SessionManager, SESSION_TYPE_ASSESSMENT, SESSION_TYPE_PRACTICE, SESSION_TYPE_QUICK };
