"use client";

import { useRouter, useSearchParams } from "next/navigation";

export function CompanyPageSizeSelect({ value }: { value: number }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  return (
    <select
      aria-label="Itens por página"
      value={String(value)}
      onChange={(event) => {
        const params = new URLSearchParams(searchParams.toString());
        params.set("pageSize", event.target.value);
        params.delete("page");
        params.delete("companyId");
        router.replace(`/empresas?${params}`, { scroll: false });
      }}
      className="h-8 rounded-lg border border-input bg-white px-2 text-sm"
    >
      <option value="25">25 por página</option>
      <option value="50">50 por página</option>
      <option value="100">100 por página</option>
    </select>
  );
}
