const uploadCard = document.getElementById("uploadCard");
const loadingCard = document.getElementById("loadingCard");
const doneCard = document.getElementById("doneCard");

const dropzone = document.getElementById("dropzone");
const dropzoneText = document.getElementById("dropzoneText");
const fileInput = document.getElementById("fileInput");
const submitBtn = document.getElementById("submitBtn");
const restartBtn = document.getElementById("restartBtn");

const loadingStep = document.getElementById("loadingStep");
const progressFill = document.getElementById("progressFill");

const STEPS = [
  "Lendo seu currículo",
  "Identificando habilidades e experiências",
  "Buscando vagas compatíveis",
  "Avaliando fit com cada vaga",
  "Preparando os resultados",
];

function showCard(card) {
  [uploadCard, loadingCard, doneCard].forEach((c) => c.classList.add("hidden"));
  card.classList.remove("hidden");
}

function setSelectedFile(file) {
  if (!file) return;
  dropzoneText.innerHTML = `Arquivo selecionado:<br><strong>${file.name}</strong>`;
  submitBtn.disabled = false;
}

dropzone.addEventListener("click", () => fileInput.click());

fileInput.addEventListener("change", () => {
  setSelectedFile(fileInput.files[0]);
});

["dragenter", "dragover"].forEach((evt) => {
  dropzone.addEventListener(evt, (e) => {
    e.preventDefault();
    dropzone.classList.add("dragover");
  });
});

["dragleave", "drop"].forEach((evt) => {
  dropzone.addEventListener(evt, (e) => {
    e.preventDefault();
    dropzone.classList.remove("dragover");
  });
});

dropzone.addEventListener("drop", (e) => {
  const file = e.dataTransfer.files[0];
  if (file) {
    fileInput.files = e.dataTransfer.files;
    setSelectedFile(file);
  }
});

function runFakeProcessing() {
  showCard(loadingCard);
  progressFill.style.width = "0%";

  let stepIndex = 0;
  loadingStep.textContent = STEPS[0];

  const totalDurationMs = 6000;
  const stepDurationMs = totalDurationMs / STEPS.length;

  const stepInterval = setInterval(() => {
    stepIndex++;
    if (stepIndex < STEPS.length) {
      loadingStep.textContent = STEPS[stepIndex];
    }
  }, stepDurationMs);

  requestAnimationFrame(() => {
    progressFill.style.width = "100%";
  });

  setTimeout(() => {
    clearInterval(stepInterval);
    showCard(doneCard);
  }, totalDurationMs);
}

submitBtn.addEventListener("click", () => {
  if (fileInput.files.length === 0) return;
  runFakeProcessing();
});

restartBtn.addEventListener("click", () => {
  fileInput.value = "";
  dropzoneText.innerHTML = "Arraste o arquivo aqui ou clique para selecionar<br><small>PDF, DOC ou DOCX</small>";
  submitBtn.disabled = true;
  showCard(uploadCard);
});
