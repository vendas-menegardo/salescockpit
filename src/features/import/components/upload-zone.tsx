"use client";

import { useCallback } from "react";
import { useDropzone } from "react-dropzone";

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
      className={`flex h-72 cursor-pointer items-center justify-center rounded-xl border-2 border-dashed transition
      ${
        disabled
          ? "cursor-not-allowed border-gray-200 bg-gray-50 opacity-60"
          : isDragActive
          ? "border-blue-600 bg-blue-50"
          : "border-gray-300 hover:border-blue-500"
      }`}
    >
      <input {...getInputProps()} />

      <div className="text-center">
        <p className="text-lg font-semibold">
          Arraste um arquivo CSV aqui
        </p>

        <p className="mt-2 text-sm text-muted-foreground">
          ou clique para selecionar
        </p>
      </div>
    </div>
  );
}
