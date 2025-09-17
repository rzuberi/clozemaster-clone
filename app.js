// --- Dataset ---
const DATASET = [
  { id: "s1", text: "Él ___ en la casa.", cloze: "vive", distractors: ["corre","come","duerme"], hint: "to live" },
  { id: "s2", text: "Yo quiero ___ agua.", cloze: "beber", distractors: ["comer","tomar","correr"], hint: "to drink" }
  // add up to 30
];

// --- State ---
let idx = 0;

// --- UI ---
function renderSentence() {
  const item = DATASET[idx];
  const sentence = item.text.replace("___", "<span class='blank'>___</span>");
  document.getElementById("sentence").innerHTML = sentence;
  document.getElementById("answer").value = "";
  renderChoices(item);
}

function renderChoices(item) {
  const opts = [item.cloze, ...item.distractors].sort(() => Math.random()-0.5);
  const div = document.getElementById("choices");
  div.innerHTML = "";
  opts.forEach((o,i) => {
    const btn = document.createElement("button");
    btn.textContent = `${i+1}. ${o}`;
    btn.onclick = () => checkAnswer(o);
    div.appendChild(btn);
  });
}

function checkAnswer(ans) {
  const item = DATASET[idx];
  const fb = document.getElementById("feedback");
  if (ans.trim().toLowerCase() === item.cloze.toLowerCase()) {
    fb.textContent = "✅ Correct!";
    fb.style.color = "green";
  } else {
    fb.textContent = `❌ Wrong, correct: ${item.cloze}`;
    fb.style.color = "red";
  }
}

// --- Init ---
document.addEventListener("DOMContentLoaded", () => {
  renderSentence();
  document.getElementById("answer").addEventListener("keydown", e => {
    if (e.key === "Enter") checkAnswer(e.target.value);
  });
});
