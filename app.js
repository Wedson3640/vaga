import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);

const uploadCard = document.getElementById("uploadCard");
const loadingCard = document.getElementById("loadingCard");
const errorCard = document.getElementById("errorCard");
const doneCard = document.getElementById("doneCard");

const dropzone = document.getElementById("dropzone");
const dropzoneText = document.getElementById("dropzoneText");
const fileInput = document.getElementById("fileInput");
const desiredRoleInput = document.getElementById("desiredRole");
const locationInput = document.getElementById("locationInput");
const submitBtn = document.getElementById("submitBtn");
const restartBtn = document.getElementById("restartBtn");
const retryBtn = document.getElementById("retryBtn");

const loadingStep = document.getElementById("loadingStep");
const progressFill = document.getElementById("progressFill");
const errorMessage = document.getElementById("errorMessage");
const resultsList = document.getElementById("resultsList");
const doneSubtitle = document.getElementById("doneSubtitle");
const resultsNote = document.getElementById("resultsNote");

const ALL_CARDS = [uploadCard, loadingCard, errorCard, doneCard];

function showCard(card) {
  ALL_CARDS.forEach((c) => c.classList.add("hidden"));
  card.classList.remove("hidden");
}

function setProgress(step, percent) {
  loadingStep.textContent = step;
  progressFill.style.width = `${percent}%`;
}

let resumeText = null;
let resumeExtractionPromise = null;

const PDFJS_VERSION = "4.7.76";

async function extractResumeText(file) {
  const ext = file.name.split(".").pop().toLowerCase();

  if (ext === "pdf") {
    const pdfjsLib = await import(`https://esm.sh/pdfjs-dist@${PDFJS_VERSION}/build/pdf.mjs`);
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://esm.sh/pdfjs-dist@${PDFJS_VERSION}/build/pdf.worker.mjs`;
    const buffer = await file.arrayBuffer();
    const doc = await pdfjsLib.getDocument({ data: buffer }).promise;
    let text = "";
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      text += content.items.map((item) => item.str).join(" ") + "\n";
    }
    return text;
  }

  if (ext === "docx") {
    const mammoth = await import("https://esm.sh/mammoth@1.8.0");
    const buffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer: buffer });
    return result.value;
  }

  // .doc (formato binário legado) não tem extração viável no navegador; segue sem resume_text.
  return null;
}

function setSelectedFile(file) {
  if (!file) return;
  dropzoneText.innerHTML = `Arquivo selecionado:<br><strong>${file.name}</strong><br><small>Lendo conteúdo do currículo...</small>`;
  updateSubmitState();

  resumeText = null;
  resumeExtractionPromise = extractResumeText(file)
    .then((text) => {
      resumeText = text;
      const status = text
        ? "Currículo lido — vamos usar o conteúdo real no matching."
        : "Não conseguimos ler o conteúdo deste formato; a busca vai usar só o cargo digitado.";
      dropzoneText.innerHTML = `Arquivo selecionado:<br><strong>${file.name}</strong><br><small>${status}</small>`;
    })
    .catch((err) => {
      console.warn("Falha ao extrair texto do currículo:", err);
      resumeText = null;
      dropzoneText.innerHTML = `Arquivo selecionado:<br><strong>${file.name}</strong><br><small>Não conseguimos ler o conteúdo; a busca vai usar só o cargo digitado.</small>`;
    });
}

function updateSubmitState() {
  submitBtn.disabled = fileInput.files.length === 0 || desiredRoleInput.value.trim() === "";
}

dropzone.addEventListener("click", () => fileInput.click());
fileInput.addEventListener("change", () => setSelectedFile(fileInput.files[0]));
desiredRoleInput.addEventListener("input", updateSubmitState);

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

function renderResults(rows) {
  resultsList.innerHTML = "";

  if (rows.length === 0) {
    resultsNote.textContent = "Nenhuma vaga encontrada para essas palavras-chave. Tente termos mais amplos.";
    doneSubtitle.textContent = "Busca concluída, mas sem resultados desta vez.";
    return;
  }

  doneSubtitle.textContent = `Encontramos ${rows.length} vaga(s) com potencial para o seu perfil.`;
  resultsNote.textContent = "Vagas reais buscadas via Adzuna.";

  const sorted = [...rows].sort((a, b) => b.match_score - a.match_score);

  for (const row of sorted) {
    const job = row.job_postings;
    const li = document.createElement("li");
    li.className = "job-card";

    const matchClass = row.match_score >= 80 ? "match-high" : row.match_score >= 50 ? "match-mid" : "match-low";
    const location = job.location ?? "Localização não informada";
    const company = job.company ?? "Empresa não informada";
    const tags = (row.matched_keywords ?? []).slice(0, 5);

    li.innerHTML = `
      <div class="job-card-top">
        <div>
          <p class="job-title">${escapeHtml(job.title)}</p>
          <p class="job-company">${escapeHtml(company)} &middot; ${escapeHtml(location)}</p>
        </div>
        <span class="match-badge ${matchClass}">${Math.round(row.match_score)}% fit</span>
      </div>
      ${tags.length ? `<div class="tags">${tags.map((t) => `<span class="tag">${escapeHtml(t)}</span>`).join("")}</div>` : ""}
    `;

    if (job.url) {
      const link = document.createElement("a");
      link.href = job.url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.className = "job-link";
      link.textContent = "Ver vaga →";
      li.appendChild(link);
    }

    resultsList.appendChild(li);
  }
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

async function pollSearchRequest(searchRequestId, { intervalMs = 1500, timeoutMs = 60000 } = {}) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const { data, error } = await supabase
      .from("search_requests")
      .select("status, error_message")
      .eq("id", searchRequestId)
      .single();
    if (error) throw error;
    if (data.status === "done") return;
    if (data.status === "error") throw new Error(data.error_message || "A busca falhou no servidor.");
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error("A busca demorou demais para responder. Tente novamente.");
}

async function runRealSearch() {
  showCard(loadingCard);
  submitBtn.disabled = true;

  try {
    const file = fileInput.files[0];
    const desiredRole = desiredRoleInput.value.trim();
    const location = locationInput.value.trim() || null;

    setProgress("Enviando currículo...", 15);
    const filePath = `${Date.now()}_${file.name}`;
    const { error: uploadError } = await supabase.storage.from("curriculos").upload(filePath, file);
    if (uploadError) throw uploadError;

    setProgress("Lendo conteúdo do currículo...", 25);
    await resumeExtractionPromise;

    setProgress("Registrando candidatura...", 40);
    // candidates não tem policy de SELECT (dados do currículo não são públicos), e o Postgres
    // aplica a policy de SELECT também no RETURNING de um INSERT — por isso geramos o id no
    // cliente em vez de encadear .select() após o insert.
    const candidateId = crypto.randomUUID();
    const { error: candidateError } = await supabase.from("candidates").insert({
      id: candidateId,
      file_name: file.name,
      file_path: filePath,
      desired_role: desiredRole,
      location,
      resume_text: resumeText,
    });
    if (candidateError) throw candidateError;

    const { data: searchRequest, error: requestError } = await supabase
      .from("search_requests")
      .insert({ candidate_id: candidateId })
      .select("id")
      .single();
    if (requestError) throw requestError;

    setProgress("Buscando vagas reais na Adzuna...", 55);
    const { error: fnError } = await supabase.functions.invoke("search-jobs", {
      body: { search_request_id: searchRequest.id },
    });
    if (fnError) throw fnError;

    setProgress("Calculando compatibilidade...", 80);
    await pollSearchRequest(searchRequest.id);

    setProgress("Preparando os resultados...", 100);
    // match_score = 0 significa nenhuma palavra em comum com o currículo/cargo — em geral
    // lixo (ex: vagas de "CEO" ou "Diretor" vindas de fontes com filtro de relevância fraco).
    // Escondemos da tela, mas o registro completo continua salvo em search_results.
    const { data: results, error: resultsError } = await supabase
      .from("search_results")
      .select("match_score, matched_keywords, job_postings(title, company, location, url)")
      .eq("search_request_id", searchRequest.id)
      .gt("match_score", 0);
    if (resultsError) throw resultsError;

    renderResults(results);
    showCard(doneCard);
  } catch (err) {
    console.error(err);
    errorMessage.textContent = err.message || "Não conseguimos concluir a busca. Tente novamente.";
    showCard(errorCard);
  } finally {
    submitBtn.disabled = false;
  }
}

submitBtn.addEventListener("click", () => {
  if (fileInput.files.length === 0 || desiredRoleInput.value.trim() === "") return;
  runRealSearch();
});

retryBtn.addEventListener("click", () => showCard(uploadCard));

restartBtn.addEventListener("click", () => {
  fileInput.value = "";
  desiredRoleInput.value = "";
  locationInput.value = "";
  resumeText = null;
  resumeExtractionPromise = null;
  dropzoneText.innerHTML = "Arraste o arquivo aqui ou clique para selecionar<br><small>PDF, DOC ou DOCX</small>";
  updateSubmitState();
  showCard(uploadCard);
});
