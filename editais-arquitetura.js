import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);

const statusNote = document.getElementById("statusNote");
const tenderList = document.getElementById("tenderList");

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

function formatCurrency(value) {
  if (value == null) return "Valor não informado";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function formatDate(value) {
  if (!value) return null;
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

function deadlineClass(dataEncerramento) {
  if (!dataEncerramento) return "";
  const daysLeft = (new Date(dataEncerramento).getTime() - Date.now()) / 86400000;
  if (daysLeft < 0) return "match-low";
  if (daysLeft <= 3) return "match-mid";
  return "match-high";
}

function renderTenders(rows) {
  tenderList.innerHTML = "";

  if (rows.length === 0) {
    statusNote.textContent = "Nenhum edital de arquitetura encontrado na última varredura.";
    return;
  }

  statusNote.textContent = `${rows.length} edital(is) encontrado(s) na última varredura semanal.`;

  for (const tender of rows) {
    const li = document.createElement("li");
    li.className = "job-card";

    const publicacao = formatDate(tender.data_publicacao);
    const prazo = formatDate(tender.data_encerramento_proposta);
    const prazoClass = deadlineClass(tender.data_encerramento_proposta);
    const tags = tender.matched_keywords ?? [];

    li.innerHTML = `
      <div class="job-card-top">
        <div>
          <p class="job-title">${escapeHtml(tender.objeto)}</p>
          <p class="job-company">${escapeHtml(tender.orgao ?? "Órgão não informado")} &middot; ${escapeHtml(tender.municipio ?? "")}${tender.uf ? "/" + escapeHtml(tender.uf) : ""}</p>
        </div>
        ${prazo ? `<span class="match-badge ${prazoClass}">Prazo: ${prazo}</span>` : ""}
      </div>
      <p class="job-company">Modalidade: ${escapeHtml(tender.modalidade ?? "não informada")} &middot; Valor estimado: ${formatCurrency(tender.valor_estimado)}</p>
      ${publicacao ? `<p class="job-company">Publicado em: ${publicacao}</p>` : ""}
      ${tags.length ? `<div class="tags">${tags.map((t) => `<span class="tag">${escapeHtml(t)}</span>`).join("")}</div>` : ""}
    `;

    if (tender.link) {
      const link = document.createElement("a");
      link.href = tender.link;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.className = "job-link";
      link.textContent = "Ver edital →";
      li.appendChild(link);
    }

    tenderList.appendChild(li);
  }
}

async function loadTenders() {
  const { data, error } = await supabase
    .from("tender_opportunities")
    .select("*")
    .order("data_encerramento_proposta", { ascending: true });

  if (error) {
    statusNote.textContent = "Não foi possível carregar os editais agora. Tente recarregar a página.";
    console.error(error);
    return;
  }

  renderTenders(data ?? []);
}

loadTenders();
