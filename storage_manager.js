const STORAGE_VERSION = 2;
const STATE_KEY = "cloze.mastery.state.v2";
const CACHE_KEY = "cloze.mastery.cache.v1";
const MAX_PROGRESS_LOG = 2500;
const MAX_CATEGORY_HISTORY = 40;

const todayStr = () => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const DEFAULT_STATE = () => ({
  version: STORAGE_VERSION,
  userId: `user-${Math.random().toString(36).slice(2, 10)}`,
  createdAt: new Date().toISOString(),
  lastSeenAt: null,
  settings: {
    theme: "auto",
    defaultMode: "typing",
    audioEnabled: false,
    dailyGoal: 20,
    quickPracticeLength: 10,
    plan: {
      grammar: [],
      vocabulary: [],
      difficulty: [],
      categories: [],
      dailyTarget: 20,
      mode: "mixed",
    },
  },
  streak: { current: 0, best: 0, lastDate: null },
  gamification: {
    badges: {},
    milestones: {},
    streakRecord: 0,
    lastBadge: null,
  },
  profile: {
    masteryByCategory: {},
    recommended: [],
    overallLevel: "A1",
    totalAnswered: 0,
    totalCorrect: 0,
    lastAssessment: null,
  },
  categoryMetrics: {
    grammar: {},
    vocabulary: {},
    difficulty: {},
  },
  progressLog: [],
  srs: {
    sentences: {},
    lastSessionAt: null,
  },
  assessment: {
    lastRunAt: null,
    history: [],
    ongoing: null,
  },
  daily: {},
  sessions: { active: null, history: [] },
  caches: {},
});

function withDefaults(raw) {
  const base = DEFAULT_STATE();
  if (!raw || typeof raw !== "object") return base;
  return {
    ...base,
    ...raw,
    settings: { ...base.settings, ...(raw.settings || {}), plan: { ...base.settings.plan, ...(raw.settings?.plan || {}) } },
    streak: { ...base.streak, ...(raw.streak || {}) },
    gamification: { ...base.gamification, ...(raw.gamification || {}) },
    profile: { ...base.profile, ...(raw.profile || {}) },
    categoryMetrics: {
      grammar: { ...base.categoryMetrics.grammar, ...(raw.categoryMetrics?.grammar || {}) },
      vocabulary: { ...base.categoryMetrics.vocabulary, ...(raw.categoryMetrics?.vocabulary || {}) },
      difficulty: { ...base.categoryMetrics.difficulty, ...(raw.categoryMetrics?.difficulty || {}) },
    },
    progressLog: Array.isArray(raw.progressLog) ? raw.progressLog : [],
    srs: { ...base.srs, ...(raw.srs || {}), sentences: { ...(raw.srs?.sentences || {}) } },
    assessment: {
      lastRunAt: raw.assessment?.lastRunAt || null,
      history: Array.isArray(raw.assessment?.history) ? raw.assessment.history : [],
      ongoing: raw.assessment?.ongoing || null,
    },
    daily: { ...(raw.daily || {}) },
    sessions: {
      active: raw.sessions?.active || null,
      history: Array.isArray(raw.sessions?.history) ? raw.sessions.history : [],
    },
    caches: { ...(raw.caches || {}) },
  };
}

function defaultCategoryMetrics() {
  return { correct: 0, wrong: 0, recent: [] };
}

class StorageManager {
  constructor() {
    this.state = this.loadState();
    this.cache = this.loadCache();
  }

  loadState() {
    try {
      const raw = localStorage.getItem(STATE_KEY);
      if (!raw) return DEFAULT_STATE();
      const parsed = JSON.parse(raw);
      if (parsed.version !== STORAGE_VERSION) {
        return DEFAULT_STATE();
      }
      return withDefaults(parsed);
    } catch (err) {
      console.warn("Failed to parse stored state, using defaults", err);
      return DEFAULT_STATE();
    }
  }

  loadCache() {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return typeof parsed === "object" && parsed ? parsed : {};
    } catch (err) {
      console.warn("Failed to parse cache, clearing", err);
      return {};
    }
  }

  persistState() {
    try {
      const copy = { ...this.state };
      copy.progressLog = [...(this.state.progressLog || [])];
      localStorage.setItem(STATE_KEY, JSON.stringify(copy));
    } catch (err) {
      console.warn("Unable to persist state", err);
    }
  }

  persistCache() {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(this.cache));
    } catch (err) {
      console.warn("Unable to persist cache", err);
    }
  }

  getState() {
    return this.state;
  }

  updateState(mutator) {
    const draft = { ...this.state };
    mutator(draft);
    this.state = withDefaults(draft);
    this.persistState();
    return this.state;
  }

  setCache(key, value) {
    this.cache[key] = value;
    this.persistCache();
  }

  getCache(key) {
    return this.cache[key];
  }

  clearCache(key) {
    if (typeof key === "string") {
      delete this.cache[key];
    } else {
      this.cache = {};
    }
    this.persistCache();
  }

  logInteraction(entry) {
    this.updateState((draft) => {
      const log = draft.progressLog || [];
      log.push(entry);
      if (log.length > MAX_PROGRESS_LOG) {
        log.splice(0, log.length - MAX_PROGRESS_LOG);
      }
      draft.progressLog = log;
      draft.profile.totalAnswered = (draft.profile.totalAnswered || 0) + 1;
      if (entry.correct) draft.profile.totalCorrect = (draft.profile.totalCorrect || 0) + 1;
    });
  }

  getDailyRecord(date) {
    const day = date || todayStr();
    if (!this.state.daily) this.state.daily = {};
    if (!this.state.daily[day]) this.state.daily[day] = { correct: 0, wrong: 0 };
    return this.state.daily[day];
  }

  incrementDaily(field) {
    this.updateState((draft) => {
      if (!draft.daily) draft.daily = {};
      const day = todayStr();
      if (!draft.daily[day]) draft.daily[day] = { correct: 0, wrong: 0 };
      draft.daily[day][field] += 1;
    });
  }

  updateStreak(onCorrect) {
    this.updateState((draft) => {
      const today = todayStr();
      if (!draft.streak) draft.streak = { current: 0, best: 0, lastDate: null };
      const { lastDate, current, best } = draft.streak;
      if (!onCorrect) {
        draft.streak.lastDate = today;
        return;
      }
      if (lastDate === today) {
        return;
      }
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const ystr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, "0")}-${String(yesterday.getDate()).padStart(2, "0")}`;
      if (lastDate === ystr) {
        const nextCurrent = current + 1;
        draft.streak.current = nextCurrent;
        draft.streak.best = Math.max(best, nextCurrent);
      } else {
        draft.streak.current = 1;
        draft.streak.best = Math.max(best, 1);
      }
      draft.streak.lastDate = today;
      draft.gamification.streakRecord = Math.max(draft.gamification.streakRecord || 0, draft.streak.current);
    });
  }

  ensureCategoryMetric(type, name) {
    if (!name) return null;
    return this.updateState((draft) => {
      if (!draft.categoryMetrics[type]) draft.categoryMetrics[type] = {};
      if (!draft.categoryMetrics[type][name]) draft.categoryMetrics[type][name] = defaultCategoryMetrics();
    });
  }

  updateCategoryMetrics(type, names, correct) {
    if (!Array.isArray(names)) return;
    this.updateState((draft) => {
      const bucket = draft.categoryMetrics[type] || (draft.categoryMetrics[type] = {});
      names.forEach((name) => {
        if (!name) return;
        if (!bucket[name]) bucket[name] = defaultCategoryMetrics();
        const metric = bucket[name];
        if (correct) metric.correct += 1;
        else metric.wrong += 1;
        metric.recent.push(correct ? 1 : 0);
        if (metric.recent.length > MAX_CATEGORY_HISTORY) {
          metric.recent.splice(0, metric.recent.length - MAX_CATEGORY_HISTORY);
        }
      });
    });
  }

  updateDifficultyMetrics(level, correct) {
    if (!level) return;
    this.updateState((draft) => {
      const bucket = draft.categoryMetrics.difficulty || (draft.categoryMetrics.difficulty = {});
      if (!bucket[level]) bucket[level] = defaultCategoryMetrics();
      const metric = bucket[level];
      if (correct) metric.correct += 1;
      else metric.wrong += 1;
      metric.recent.push(correct ? 1 : 0);
      if (metric.recent.length > MAX_CATEGORY_HISTORY) {
        metric.recent.splice(0, metric.recent.length - MAX_CATEGORY_HISTORY);
      }
    });
  }

  updateProfileRecommendations(recommended) {
    this.updateState((draft) => {
      draft.profile.recommended = recommended;
    });
  }

  setOverallLevel(level) {
    this.updateState((draft) => {
      draft.profile.overallLevel = level;
    });
  }

  setLastAssessment(result) {
    this.updateState((draft) => {
      draft.profile.lastAssessment = result;
      draft.assessment.lastRunAt = result?.completedAt || new Date().toISOString();
      draft.assessment.history = [result, ...(draft.assessment.history || [])].slice(0, 10);
    });
  }

  setAssessmentOngoing(payload) {
    this.updateState((draft) => {
      draft.assessment.ongoing = payload;
    });
  }

  completeAssessment(result) {
    this.updateState((draft) => {
      draft.assessment.ongoing = null;
      draft.assessment.lastRunAt = result.completedAt;
      draft.assessment.history = [result, ...(draft.assessment.history || [])].slice(0, 10);
      draft.profile.lastAssessment = result;
    });
  }

  registerBadge(badgeId, payload) {
    if (!badgeId) return;
    this.updateState((draft) => {
      const badges = draft.gamification.badges || (draft.gamification.badges = {});
      if (!badges[badgeId]) {
        badges[badgeId] = { achievedAt: new Date().toISOString(), ...payload };
        draft.gamification.lastBadge = badgeId;
      }
    });
  }

  markMilestone(key, payload) {
    if (!key) return;
    this.updateState((draft) => {
      const milestones = draft.gamification.milestones || (draft.gamification.milestones = {});
      milestones[key] = { updatedAt: new Date().toISOString(), ...payload };
    });
  }
}

export { StorageManager, STORAGE_VERSION, todayStr };
