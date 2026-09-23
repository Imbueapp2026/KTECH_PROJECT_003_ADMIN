"use client";

import { useEffect } from "react";

/**
 * Automatically pings the database health endpoint periodically in the background
 * to prevent Supabase free-tier project from pausing/sleeping due to inactivity.
 */
export function DatabaseKeepAlive() {
  useEffect(() => {
    // Immediate ping on mount
    fetch("/api/ping", { cache: "no-store" }).catch(() => {});

    // Periodic ping every 10 minutes while active
    const interval = setInterval(() => {
      fetch("/api/ping", { cache: "no-store" }).catch(() => {});
    }, 10 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  return null;
}
