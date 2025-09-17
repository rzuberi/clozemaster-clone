let idx = 0;
let sentences = [];
let showChoices = false;
let waitingForNext = false;

async function loadSentences() {
  let res = await fetch("sentences.json");
  sentences = await res.json();
}

function updateProgress() {
  let percent = ((idx+1) / sentences.length) * 100;
  document.getElementById("progress-fill").style.width = percent + "%";
}

function showSentence() {
  let data = sentences[idx];
  let display = data.sentence.replace("___", "<span class='blank'>___</span>");
  document.getElementById("sentence").innerHTML = display;
  document.getElementById("answer").value = "";
  document.getElementById("feedback").innerHTML = "";
  document.getElementById("answer").focus();

  // choices
  let choicesDiv = document.getElementById("choices");
  choicesDiv.innerHTML = "";
  if (showChoices) {
    data.options.forEach(opt => {
      let b = document.createElement("button");
      b.innerText = opt;
      b.onclick = () => checkAnswer(opt);
      choicesDiv.appendChild(b);
    });
  }
  updateProgress();
}

function checkAnswer(inputVal) {
  let data = sentences[idx];
  let answer = inputVal || document.getElementById("answer").value.trim();
  let feedbackDiv = document.getElementById("feedback");
  feedbackDiv.innerHTML = "";

  if (answer.toLowerCase() === data.answer.toLowerCase()) {
    feedbackDiv.innerHTML = "✅ Correct!";
    waitingForNext = true;
  } else {
    // show letter-by-letter
    let html = "";
    let correctWord = data.answer;
    for (let i=0; i<Math.max(answer.length, correctWord.length); i++) {
      let a = answer[i] || "";
      let c = correctWord[i] || "";
      if (a === c) {
        html += `<span class="correct">${c}</span>`;
      } else {
        html += `<span class="wrong">${a || "_"}</span>`;
      }
    }
    feedbackDiv.innerHTML = html;
    waitingForNext = false;
  }
}

function nextSentence() {
  idx = (idx+1) % sentences.length;
  showSentence();
  waitingForNext = false;
}

function showHint() {
  let data = sentences[idx];
  document.getElementById("feedback").innerHTML =
    `Hint: starts with <b>${data.answer[0]}</b>`;
}

function toggleChoices() {
  showChoices = !showChoices;
  showSentence();
}

window.onload = async () => {
  await loadSentences();
  showSentence();

  let input = document.getElementById("answer");
  input.addEventListener("keydown", function(e) {
    if (e.key === "Enter") {
      if (waitingForNext) {
        nextSentence();
      } else {
        checkAnswer();
      }
    }
  });
};
