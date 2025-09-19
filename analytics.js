import { todayStr } from "./storage_manager.js";

function computeAccuracy(metric) {
  if (!metric) return { total: 0, accuracy: 0 };
  const total = (metric.correct || 0) + (metric.wrong || 0);
  const accuracy = total > 0 ? metric.correct / total : 0;
  return { total, accuracy };
}

function aggregateProgress(progressLog) {
  const byDate = new Map();
  progressLog.forEach((entry) => {
    const date = entry.date || entry.timestamp?.slice(0, 10) || todayStr();
    if (!byDate.has(date)) byDate.set(date, { correct: 0, wrong: 0 });
    const stats = byDate.get(date);
    if (entry.correct) stats.correct += 1;
    else stats.wrong += 1;
  });
  return byDate;
}

function formatPercent(value) {
  if (!Number.isFinite(value)) return "0%";
  return `${Math.round(value * 100)}%`;
}

class AnalyticsDashboard {
  constructor(storageManager, difficultyManager, srsScheduler) {
    this.storage = storageManager;
    this.difficulty = difficultyManager;
    this.srs = srsScheduler;
  }

  render() {
    const state = this.storage.getState();
    this.renderOverview(state);
    this.renderCategoryTables(state);
    this.renderHeatmap(state);
    this.renderSpiderChart(state);
    this.renderVelocity(state);
    this.renderRecommendations();
    this.renderDueSummary();
  }

  renderOverview(state) {
    const totalAnswered = state.profile.totalAnswered || 0;
    const totalCorrect = state.profile.totalCorrect || 0;
    const accuracy = totalAnswered ? totalCorrect / totalAnswered : 0;
    this.setText("overviewAnswered", totalAnswered);
    this.setText("overviewAccuracy", formatPercent(accuracy));
    this.setText("overviewLevel", state.profile.overallLevel || "A1");
    this.setText("overviewGoal", state.settings.dailyGoal);
    this.setText("overviewStreak", state.streak.current || 0);
    const lastAssessment = state.profile.lastAssessment?.completedAt
      ? new Date(state.profile.lastAssessment.completedAt).toLocaleDateString()
      : "—";
    this.setText("overviewLastAssessment", lastAssessment);
  }

  renderCategoryTables(state) {
    this.renderCategoryList("grammarStats", state.categoryMetrics?.grammar || {});
    this.renderCategoryList("vocabularyStats", state.categoryMetrics?.vocabulary || {});
    this.renderCategoryList("difficultyStats", state.categoryMetrics?.difficulty || {}, true);
  }

  renderCategoryList(containerId, metrics, isDifficulty = false) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = "";
    const entries = Object.entries(metrics).map(([name, metric]) => {
      const { total, accuracy } = computeAccuracy(metric);
      return { name, metric, total, accuracy };
    });
    entries.sort((a, b) => (isDifficulty ? DIFFICULTY_ORDER.indexOf(a.name) - DIFFICULTY_ORDER.indexOf(b.name) : b.total - a.total));
    entries.slice(0, 12).forEach((entry) => {
      const row = document.createElement("div");
      row.className = "stat-row";
      const name = document.createElement("span");
      name.className = "stat-row__label";
      name.textContent = entry.name;
      const acc = document.createElement("span");
      acc.className = "stat-row__value";
      acc.textContent = `${formatPercent(entry.accuracy)} · ${entry.total}`;
      if (entry.accuracy >= 0.85) row.classList.add("stat-row--strong");
      else if (entry.accuracy <= 0.7) row.classList.add("stat-row--weak");
      row.appendChild(name);
      row.appendChild(acc);
      container.appendChild(row);
    });
    if (!entries.length) {
      const empty = document.createElement("p");
      empty.className = "stat-empty";
      empty.textContent = "Sin datos todavía";
      container.appendChild(empty);
    }
  }

  renderHeatmap(state) {
    const container = document.getElementById("heatmapGrid");
    if (!container) return;
    container.innerHTML = "";
    const byDate = aggregateProgress(state.progressLog || []);
    const days = 90;
    const end = todayStr();
    const startDate = addDays(end, -(days - 1));
    let maxCorrect = 0;
    const values = [];
    for (let i = 0; i < days; i += 1) {
      const date = addDays(startDate, i);
      const stat = byDate.get(date) || { correct: 0, wrong: 0 };
      values.push({ date, correct: stat.correct });
      if (stat.correct > maxCorrect) maxCorrect = stat.correct;
    }
    values.forEach((cell) => {
      const div = document.createElement("div");
      div.className = "hm-cell";
      const level = this.levelFromCount(cell.correct, maxCorrect);
      if (level) div.classList.add(`hm-${level}`);
      div.setAttribute("aria-label", `${cell.date}: ${cell.correct} correctos`);
      container.appendChild(div);
    });
    this.setText("heatmapToday", byDate.get(end)?.correct || 0);
    let last7 = 0;
    let last30 = 0;
    for (let i = 0; i < 7; i += 1) last7 += byDate.get(addDays(end, -i))?.correct || 0;
    for (let i = 0; i < 30; i += 1) last30 += byDate.get(addDays(end, -i))?.correct || 0;
    this.setText("heatmap7", last7);
    this.setText("heatmap30", last30);
  }

  levelFromCount(count, max) {
    if (count <= 0) return 0;
    if (max <= 2) return 1;
    const ratio = count / max;
    if (ratio > 0.8) return 4;
    if (ratio > 0.5) return 3;
    if (ratio > 0.3) return 2;
    return 1;
  }

  renderSpiderChart(state) {
    const canvas = document.getElementById("spiderChart");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const deviceRatio = window.devicePixelRatio || 1;
    const size = canvas.clientWidth || 280;
    canvas.width = size * deviceRatio;
    canvas.height = size * deviceRatio;
    ctx.scale(deviceRatio, deviceRatio);
    ctx.clearRect(0, 0, size, size);

    const categories = this.collectRadarCategories(state);
    if (!categories.length) return;
    const center = size / 2;
    const radius = Math.min(size / 2 - 20, 150);

    ctx.strokeStyle = "var(--border-muted)";
    ctx.lineWidth = 1;
    for (let level = 1; level <= 4; level += 1) {
      const r = (radius / 4) * level;
      ctx.beginPath();
      ctx.arc(center, center, r, 0, Math.PI * 2);
      ctx.stroke();
    }

    const angleStep = (Math.PI * 2) / categories.length;
    ctx.strokeStyle = "var(--text-muted)";
    categories.forEach((cat, index) => {
      const angle = angleStep * index - Math.PI / 2;
      const x = center + Math.cos(angle) * radius;
      const y = center + Math.sin(angle) * radius;
      ctx.beginPath();
      ctx.moveTo(center, center);
      ctx.lineTo(x, y);
      ctx.stroke();
      ctx.fillStyle = "var(--text-muted)";
      ctx.font = "12px Inter, system-ui";
      const labelX = center + Math.cos(angle) * (radius + 10);
      const labelY = center + Math.sin(angle) * (radius + 10);
      ctx.save();
      ctx.translate(labelX, labelY);
      ctx.rotate(angle);
      ctx.textAlign = "center";
      ctx.fillText(cat.name, 0, 0);
      ctx.restore();
    });

    ctx.beginPath();
    categories.forEach((cat, index) => {
      const angle = angleStep * index - Math.PI / 2;
      const r = radius * cat.value;
      const x = center + Math.cos(angle) * r;
      const y = center + Math.sin(angle) * r;
      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.fillStyle = "rgba(99, 102, 241, 0.3)";
    ctx.strokeStyle = "rgba(79, 70, 229, 0.8)";
    ctx.fill();
    ctx.stroke();
  }

  collectRadarCategories(state) {
    const metrics = state.categoryMetrics || {};
    const all = [];
    ["grammar", "vocabulary"].forEach((type) => {
      Object.entries(metrics[type] || {}).forEach(([name, metric]) => {
        const { total, accuracy } = computeAccuracy(metric);
        if (total >= 5) all.push({ name, value: accuracy });
      });
    });
    all.sort((a, b) => b.value - a.value);
    if (all.length > 8) return all.slice(0, 8);
    return all;
  }

  renderVelocity(state) {
    const log = state.progressLog || [];
    if (!log.length) {
      this.setText("velocityWeekly", "0");
      this.setText("velocityStreak", state.streak.current || 0);
      return;
    }
    const counts = new Map();
    log.forEach((entry) => {
      const weekKey = weekForDate(entry.date || entry.timestamp?.slice(0, 10) || todayStr());
      if (!counts.has(weekKey)) counts.set(weekKey, { answered: 0, correct: 0 });
      const stat = counts.get(weekKey);
      stat.answered += 1;
      if (entry.correct) stat.correct += 1;
    });
    const recentWeeks = Array.from(counts.entries())
      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
      .slice(0, 6);
    const averages = recentWeeks.map(([, value]) => (value.correct || 0));
    const weeklyAvg = averages.length ? Math.round(averages.reduce((a, b) => a + b, 0) / averages.length) : 0;
    this.setText("velocityWeekly", weeklyAvg);
    this.setText("velocityStreak", state.streak.best || 0);
  }

  renderRecommendations() {
    const weak = this.difficulty.getWeakAreas(3);
    const strong = this.difficulty.getStrongAreas(3);
    const container = document.getElementById("recommendations");
    if (!container) return;
    container.innerHTML = "";
    const list = document.createElement("ul");
    weak.forEach((entry) => {
      const item = document.createElement("li");
      item.textContent = `Refuerza ${entry.name} (${formatPercent(entry.accuracy)})`;
      list.appendChild(item);
    });
    if (!weak.length) {
      const ok = document.createElement("li");
      ok.textContent = "¡Gran trabajo! Mantén tu progreso actual.";
      list.appendChild(ok);
    }
    const strongList = document.createElement("ul");
    strong.forEach((entry) => {
      const item = document.createElement("li");
      item.textContent = `Fortaleza: ${entry.name} (${formatPercent(entry.accuracy)})`;
      strongList.appendChild(item);
    });
    container.appendChild(list);
    container.appendChild(strongList);
  }

  renderDueSummary() {
    const { dueNow, dueSoon, total } = this.srs.getDueSummary();
    this.setText("dueNow", dueNow);
    this.setText("dueSoon", dueSoon);
    this.setText("dueTotal", total);
  }

  setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  }
}

function addDays(dateStr, delta) {
  const [y, m, d] = dateStr.split("-").map((val) => Number.parseInt(val, 10));
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + delta);
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(date.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function weekForDate(dateStr) {
  const [y, m, d] = dateStr.split("-").map((val) => Number.parseInt(val, 10));
  const date = new Date(Date.UTC(y, m - 1, d));
  const onejan = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const millis = date - onejan;
  const week = Math.ceil((millis / 86400000 + onejan.getUTCDay() + 1) / 7);
  return `${y}-W${String(week).padStart(2, "0")}`;
}

const DIFFICULTY_ORDER = ["A1", "A2", "B1", "B2", "C1"];

export { AnalyticsDashboard };
