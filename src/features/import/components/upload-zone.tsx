"use client";

import { useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { FileSpreadsheet, UploadCloud } from "lucide-react";

type UploadZoneProps = {
  onFileSelect: (file: File) => void;
  disabled?: boolean;
};

export function UploadZone({
  onFileSelect,
  disabled = false,
}: UploadZoneProps) {
  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (acceptedFiles.length > 0) {
        onFileSelect(acceptedFiles[0]);
      }
    },
    [onFileSelect]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      "text/csv": [".csv"],
    },
    multiple: false,
    onDrop,
    disabled,
  });

  return (
    <div
      {...getRootProps()}
      aria-disabled={disabled}
      className={`flex min-h-52 cursor-pointer items-center justify-center rounded-lg border-2 border-dashed px-6 py-10 transition
      ${
        disabled
          ? "cursor-not-allowed border-zinc-200 bg-zinc-50 opacity-60"
          : isDragActive
          ? "border-blue-600 bg-blue-50"
          : "border-zinc-300 bg-zinc-50/50 hover:border-blue-500 hover:bg-blue-50/40"
      }`}
    >
      <input {...getInputProps()} />

      <div className="text-center">
        <span className="mx-auto mb-4 grid size-11 place-items-center rounded-lg bg-white text-blue-600 shadow-sm ring-1 ring-zinc-200">
          {isDragActive ? <UploadCloud aria-hidden="true" /> : <FileSpreadsheet aria-hidden="true" />}
        </span>
        <p className="font-semibold text-zinc-900">
          Arraste um arquivo CSV aqui
        </p>

        <p className="mt-1 text-sm text-zinc-500">
          ou clique para selecionar
        </p>
        <p className="mt-3 text-xs text-zinc-400">CSV com até 10 MB</p>
      </div>
    </div>
  );
}
