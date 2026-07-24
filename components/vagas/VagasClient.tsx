"use client";

import { useRef, useState, type DragEvent } from "react";
import { supabase } from "@/lib/supabase";
import SiteNav from "@/components/SiteNav";

const PDFJS_VERSION = "4.7.76";

type View = "upload" | "loading" | "error" | "done";

type ResultRow = {
  match_score: number;
  matched_keywords: string[] | null;
  job_postings: {
    title: string;
    company: string | null;
    location: string | null;
    url: string | null;
  };
};

// Import de módulo via URL de CDN em runtime (funciona no navegador
// independente do framework). Sem tipos/declaração local possível — o retorno
// é deliberadamente `any`, tratado como tal por quem chama.
function dynamicImport(url: string): Promise<any> {
  return import(/* webpackIgnore: true */ url);
}

async function extractResumeText(file: File): Promise<string | null> {
  const ext = file.name.split(".").pop()?.toLowerCase();

  if (ext === "pdf") {
    const pdfjsLib = await dynamicImport(`https://esm.sh/pdfjs-dist@${PDFJS_VERSION}/build/pdf.mjs`);
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://esm.sh/pdfjs-dist@${PDFJS_VERSION}/build/pdf.worker.mjs`;
    const buffer = await file.arrayBuffer();
    const doc = await pdfjsLib.getDocument({ data: buffer }).promise;
    let text = "";
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      text += content.items.map((item: { str: string }) => item.str).join(" ") + "\n";
    }
    return text;
  }

  if (ext === "docx") {
    const mammoth = await dynamicImport("https://esm.sh/mammoth@1.8.0");
    const buffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer: buffer });
    return result.value;
  }

  return null;
}

async function pollSearchRequest(searchRequestId: string, timeoutMs = 60000): Promise<void> {
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
    await new Promise((r) => setTimeout(r, 1500));
  }
  throw new Error("A busca demorou demais para responder. Tente novamente.");
}

export default function VagasClient() {
  const [view, setView] = useState<View>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [desiredRole, setDesiredRole] = useState("");
  const [location, setLocation] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [resumeStatus, setResumeStatus] = useState<string | null>(null);
  const [loadingStep, setLoadingStep] = useState("");
  const [progress, setProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState("");
  const [results, setResults] = useState<ResultRow[]>([]);
  const [doneSubtitle, setDoneSubtitle] = useState("");
  const [resultsNote, setResultsNote] = useState("");

  const resumeTextRef = useRef<string | null>(null);
  const resumeExtractionRef = useRef<Promise<void> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFileSelected(selected: File) {
    setFile(selected);
    setResumeStatus("Lendo conteúdo do currículo...");
    resumeTextRef.current = null;
    resumeExtractionRef.current = extractResumeText(selected)
      .then((text) => {
        resumeTextRef.current = text;
        setResumeStatus(
          text
            ? "Currículo lido — vamos usar o conteúdo real no matching."
            : "Não conseguimos ler o conteúdo deste formato; a busca vai usar só o cargo digitado.",
        );
      })
      .catch((err) => {
        console.warn("Falha ao extrair texto do currículo:", err);
        resumeTextRef.current = null;
        setResumeStatus("Não conseguimos ler o conteúdo; a busca vai usar só o cargo digitado.");
      });
  }

  function onDrop(e: DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    setDragOver(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) handleFileSelected(dropped);
  }

  async function runRealSearch() {
    if (!file || !desiredRole.trim()) return;
    setView("loading");

    try {
      setLoadingStep("Enviando currículo...");
      setProgress(15);
      const filePath = `${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage.from("curriculos").upload(filePath, file);
      if (uploadError) throw uploadError;

      setLoadingStep("Lendo conteúdo do currículo...");
      setProgress(25);
      await resumeExtractionRef.current;

      setLoadingStep("Registrando candidatura...");
      setProgress(40);
      const candidateId = crypto.randomUUID();
      const { error: candidateError } = await supabase.from("candidates").insert({
        id: candidateId,
        file_name: file.name,
        file_path: filePath,
        desired_role: desiredRole.trim(),
        location: location.trim() || null,
        resume_text: resumeTextRef.current,
      });
      if (candidateError) throw candidateError;

      const { data: searchRequest, error: requestError } = await supabase
        .from("search_requests")
        .insert({ candidate_id: candidateId })
        .select("id")
        .single();
      if (requestError) throw requestError;

      setLoadingStep("Buscando vagas reais na Adzuna...");
      setProgress(55);
      const { error: fnError } = await supabase.functions.invoke("search-jobs", {
        body: { search_request_id: searchRequest.id },
      });
      if (fnError) throw fnError;

      setLoadingStep("Calculando compatibilidade...");
      setProgress(80);
      await pollSearchRequest(searchRequest.id);

      setLoadingStep("Preparando os resultados...");
      setProgress(100);
      const { data: rows, error: resultsError } = await supabase
        .from("search_results")
        .select("match_score, matched_keywords, job_postings(title, company, location, url)")
        .eq("search_request_id", searchRequest.id)
        .gt("match_score", 0);
      if (resultsError) throw resultsError;

      const rowsTyped = (rows ?? []) as unknown as ResultRow[];
      if (rowsTyped.length === 0) {
        setResultsNote("Nenhuma vaga encontrada para essas palavras-chave. Tente termos mais amplos.");
        setDoneSubtitle("Busca concluída, mas sem resultados desta vez.");
      } else {
        setResultsNote("Vagas reais buscadas via Adzuna.");
        setDoneSubtitle(`Encontramos ${rowsTyped.length} vaga(s) com potencial para o seu perfil.`);
      }
      setResults([...rowsTyped].sort((a, b) => b.match_score - a.match_score));
      setView("done");
    } catch (err) {
      console.error(err);
      setErrorMessage(err instanceof Error ? err.message : "Não conseguimos concluir a busca. Tente novamente.");
      setView("error");
    }
  }

  function restart() {
    setFile(null);
    setDesiredRole("");
    setLocation("");
    setResumeStatus(null);
    resumeTextRef.current = null;
    resumeExtractionRef.current = null;
    if (fileInputRef.current) fileInputRef.current.value = "";
    setView("upload");
  }

  const submitDisabled = !file || desiredRole.trim() === "";

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0f1720] px-6 py-10 font-sans text-[#e6edf3]">
      <div className="flex w-full max-w-[440px] flex-col items-center">
        <div className="mb-6">
          <SiteNav active="vagas" />
        </div>

        {view === "upload" && (
          <main className="w-full rounded-2xl border border-[#2a3742] bg-[#1b2733] p-10 text-center shadow-2xl">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/assets/pip_flight_loop.gif" alt="Pip, the courier bird" className="mx-auto mb-4 w-24" />
            <h1 className="text-2xl font-bold">Envie seu currículo</h1>
            <p className="mb-7 mt-2 text-sm text-[#8b98a5]">
              Vamos analisar seu perfil e procurar as melhores vagas para você.
            </p>

            <label
              htmlFor="fileInput"
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              className={
                "mb-5 flex min-h-[130px] cursor-pointer items-center justify-center rounded-xl border-2 border-dashed p-4 text-sm leading-relaxed transition-colors " +
                (dragOver ? "border-[#5eead4] bg-[#2dd4bf1a] text-[#e6edf3]" : "border-[#2a3742] text-[#8b98a5]")
              }
            >
              {file ? (
                <span>
                  Arquivo selecionado:
                  <br />
                  <strong>{file.name}</strong>
                  {resumeStatus && (
                    <>
                      <br />
                      <small>{resumeStatus}</small>
                    </>
                  )}
                </span>
              ) : (
                <span>
                  Arraste o arquivo aqui ou clique para selecionar
                  <br />
                  <small>PDF, DOC ou DOCX</small>
                </span>
              )}
            </label>
            <input
              ref={fileInputRef}
              id="fileInput"
              type="file"
              accept=".pdf,.doc,.docx"
              hidden
              onChange={(e) => {
                const selected = e.target.files?.[0];
                if (selected) handleFileSelected(selected);
              }}
            />

            <label htmlFor="desiredRole" className="mb-1.5 block text-left text-[13px] text-[#8b98a5]">
              Cargo ou palavras-chave desejadas
            </label>
            <input
              id="desiredRole"
              type="text"
              value={desiredRole}
              onChange={(e) => setDesiredRole(e.target.value)}
              placeholder="ex: analista de dados, ERP, logística"
              className="mb-4 w-full rounded-lg border border-[#2a3742] bg-[#0f1720] px-3.5 py-3 text-sm text-[#e6edf3] placeholder:text-[#8b98a5] focus:border-[#5eead4] focus:outline-none"
            />

            <label htmlFor="locationInput" className="mb-1.5 block text-left text-[13px] text-[#8b98a5]">
              Cidade/Estado (opcional)
            </label>
            <input
              id="locationInput"
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="ex: São Paulo"
              className="mb-4 w-full rounded-lg border border-[#2a3742] bg-[#0f1720] px-3.5 py-3 text-sm text-[#e6edf3] placeholder:text-[#8b98a5] focus:border-[#5eead4] focus:outline-none"
            />

            <button
              type="button"
              disabled={submitDisabled}
              onClick={runRealSearch}
              className="w-full rounded-xl bg-[#5eead4] py-3.5 font-semibold text-[#0f1720] disabled:cursor-not-allowed disabled:opacity-40"
            >
              Iniciar busca
            </button>
          </main>
        )}

        {view === "loading" && (
          <section className="w-full rounded-2xl border border-[#2a3742] bg-[#1b2733] p-10 text-center shadow-2xl">
            <div className="relative mx-auto mb-6 flex h-40 w-40 items-center justify-center rounded-full bg-[radial-gradient(circle,#2dd4bf1a_0%,transparent_70%)]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/assets/pip_flight_loop.gif" alt="" className="z-10 w-18 animate-bounce" />
            </div>
            <h2 className="text-xl font-bold">Procurando as melhores vagas...</h2>
            <p className="mb-5 mt-1 min-h-[1.2em] text-sm text-[#8b98a5]">{loadingStep}</p>
            <div className="h-2 w-full overflow-hidden rounded-full border border-[#2a3742] bg-[#0f1720]">
              <div
                className="h-full rounded-full bg-[#5eead4] transition-all duration-400"
                style={{ width: `${progress}%` }}
              />
            </div>
          </section>
        )}

        {view === "error" && (
          <section className="w-full rounded-2xl border border-[#2a3742] bg-[#1b2733] p-10 text-center shadow-2xl">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/assets/pip_flight_loop.gif" alt="Pip" className="mx-auto mb-4 w-24" />
            <h2 className="text-xl font-bold">Ops, algo deu errado</h2>
            <p className="mb-7 mt-2 text-sm text-[#8b98a5]">{errorMessage}</p>
            <button
              type="button"
              onClick={() => setView("upload")}
              className="w-full rounded-xl bg-[#5eead4] py-3.5 font-semibold text-[#0f1720]"
            >
              Tentar novamente
            </button>
          </section>
        )}

        {view === "done" && (
          <section className="w-full max-w-[560px] rounded-2xl border border-[#2a3742] bg-[#1b2733] p-10 text-center shadow-2xl">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/assets/pip_flight_loop.gif" alt="Pip" className="mx-auto mb-4 w-24" />
            <h2 className="text-xl font-bold">Prontinho!</h2>
            <p className="mb-2 mt-2 text-sm text-[#8b98a5]">{doneSubtitle}</p>

            <ul className="my-2 flex flex-col gap-3 text-left">
              {results.map((row, i) => {
                const job = row.job_postings;
                const matchClass =
                  row.match_score >= 80
                    ? "bg-[#2dd4bf1a] text-[#5eead4]"
                    : row.match_score >= 50
                      ? "bg-[#f0b42933] text-[#f0b429]"
                      : "bg-[#94a3b833] text-[#8b98a5]";
                return (
                  <li key={i} className="rounded-xl border border-[#2a3742] bg-[#0f1720] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[0.98rem] font-semibold">{job.title}</p>
                        <p className="text-sm text-[#8b98a5]">
                          {job.company ?? "Empresa não informada"} &middot; {job.location ?? "Localização não informada"}
                        </p>
                      </div>
                      <span className={"shrink-0 whitespace-nowrap rounded-full px-2.5 py-1 text-[0.78rem] font-semibold " + matchClass}>
                        {Math.round(row.match_score)}% fit
                      </span>
                    </div>
                    {row.matched_keywords && row.matched_keywords.length > 0 && (
                      <div className="mt-2.5 flex flex-wrap gap-1.5">
                        {row.matched_keywords.slice(0, 5).map((tag) => (
                          <span key={tag} className="rounded-full border border-[#2a3742] bg-[#1b2733] px-2.5 py-0.5 text-xs text-[#8b98a5]">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                    {job.url && (
                      <a
                        href={job.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2.5 inline-block text-sm text-[#5eead4] hover:underline"
                      >
                        Ver vaga →
                      </a>
                    )}
                  </li>
                );
              })}
            </ul>

            <p className="mb-5 mt-3 text-xs text-[#8b98a5]">{resultsNote}</p>
            <button
              type="button"
              onClick={restart}
              className="w-full rounded-xl bg-[#5eead4] py-3.5 font-semibold text-[#0f1720]"
            >
              Enviar outro currículo
            </button>
          </section>
        )}
      </div>
    </div>
  );
}
