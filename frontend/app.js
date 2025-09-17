let idx = 0;
let user = "me";

async function loadStats() {
  let res = await fetch(`/stats/${user}`);
  let data = await res.json();
  document.getElementById("stats").innerHTML =
    `<p><b>Progress</b></p>
     <p>Trained today: ${data.today}</p>
     <p>This week: ${data.week}</p>
     <p>Average per day: ${data.average_per_day}</p>
     <p>Total answered: ${data.total}</p>`;
}

async function loadSentence() {
  let res = await fetch(`/sentence/${idx}`);
  let data = await res.json();
  document.getElementById("quiz").innerHTML =
    `<p>${data.sentence}</p>` +
    data.options.map(o => `<button onclick="submit('${o}')">${o}</button>`).join(" ");
}

async function submit(answer) {
  let res = await fetch("/answer", {
    method: "POST",
    headers: {"Content-Type":"application/json"},
    body: JSON.stringify({user:user, sentence_id:idx, answer:answer})
  });
  let data = await res.json();
  alert(data.correct ? "✅ Correct!" : "❌ Wrong");
  idx = (idx + 1) % 3; // loop through sentences
  await loadStats();
  await loadSentence();
}

window.onload = async () => {
  await loadStats();
  await loadSentence();
};
