import { todayStr } from "./storage_manager.js";

const MIN_EASE = 1.3;
const MAX_EASE = 3.0;

function addDays(dateStr, delta) {
  const [y, m, d] = dateStr.split("-").map((val) => Number.parseInt(val, 10));
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + delta);
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(date.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function diffDays(a, b) {
  const [ya, ma, da] = a.split("-").map((val) => Number.parseInt(val, 10));
  const [yb, mb, db] = b.split("-").map((val) => Number.parseInt(val, 10));
  const daUtc = Date.UTC(ya, ma - 1, da);
  const dbUtc = Date.UTC(yb, mb - 1, db);
  return Math.round((dbUtc - daUtc) / 86400000);
}

class SRSScheduler {
  constructor(storageManager, difficultyManager, pipeline) {
    this.storage = storageManager;
    this.difficulty = difficultyManager;
    this.pipeline = pipeline;
  }

  ensureEntry(sentence, categories) {
    let entry = this.storage.getState().srs.sentences?.[sentence.id];
    if (!entry) {
      this.storage.updateState((draft) => {
        if (!draft.srs.sentences) draft.srs.sentences = {};
        draft.srs.sentences[sentence.id] = {
          id: sentence.id,
          ease: 2.5,
          interval: 0,
          due: todayStr(),
          correct: 0,
          wrong: 0,
          streak: 0,
          lastReviewed: null,
          lastOutcome: null,
          categories: { grammar: [], vocabulary: [], difficulty: sentence.difficulty },
        };
      });
      entry = this.storage.getState().srs.sentences[sentence.id];
    }
    if (categories) {
      this.storage.updateState((draft) => {
        const node = draft.srs.sentences[sentence.id];
        node.categories = {
          grammar: categories.grammar || node.categories.grammar || [],
          vocabulary: categories.vocabulary || node.categories.vocabulary || [],
          difficulty: categories.difficulty || node.categories.difficulty || sentence.difficulty,
        };
      });
      entry = this.storage.getState().srs.sentences[sentence.id];
    }
    return entry;
  }

  recordOutcome(sentence, correct) {
    const today = todayStr();
    this.storage.updateState((draft) => {
      if (!draft.srs.sentences) draft.srs.sentences = {};
      if (!draft.srs.sentences[sentence.id]) {
        draft.srs.sentences[sentence.id] = {
          id: sentence.id,
          ease: 2.5,
          interval: 0,
          due: today,
          correct: 0,
          wrong: 0,
          streak: 0,
          lastReviewed: null,
          lastOutcome: null,
          categories: {
            grammar: sentence.grammar || [],
            vocabulary: sentence.vocabulary || [],
            difficulty: sentence.difficulty,
          },
        };
      }
      const entry = draft.srs.sentences[sentence.id];
      if (correct) {
        entry.correct += 1;
        entry.streak += 1;
        entry.ease = Math.min(MAX_EASE, entry.ease + 0.15);
        if (entry.interval === 0) entry.interval = 1;
        else if (entry.interval === 1) entry.interval = 3;
        else entry.interval = Math.max(3, Math.round(entry.interval * entry.ease));
      } else {
        entry.wrong += 1;
        entry.streak = 0;
        entry.ease = Math.max(MIN_EASE, entry.ease - 0.25);
        entry.interval = 1;
      }
      entry.due = addDays(today, Math.max(1, entry.interval));
      entry.lastReviewed = new Date().toISOString();
      entry.lastOutcome = correct;
      entry.categories = {
        grammar: sentence.grammar || entry.categories.grammar || [],
        vocabulary: sentence.vocabulary || entry.categories.vocabulary || [],
        difficulty: sentence.difficulty || entry.categories.difficulty,
      };
      draft.srs.lastSessionAt = today;
    });
  }

  scoreSentence(sentence, focusPlan) {
    const today = todayStr();
    const entry = this.ensureEntry(sentence, {
      grammar: sentence.grammar,
      vocabulary: sentence.vocabulary,
      difficulty: sentence.difficulty,
    });
    const due = entry.due || today;
    const daysUntilDue = diffDays(today, due);
    const overdueScore = daysUntilDue <= 0 ? 4 + Math.abs(daysUntilDue) : Math.max(0, 3 - daysUntilDue);
    const totalAttempts = (entry.correct || 0) + (entry.wrong || 0);
    const accuracy = totalAttempts > 0 ? entry.correct / totalAttempts : 0;
    const weakness = totalAttempts >= 3 ? Math.max(0, 1.2 - accuracy) * 4 : 1.5;
    let focusBoost = 0;
    const focusGrammar = new Set(focusPlan?.grammar || []);
    const focusVocab = new Set(focusPlan?.vocabulary || []);
    (sentence.grammar || []).forEach((category) => {
      if (focusGrammar.has(category)) focusBoost += 2.5;
    });
    (sentence.vocabulary || []).forEach((category) => {
      if (focusVocab.has(category)) focusBoost += 2.0;
    });
    if (focusPlan?.difficulty && focusPlan.difficulty.includes(sentence.difficulty)) {
      focusBoost += 1.5;
    }
    const streakPenalty = Math.min(2, entry.streak * 0.2);
    const levelBoost = this.difficulty.shouldIncreaseDifficulty() ? 1.2 : 0;
    return overdueScore + weakness + focusBoost + levelBoost - streakPenalty;
  }

  selectNextSentence(currentId, options = {}) {
    const focusPlan = options.focusPlan || this.difficulty.getFocusPlan(options.preferredCategories);
    const exclude = new Set([currentId, ...(options.excludeIds || [])]);
    let pool = this.pipeline.getPracticePool({
      grammar: focusPlan.grammar,
      vocabulary: focusPlan.vocabulary,
      difficulty: focusPlan.difficulty,
      limit: 80,
      excludeIds: Array.from(exclude),
    });
    if (pool.length < 10) {
      const backup = this.pipeline.getPracticePool({ limit: 120, excludeIds: Array.from(exclude) });
      pool = pool.concat(backup);
    }
    const scored = pool
      .map((sentence) => ({ sentence, score: this.scoreSentence(sentence, focusPlan) }))
      .sort((a, b) => b.score - a.score);
    return scored.length ? scored[0].sentence : null;
  }

  getDueSummary() {
    const state = this.storage.getState();
    const entries = Object.values(state.srs.sentences || {});
    const today = todayStr();
    let dueNow = 0;
    let dueSoon = 0;
    entries.forEach((entry) => {
      const days = diffDays(today, entry.due || today);
      if (days >= 0) dueNow += 1;
      else if (days >= -3) dueSoon += 1;
    });
    return { dueNow, dueSoon, total: entries.length };
  }
}

export { SRSScheduler };
