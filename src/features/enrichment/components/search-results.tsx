"use client";

import Link from "next/link";
import { useState } from "react";
import { ExternalLink, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export type SearchCompanyRow = {
  id: string;
  cnpj: string;
  corporateName: string;
  tradeName: string | null;
  segment: string | null;
  cityState: string;
  completeness: number;
  bases: string[];
};

export function SearchResults({
  companies,
  providerConfigured,
}: {
  companies: SearchCompanyRow[];
  providerConfigured: boolean;
}) {
  const [selected, setSelected] = useState<string[]>([]);

  function toggle(companyId: string) {
    setSelected((current) =>
      current.includes(companyId)
        ? current.filter((id) => id !== companyId)
        : [...current, companyId]
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-zinc-500">
          {selected.length} empresa{selected.length === 1 ? "" : "s"} selecionada
          {selected.length === 1 ? "" : "s"}
        </p>
        <Button
          type="button"
          disabled={!providerConfigured || selected.length === 0}
          title={
            providerConfigured
              ? "Gerar prévia de enriquecimento"
              : "Nenhum provedor de enriquecimento está configurado"
          }
        >
          <Sparkles data-icon="inline-start" />
          Gerar prévia
        </Button>
      </div>
      {!providerConfigured && (
        <p className="border-l-2 border-amber-400 pl-3 text-sm text-zinc-600">
          Enriquecimento externo indisponível. A pesquisa no cadastro permanece
          ativa e nenhum dado será substituído sem uma prévia de provedor.
        </p>
      )}
      <div className="overflow-x-auto border-y border-zinc-200">
        <table className="min-w-full text-sm">
          <thead className="bg-zinc-50">
            <tr>
              <th className="w-10 px-3 py-3">
                <span className="sr-only">Selecionar</span>
              </th>
              <th className="px-3 py-3 text-left font-medium">Empresa</th>
              <th className="px-3 py-3 text-left font-medium">CNPJ</th>
              <th className="px-3 py-3 text-left font-medium">Segmento</th>
              <th className="px-3 py-3 text-left font-medium">Cidade/UF</th>
              <th className="px-3 py-3 text-left font-medium">Completude</th>
              <th className="px-3 py-3 text-left font-medium">Bases</th>
              <th className="px-3 py-3 text-right font-medium">Dossiê</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {companies.map((company) => (
              <tr key={company.id}>
                <td className="px-3 py-3">
                  <input
                    type="checkbox"
                    checked={selected.includes(company.id)}
                    onChange={() => toggle(company.id)}
                    aria-label={`Selecionar ${company.corporateName}`}
                    className="size-4"
                  />
                </td>
                <td className="px-3 py-3">
                  <strong>{company.corporateName}</strong>
                  {company.tradeName && (
                    <div className="text-xs text-zinc-500">
                      {company.tradeName}
                    </div>
                  )}
                </td>
                <td className="whitespace-nowrap px-3 py-3 font-mono text-xs">
                  {company.cnpj}
                </td>
                <td className="px-3 py-3">{company.segment || "-"}</td>
                <td className="whitespace-nowrap px-3 py-3">
                  {company.cityState}
                </td>
                <td className="px-3 py-3">{company.completeness}%</td>
                <td className="px-3 py-3">
                  <div className="flex flex-wrap gap-1">
                    {company.bases.map((base) => (
                      <Badge key={base} variant="secondary">
                        {base}
                      </Badge>
                    ))}
                  </div>
                </td>
                <td className="px-3 py-3 text-right">
                  <Button
                    size="sm"
                    variant="outline"
                    nativeButton={false}
                    render={<Link href={`/empresas/${company.id}`} />}
                  >
                    <ExternalLink data-icon="inline-start" />
                    Abrir
                  </Button>
                </td>
              </tr>
            ))}
            {companies.length === 0 && (
              <tr>
                <td
                  colSpan={8}
                  className="px-4 py-10 text-center text-zinc-500"
                >
                  Nenhuma empresa encontrada.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
