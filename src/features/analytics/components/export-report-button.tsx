"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";

export function ExportReportButton({
  href,
  label,
}: {
  href: string;
  label: string;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function exportReport() {
    if (loading) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetch(href, { credentials: "same-origin" });
      if (!response.ok) throw new Error("EXPORT_FAILED");
      const blob = await response.blob();
      const disposition = response.headers.get("content-disposition") || "";
      const fileName =
        disposition.match(/filename="([^"]+)"/)?.[1] || "salescockpit.csv";
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = fileName;
      anchor.click();
      URL.revokeObjectURL(objectUrl);
    } catch {
      setError("Não foi possível exportar o relatório.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid justify-items-end gap-1">
      <Button
        type="button"
        variant="outline"
        onClick={exportReport}
        disabled={loading}
      >
        {loading ? (
          <Loader2 className="animate-spin" data-icon="inline-start" />
        ) : (
          <Download data-icon="inline-start" />
        )}
        {loading ? "Preparando" : label}
      </Button>
      {error && (
        <span role="alert" className="text-xs text-red-700">
          {error}
        </span>
      )}
    </div>
  );
}
