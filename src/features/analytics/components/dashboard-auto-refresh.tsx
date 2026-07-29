"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const DASHBOARD_REFRESH_MS = 60_000;

export function DashboardAutoRefresh() {
  const router = useRouter();

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, DASHBOARD_REFRESH_MS);
    return () => window.clearInterval(interval);
  }, [router]);

  return null;
}
