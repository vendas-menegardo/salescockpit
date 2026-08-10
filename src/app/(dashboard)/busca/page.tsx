import { redirect } from "next/navigation";

export default async function BuscaPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "string" && value) query.set(key, value);
  }
  redirect(`/empresas${query.size ? `?${query}` : ""}`);
}
