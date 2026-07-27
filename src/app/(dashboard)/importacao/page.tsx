"use client";

import { useState } from "react";
import Papa from "papaparse";
import { UploadZone } from "@/features/import/components/upload-zone";

export default function ImportacaoPage() {
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<Record<string, string>[]>([]);

  function handleFile(file: File) {
    setFile(file);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete(results) {
        setRows(results.data as Record<string, string>[]);
      },
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">
          Importação de Empresas
        </h1>

        <p className="mt-2 text-muted-foreground">
          Faça upload de um arquivo CSV para importar empresas para uma Base.
        </p>
      </div>

      <UploadZone onFileSelect={handleFile} />

      {file && (
        <div className="rounded-lg border p-4">
          <strong>Arquivo selecionado:</strong>

          <div className="mt-2">{file.name}</div>

          <div className="text-sm text-muted-foreground">
            {(file.size / 1024).toFixed(2)} KB
          </div>
        </div>
      )}

      {rows.length > 0 && (
        <div className="rounded-lg border overflow-auto">
          <table className="min-w-full text-sm">
            <thead className="border-b bg-muted">
              <tr>
                {Object.keys(rows[0]).map((column) => (
                  <th
                    key={column}
                    className="px-4 py-3 text-left font-semibold"
                  >
                    {column}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {rows.slice(0, 10).map((row, index) => (
                <tr key={index} className="border-b">
                  {Object.values(row).map((value, i) => (
                    <td key={i} className="px-4 py-2">
                      {value}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}