import { CreateBaseView } from "@/features/bases/components/create-base-view";
import { requireAdmin } from "@/lib/auth-session";

export default async function NovaBasePage() {
  await requireAdmin();

  return <CreateBaseView />;
}
