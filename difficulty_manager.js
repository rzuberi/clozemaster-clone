import { todayStr } from "./storage_manager.js";

const PROMOTION_THRESHOLD = 0.8;
const PROMOTION_MIN_ATTEMPTS = 15;
const WEAKNESS_THRESHOLD = 0.7;
const STRENGTH_THRESHOLD = 0.85;
const DIFFICULTY_ORDER = ["A1", "A2", "B1", "B2", "C1"];

function computeAccuracy(metric) {
  if (!metric) return { total: 0, accuracy: 0 };
  const total = (metric.correct || 0) + (metric.wrong || 0);
  if (total === 0) return { total: 0, accuracy: 0 };
  const accuracy = metric.correct / total;
  return { total, accuracy };
}

function ensureMasteryNode(container, name) {
  if (!container[name]) {
    container[name] = {
      correct: 0,
      wrong: 0,
      streak: 0,
      level: 1,
      lastUpdated: todayStr(),
      history: [],
    };
  }
  return container[name];
}

class DifficultyManager {
  constructor(storageManager, pipeline) {
    this.storage = storageManager;
    this.pipeline = pipeline;
  }

  recordResult(sentence, correct) {
    const grammar = sentence.grammar || [];
    const vocabulary = sentence.vocabulary || [];
    const difficulty = sentence.difficulty || "A1";
    this.storage.updateCategoryMetrics("grammar", grammar, correct);
    this.storage.updateCategoryMetrics("vocabulary", vocabulary, correct);
    this.storage.updateDifficultyMetrics(difficulty, correct);
    this.storage.updateState((draft) => {
      if (!draft.profile.masteryByCategory) draft.profile.masteryByCategory = {};
      const mastery = draft.profile.masteryByCategory;
      if (!mastery.grammar) mastery.grammar = {};
      if (!mastery.vocabulary) mastery.vocabulary = {};
      if (!mastery.difficulty) mastery.difficulty = {};

      grammar.forEach((category) => {
        const node = ensureMasteryNode(mastery.grammar, category);
        if (correct) node.correct += 1;
        else node.wrong += 1;
        node.history.push(correct ? 1 : 0);
        if (node.history.length > 40) node.history.splice(0, node.history.length - 40);
        node.streak = correct ? node.streak + 1 : 0;
        node.lastUpdated = todayStr();
        this.evaluatePromotion(node);
      });

      vocabulary.forEach((category) => {
        const node = ensureMasteryNode(mastery.vocabulary, category);
        if (correct) node.correct += 1;
        else node.wrong += 1;
        node.history.push(correct ? 1 : 0);
        if (node.history.length > 40) node.history.splice(0, node.history.length - 40);
        node.streak = correct ? node.streak + 1 : 0;
        node.lastUpdated = todayStr();
        this.evaluatePromotion(node);
      });

      const difficultyNode = ensureMasteryNode(mastery.difficulty, difficulty);
      if (correct) difficultyNode.correct += 1;
      else difficultyNode.wrong += 1;
      difficultyNode.history.push(correct ? 1 : 0);
      if (difficultyNode.history.length > 60) difficultyNode.history.splice(0, difficultyNode.history.length - 60);
      difficultyNode.streak = correct ? difficultyNode.streak + 1 : 0;
      difficultyNode.lastUpdated = todayStr();
      this.evaluatePromotion(difficultyNode);
    });
    this.refreshDerivedData();
  }

  evaluatePromotion(node) {
    const total = (node.correct || 0) + (node.wrong || 0);
    if (total < PROMOTION_MIN_ATTEMPTS) return;
    const accuracy = total ? node.correct / total : 0;
    if (accuracy >= PROMOTION_THRESHOLD && node.level < 5) {
      node.level += 1;
      node.promotedAt = todayStr();
    }
    if (accuracy < 0.5) {
      node.level = Math.max(1, node.level - 1);
    }
  }

  refreshDerivedData() {
    const recommendations = this.getWeakAreas(3).map((entry) => ({
      category: entry.name,
      domain: entry.type,
      accuracy: entry.accuracy,
    }));
    this.storage.updateProfileRecommendations(recommendations);
    const overall = this.computeOverallLevel();
    this.storage.setOverallLevel(overall);
  }

  computeOverallLevel() {
    const state = this.storage.getState();
    const metrics = state.categoryMetrics?.difficulty || {};
    let highest = "A1";
    DIFFICULTY_ORDER.forEach((level) => {
      const metric = metrics[level];
      if (!metric) return;
      const { total, accuracy } = computeAccuracy(metric);
      if (total >= 12 && accuracy >= 0.75) {
        highest = level;
      }
    });
    return highest;
  }

  getWeakAreas(limit = 5) {
    const state = this.storage.getState();
    const results = [];
    ["grammar", "vocabulary"].forEach((type) => {
      const metrics = state.categoryMetrics?.[type] || {};
      Object.entries(metrics).forEach(([name, metric]) => {
        const { total, accuracy } = computeAccuracy(metric);
        if (total >= 6 && accuracy <= WEAKNESS_THRESHOLD) {
          results.push({ type, name, total, accuracy });
        }
      });
    });
    results.sort((a, b) => a.accuracy - b.accuracy);
    return results.slice(0, limit);
  }

  getStrongAreas(limit = 5) {
    const state = this.storage.getState();
    const results = [];
    ["grammar", "vocabulary"].forEach((type) => {
      const metrics = state.categoryMetrics?.[type] || {};
      Object.entries(metrics).forEach(([name, metric]) => {
        const { total, accuracy } = computeAccuracy(metric);
        if (total >= 6 && accuracy >= STRENGTH_THRESHOLD) {
          results.push({ type, name, total, accuracy });
        }
      });
    });
    results.sort((a, b) => b.accuracy - a.accuracy);
    return results.slice(0, limit);
  }

  getFocusPlan(preferred = {}) {
    const weakAreas = this.getWeakAreas(4);
    const plan = {
      grammar: [],
      vocabulary: [],
      difficulty: [],
    };
    weakAreas.forEach((entry) => {
      if (entry.type === "grammar") plan.grammar.push(entry.name);
      else plan.vocabulary.push(entry.name);
    });
    if (plan.grammar.length === 0 && Array.isArray(preferred.grammar)) {
      plan.grammar = preferred.grammar.slice(0, 2);
    }
    if (plan.vocabulary.length === 0 && Array.isArray(preferred.vocabulary)) {
      plan.vocabulary = preferred.vocabulary.slice(0, 2);
    }
    const overall = this.computeOverallLevel();
    const index = DIFFICULTY_ORDER.indexOf(overall);
    const nextLevel = index >= 0 && index < DIFFICULTY_ORDER.length - 1 ? DIFFICULTY_ORDER[index + 1] : overall;
    plan.difficulty = [overall, nextLevel].filter((value, pos, arr) => arr.indexOf(value) === pos);
    return plan;
  }

  shouldIncreaseDifficulty() {
    const state = this.storage.getState();
    const metrics = state.categoryMetrics?.difficulty || {};
    const current = this.computeOverallLevel();
    const index = DIFFICULTY_ORDER.indexOf(current);
    const next = index + 1 < DIFFICULTY_ORDER.length ? DIFFICULTY_ORDER[index + 1] : current;
    if (next === current) return false;
    const currentMetric = metrics[current];
    const nextMetric = metrics[next];
    const { total: totalCurrent, accuracy: accCurrent } = computeAccuracy(currentMetric);
    const { total: totalNext, accuracy: accNext } = computeAccuracy(nextMetric);
    if (totalCurrent < 15 || accCurrent < 0.8) return false;
    if (totalNext >= 5 && accNext < 0.6) return false;
    return true;
  }

  buildAssessmentReport(history) {
    const weak = this.getWeakAreas(5);
    const strong = this.getStrongAreas(5);
    const overall = this.computeOverallLevel();
    return {
      completedAt: new Date().toISOString(),
      weak,
      strong,
      overall,
      history,
    };
  }
}

export { DifficultyManager };
