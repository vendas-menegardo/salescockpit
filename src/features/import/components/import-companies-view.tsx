"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  FileSearch,
  LoaderCircle,
  Plus,
  RotateCcw,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatCnpj } from "../lib/import-utils";
import {
  analyzeCompaniesImport,
  createImportBase,
  finalizeCompaniesImportJob,
  processCompaniesImportBatch,
  stageCompaniesImportBatch,
  startCompaniesImportJob,
} from "../actions/import-companies";
import {
  IMPORT_STAGING_BATCH_SIZE,
  MAX_CSV_BYTES,
  MAX_CSV_SIZE_LABEL,
} from "../constants";
import {
  chunkItems,
  eligibleRowsForImport,
} from "../lib/import-batching";
import type {
  ImportAnalysis,
  ImportJobProgress,
  ImportResult,
  ImportRowStatus,
} from "../types/import";
import { UploadZone } from "./upload-zone";

type BaseOption = {
  id: string;
  name: string;
  description: string | null;
};

type ImportCompaniesViewProps = {
  initialBases: BaseOption[];
};

const PAGE_SIZE = 10;

type VisibleImportProgress = ImportJobProgress & {
  phase: "preparing" | "processing";
};

function importJobStorageKey(baseId: string, fileHash: string) {
  return `salecockpit.import-job.${baseId}.${fileHash}`;
}

async function hashCsvText(csvText: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(csvText)
  );

  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("");
}

const STATUS_META: Record<
  ImportRowStatus,
  { label: string; className: string }
> = {
  new_company: {
    label: "Nova empresa",
    className: "bg-emerald-100 text-emerald-800",
  },
  existing_new_link: {
    label: "Existente, novo vínculo",
    className: "bg-blue-100 text-blue-800",
  },
  already_in_base: {
    label: "Já presente na base",
    className: "bg-zinc-100 text-zinc-700",
  },
  invalid: {
    label: "Inválida",
    className: "bg-red-100 text-red-800",
  },
  duplicate_file: {
    label: "Duplicada no arquivo",
    className: "bg-amber-100 text-amber-800",
  },
  conflict: {
    label: "Conflito de dados",
    className: "bg-orange-100 text-orange-800",
  },
};

function SummaryItem({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-3">
      <div className="text-xs text-zinc-500">{label}</div>
      <div className="mt-1 text-xl font-semibold text-zinc-900">{value}</div>
    </div>
  );
}

export function ImportCompaniesView({
  initialBases,
}: ImportCompaniesViewProps) {
  const [bases, setBases] = useState(initialBases);
  const [baseId, setBaseId] = useState(initialBases[0]?.id ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [csvText, setCsvText] = useState("");
  const [analysis, setAnalysis] = useState<ImportAnalysis | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [showQuickBase, setShowQuickBase] = useState(initialBases.length === 0);
  const [quickName, setQuickName] = useState("");
  const [quickDescription, setQuickDescription] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [creatingBase, setCreatingBase] = useState(false);
  const [fileHash, setFileHash] = useState("");
  const [activeJobId, setActiveJobId] = useState("");
  const [importProgress, setImportProgress] =
    useState<VisibleImportProgress | null>(null);

  const totalPages = analysis
    ? Math.max(1, Math.ceil(analysis.rows.length / PAGE_SIZE))
    : 1;
  const visibleRows = useMemo(() => {
    if (!analysis) {
      return [];
    }

    const start = (page - 1) * PAGE_SIZE;
    return analysis.rows.slice(start, start + PAGE_SIZE);
  }, [analysis, page]);

  async function handleFile(selectedFile: File) {
    setError("");
    setAnalysis(null);
    setResult(null);
    setFileHash("");
    setActiveJobId("");
    setImportProgress(null);

    if (!selectedFile.name.toLowerCase().endsWith(".csv")) {
      setFile(null);
      setCsvText("");
      setError("Selecione um arquivo com extensão .csv.");
      return;
    }

    if (selectedFile.size > MAX_CSV_BYTES) {
      setFile(null);
      setCsvText("");
      setError(`O CSV deve ter no máximo ${MAX_CSV_SIZE_LABEL}.`);
      return;
    }

    setFile(selectedFile);
    setCsvText(await selectedFile.text());
  }

  async function handleCreateBase(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setCreatingBase(true);

    try {
      const response = await createImportBase({
        name: quickName,
        description: quickDescription || undefined,
      });

      if (!response.ok) {
        setError(response.message);
        return;
      }

      setBases((current) => [response.base, ...current]);
      setBaseId(response.base.id);
      setQuickName("");
      setQuickDescription("");
      setShowQuickBase(false);
      setAnalysis(null);
      setResult(null);
    } finally {
      setCreatingBase(false);
    }
  }

  async function handleAnalyze() {
    if (!baseId) {
      setError("Selecione ou crie a base de destino.");
      return;
    }

    if (!file || !csvText) {
      setError("Selecione um arquivo CSV.");
      return;
    }

    setError("");
    setAnalyzing(true);

    try {
      const response = await analyzeCompaniesImport({
        baseId,
        fileName: file.name,
        csvText,
      });

      if (!response.ok) {
        setAnalysis(null);
        setError(response.message);
        return;
      }

      setAnalysis(response.analysis);
      setPage(1);
      const hash = await hashCsvText(csvText);
      const storedJobId = localStorage.getItem(
        importJobStorageKey(response.analysis.base.id, hash)
      );

      setFileHash(hash);
      setActiveJobId(storedJobId ?? "");
      setImportProgress(null);
    } finally {
      setAnalyzing(false);
    }
  }

  async function handleConfirm() {
    if (!analysis || !file || confirming) {
      return;
    }

    setError("");
    setConfirming(true);

    try {
      const eligibleRows = eligibleRowsForImport(analysis.rows);

      if (eligibleRows.length !== analysis.summary.eligibleRows) {
        setError(
          "A prévia mudou e não pode ser importada com segurança. Valide o arquivo novamente."
        );
        return;
      }

      const currentFileHash = fileHash || (await hashCsvText(csvText));
      const jobId = activeJobId || crypto.randomUUID();
      const storageKey = importJobStorageKey(
        analysis.base.id,
        currentFileHash
      );
      const jobContext = {
        jobId,
        baseId: analysis.base.id,
        fileHash: currentFileHash,
      };
      const started = await startCompaniesImportJob({
        ...jobContext,
        fileName: file.name,
        summary: analysis.summary,
      });

      if (!started.ok) {
        setError(started.message);
        return;
      }

      setFileHash(currentFileHash);
      setActiveJobId(jobId);
      localStorage.setItem(storageKey, jobId);

      if (started.result) {
        localStorage.removeItem(storageKey);
        setResult(started.result);
        setAnalysis(null);
        setActiveJobId("");
        setImportProgress(null);
        return;
      }

      setImportProgress({
        ...started.progress,
        phase: "preparing",
      });

      for (const rows of chunkItems(
        eligibleRows,
        IMPORT_STAGING_BATCH_SIZE
      )) {
        const staged = await stageCompaniesImportBatch({
          ...jobContext,
          rows,
        });

        if (!staged.ok) {
          setError(staged.message);
          return;
        }

        setImportProgress({
          ...staged.progress,
          phase: "preparing",
        });
      }

      const finalized = await finalizeCompaniesImportJob(jobContext);

      if (!finalized.ok) {
        setError(finalized.message);
        return;
      }

      let processedRows = finalized.progress.processedRows;
      setImportProgress({
        ...finalized.progress,
        phase: "processing",
      });

      while (processedRows < finalized.progress.eligibleRows) {
        const processed = await processCompaniesImportBatch(jobContext);

        if (!processed.ok) {
          setError(processed.message);
          return;
        }

        setImportProgress({
          ...processed.progress,
          phase: "processing",
        });

        if (
          !processed.result &&
          processed.progress.processedRows <= processedRows
        ) {
          setError(
            "A importação foi pausada porque o lote não avançou. Tente retomar."
          );
          return;
        }

        processedRows = processed.progress.processedRows;

        if (processed.result) {
          localStorage.removeItem(storageKey);
          setResult(processed.result);
          setAnalysis(null);
          setActiveJobId("");
          setImportProgress(null);
          return;
        }
      }
    } catch {
      setError(
        "A comunicação foi interrompida. O progresso confirmado foi preservado; tente retomar a importação."
      );
    } finally {
      setConfirming(false);
    }
  }

  function resetImport() {
    if (fileHash && baseId) {
      localStorage.removeItem(importJobStorageKey(baseId, fileHash));
    }

    setFile(null);
    setCsvText("");
    setAnalysis(null);
    setResult(null);
    setError("");
    setPage(1);
    setFileHash("");
    setActiveJobId("");
    setImportProgress(null);
  }

  if (result) {
    const resultItems = [
      ["Empresas criadas", result.companiesCreated],
      ["Empresas existentes reutilizadas", result.existingCompaniesReused],
      ["Vínculos criados", result.linksCreated],
      ["Já presentes na base", result.alreadyInBase],
      ["Registros inválidos ignorados", result.invalidIgnored],
      ["Duplicatas ignoradas", result.duplicatesIgnored],
      ["Linhas vazias ignoradas", result.emptyRowsIgnored],
      ["Conflitos preservados", result.conflictsPreserved],
      ["Falhas", result.failures],
    ] as const;

    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Importação concluída</h1>
          <p className="mt-2 text-muted-foreground">
            Resultado da importação para a base {result.base.name}.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="text-emerald-600" />
              Resumo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {resultItems.map(([label, value]) => (
                <SummaryItem key={label} label={label} value={value} />
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-wrap gap-2">
          <Button
            nativeButton={false}
            render={<Link href={`/bases/${result.base.id}`} />}
          >
            Abrir base
            <ArrowRight data-icon="inline-end" />
          </Button>
          <Button
            nativeButton={false}
            variant="outline"
            render={<Link href={`/empresas?baseId=${result.base.id}`} />}
          >
            Visualizar empresas
          </Button>
          <Button type="button" variant="ghost" onClick={resetImport}>
            <RotateCcw data-icon="inline-start" />
            Nova importação
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Importação de empresas</h1>
        <p className="mt-2 text-muted-foreground">
          Selecione a base de destino e valide o CSV antes de confirmar.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>1. Base de destino</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="min-w-0 flex-1 space-y-2">
              <label htmlFor="import-base" className="text-sm font-medium">
                Base
              </label>
              <select
                id="import-base"
                value={baseId}
                disabled={confirming}
                onChange={(event) => {
                  setBaseId(event.target.value);
                  setAnalysis(null);
                  setResult(null);
                  setFileHash("");
                  setActiveJobId("");
                  setImportProgress(null);
                }}
                className="h-9 w-full rounded-lg border border-input bg-white px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <option value="">Selecione uma base</option>
                {bases.map((base) => (
                  <option key={base.id} value={base.id}>
                    {base.name}
                  </option>
                ))}
              </select>
            </div>

            <Button
              type="button"
              variant="outline"
              onClick={() => setShowQuickBase((current) => !current)}
              disabled={confirming}
            >
              <Plus data-icon="inline-start" />
              Criar base
            </Button>
          </div>

          {showQuickBase && (
            <form
              onSubmit={handleCreateBase}
              className="space-y-3 border-t border-zinc-200 pt-4"
            >
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <label htmlFor="quick-base-name" className="text-sm font-medium">
                    Nome
                  </label>
                  <Input
                    id="quick-base-name"
                    value={quickName}
                    onChange={(event) => setQuickName(event.target.value)}
                    placeholder="Ex.: Comércio ES"
                    required
                    disabled={confirming}
                  />
                </div>
                <div className="space-y-2">
                  <label
                    htmlFor="quick-base-description"
                    className="text-sm font-medium"
                  >
                    Descrição opcional
                  </label>
                  <Textarea
                    id="quick-base-description"
                    value={quickDescription}
                    onChange={(event) =>
                      setQuickDescription(event.target.value)
                    }
                    className="min-h-20"
                    disabled={confirming}
                  />
                </div>
              </div>
              <Button type="submit" disabled={creatingBase || confirming}>
                {creatingBase ? "Criando..." : "Criar e selecionar base"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>2. Arquivo CSV</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <UploadZone onFileSelect={handleFile} disabled={confirming} />

          {file && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-zinc-200 bg-zinc-50 p-3">
              <div>
                <div className="font-medium">{file.name}</div>
                <div className="text-sm text-zinc-500">
                  {(file.size / 1024).toFixed(1)} KB
                </div>
              </div>
              <Button
                type="button"
                onClick={handleAnalyze}
                disabled={analyzing || confirming || !baseId}
              >
                <FileSearch data-icon="inline-start" />
                {analyzing ? "Validando..." : "Validar e gerar prévia"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {error && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          {error}
        </div>
      )}

      {analysis && (
        <div className="space-y-5">
          <div>
            <h2 className="text-xl font-semibold">3. Prévia da importação</h2>
            <p className="mt-1 text-sm text-zinc-500">
              {analysis.fileName} para {analysis.base.name}
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <SummaryItem label="Linhas lidas" value={analysis.summary.totalRows} />
            <SummaryItem label="Linhas válidas" value={analysis.summary.validRows} />
            <SummaryItem
              label="Linhas inválidas"
              value={analysis.summary.invalidRows}
            />
            <SummaryItem
              label="Duplicadas no arquivo"
              value={analysis.summary.duplicateRows}
            />
            <SummaryItem
              label="Linhas vazias ignoradas"
              value={analysis.summary.emptyRowsIgnored}
            />
            <SummaryItem
              label="Empresas novas"
              value={analysis.summary.newCompanies}
            />
            <SummaryItem
              label="Empresas existentes"
              value={analysis.summary.existingCompanies}
            />
            <SummaryItem
              label="Já presentes na base"
              value={analysis.summary.alreadyInBase}
            />
            <SummaryItem
              label="Conflitos"
              value={analysis.summary.conflicts}
            />
            <SummaryItem
              label="Linhas elegíveis"
              value={analysis.summary.eligibleRows}
            />
          </div>

          <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="border-b border-zinc-200 bg-zinc-50">
                  <tr>
                    <th className="px-3 py-3 text-left font-medium">Linha</th>
                    <th className="px-3 py-3 text-left font-medium">CNPJ</th>
                    <th className="px-3 py-3 text-left font-medium">Empresa</th>
                    <th className="px-3 py-3 text-left font-medium">Cidade/UF</th>
                    <th className="px-3 py-3 text-left font-medium">Situação</th>
                    <th className="px-3 py-3 text-left font-medium">Detalhe</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {visibleRows.map((row) => {
                    const status = STATUS_META[row.status];

                    return (
                      <tr key={row.rowNumber}>
                        <td className="px-3 py-3 align-top">{row.rowNumber}</td>
                        <td className="px-3 py-3 align-top font-mono text-xs">
                          {formatCnpj(row.data.cnpj)}
                        </td>
                        <td className="max-w-56 px-3 py-3 align-top">
                          <div className="font-medium">
                            {row.data.corporateName ||
                              row.data.tradeName ||
                              "Sem razão social"}
                          </div>
                          {row.data.tradeName && row.data.corporateName && (
                            <div className="text-xs text-zinc-500">
                              {row.data.tradeName}
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-3 align-top">
                          {[row.data.city, row.data.state]
                            .filter(Boolean)
                            .join("/") || "-"}
                        </td>
                        <td className="px-3 py-3 align-top">
                          <Badge className={status.className}>
                            {status.label}
                          </Badge>
                        </td>
                        <td className="max-w-80 px-3 py-3 align-top text-zinc-600">
                          {row.detail}
                          {row.conflicts.length > 0 && (
                            <div className="mt-1 text-xs font-medium text-orange-700">
                              Campos: {row.conflicts.join(", ")}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-zinc-200 px-3 py-2">
                <span className="text-sm text-zinc-500">
                  Página {page} de {totalPages}
                </span>
                <div className="flex gap-1">
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    aria-label="Página anterior"
                    disabled={page === 1}
                    onClick={() => setPage((current) => current - 1)}
                  >
                    <ChevronLeft />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    aria-label="Próxima página"
                    disabled={page === totalPages}
                    onClick={() => setPage((current) => current + 1)}
                  >
                    <ChevronRight />
                  </Button>
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Button
              type="button"
              size="lg"
              variant="outline"
              className="min-h-10 w-full sm:w-auto"
              onClick={resetImport}
              disabled={confirming}
            >
              Trocar arquivo
            </Button>
            <Button
              type="button"
              size="lg"
              className="h-auto min-h-10 w-full whitespace-normal px-4 py-2 text-center shadow-sm sm:w-auto"
              onClick={handleConfirm}
              disabled={confirming || analysis.summary.eligibleRows === 0}
            >
              {confirming ? (
                <LoaderCircle
                  data-icon="inline-start"
                  className="animate-spin"
                  aria-hidden="true"
                />
              ) : (
                <CheckCircle2 data-icon="inline-start" aria-hidden="true" />
              )}
              {confirming
                ? importProgress?.phase === "preparing"
                  ? "Preparando lotes..."
                  : "Importando..."
                : activeJobId
                  ? "Retomar importação"
                  : `Confirmar importação de ${analysis.summary.eligibleRows} linhas elegíveis`}
            </Button>
          </div>

          {importProgress && (
            <div
              role="status"
              aria-live="polite"
              className="space-y-2 border-t border-zinc-200 pt-4"
            >
              <div className="flex items-center justify-between gap-4 text-sm">
                <span className="font-medium text-zinc-700">
                  {importProgress.phase === "preparing"
                    ? "Preparando dados"
                    : "Importando empresas"}
                </span>
                <span className="tabular-nums text-zinc-500">
                  {importProgress.phase === "preparing"
                    ? importProgress.stagedRows
                    : importProgress.processedRows}
                  /{importProgress.eligibleRows}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-zinc-200">
                <div
                  className="h-full bg-zinc-900 transition-[width]"
                  style={{
                    width: `${
                      importProgress.eligibleRows === 0
                        ? 100
                        : Math.round(
                            ((importProgress.phase === "preparing"
                              ? importProgress.stagedRows
                              : importProgress.processedRows) /
                              importProgress.eligibleRows) *
                              100
                          )
                    }%`,
                  }}
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
