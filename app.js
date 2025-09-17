let idx = 0;
let sentences = [];
let user = "me";

async function loadSentences() {
  let res = await fetch("sentences.json");
  sentences = await res.json();
}

function getProgress() {
  return JSON.parse(localStorage.getItem("progress") || 
    JSON.stringify({user, current_index: 0, history: [], mastered: []}));
}

function saveProgress(progress) {
  localStorage.setItem("progress", JSON.stringify(progress));
}

function calcStats(progress) {
  let data = progress.history;
  let now = new Date();
  let todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let weekStart = new Date(todayStart.getTime() - 7*24*60*60*1000);

  let total = data.length;
  let today = data.filter(r => new Date(r.timestamp) >= todayStart).length;
  let week = data.filter(r => new Date(r.timestamp) >= weekStart).length;

  let first = data.length > 0 ? new Date(data[0].timestamp) : now;
  let days = Math.max(1, Math.floor((now - first)/(1000*60*60*24)));
  let avg = (total/days).toFixed(2);

  return { total, today, week, average_per_day: avg };
}

function showStats(progress) {
  let s = calcStats(progress);
  document.getElementById("stats").innerHTML =
    `<p><b>Progress</b></p>
     <p>Trained today: ${s.today}</p>
     <p>This week: ${s.week}</p>
     <p>Average per day: ${s.average_per_day}</p>
     <p>Total answered: ${s.total}</p>
     <p>Mastered: ${progress.mastered.length}</p>`;
}

function showSentence(progress) {
  idx = progress.current_index % sentences.length;
  let data = sentences[idx];
  document.getElementById("quiz").innerHTML =
    `<p>${data.sentence}</p>` +
    data.options.map(o => `<button onclick="submit('${o}')">${o}</button>`).join(" ");
}

function submit(answer) {
  let progress = getProgress();
  let data = sentences[idx];
  let correct = data.answer === answer;

  alert(correct ? "✅ Correct!" : "❌ Wrong");

  // ensure streaks object exists
  if (!progress.streaks) progress.streaks = {};

  // update streak
  if (correct) {
    progress.streaks[idx] = (progress.streaks[idx] || 0) + 1;
  } else {
    progress.streaks[idx] = 0; // reset if wrong
  }

  // mark as mastered if streak >= 3
  if (progress.streaks[idx] >= 3 && !progress.mastered.includes(idx)) {
    progress.mastered.push(idx);
  }

  // log history
  progress.history.push({
    sentence_id: idx,
    correct,
    timestamp: new Date().toISOString()
  });

  // move to next
  progress.current_index = (idx + 1) % sentences.length;
  saveProgress(progress);

  showStats(progress);
  showSentence(progress);
}

// Export progress as JSON file
function exportProgress() {
  let progress = getProgress();
  let blob = new Blob([JSON.stringify(progress, null, 2)], {type: "application/json"});
  let url = URL.createObjectURL(blob);
  let a = document.createElement("a");
  a.href = url;
  a.download = "progress.json";
  a.click();
}

// Import progress from JSON file
function importProgress(event) {
  let file = event.target.files[0];
  if (!file) return;
  let reader = new FileReader();
  reader.onload = e => {
    try {
      let data = JSON.parse(e.target.result);
      saveProgress(data);
      showStats(data);
      showSentence(data);
      alert("✅ Progress imported!");
    } catch (err) {
      alert("❌ Invalid file");
    }
  };
  reader.readAsText(file);
}

window.onload = async () => {
  await loadSentences();
  let progress = getProgress();
  showStats(progress);
  showSentence(progress);
};
