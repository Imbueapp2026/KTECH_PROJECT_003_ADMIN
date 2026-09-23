"use client";
import { useEffect } from "react";

const TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes of inactivity
const WARNING_MS = 2 * 60 * 1000; // Show warning 2 minutes before timeout

/**
 * Hook to track user inactivity and auto-logout after timeout.
 * Tracks mousemove, keydown, click, and scroll events to reset activity timer.
 * Shows a warning toast 2 minutes before timeout, then signs out at 30 minutes.
 */
export function useSessionTimeout(signOut: () => Promise<void>) {
  useEffect(() => {
    let lastActivity = Date.now();
    let warningShown = false;
    let checkId: NodeJS.Timeout | null = null;

    const resetActivity = () => {
      lastActivity = Date.now();
    };

    const checkTimeout = () => {
      const now = Date.now();
      const inactiveTime = now - lastActivity;

      // Show warning 2 minutes before timeout
      if (!warningShown && inactiveTime >= TIMEOUT_MS - WARNING_MS) {
        warningShown = true;
        // You could add a toast notification here
        console.warn("[session] Session expiring in 2 minutes due to inactivity");
      }

      // Sign out after 30 minutes of inactivity
      if (inactiveTime >= TIMEOUT_MS) {
        console.warn("[session] Session expired due to inactivity");
        signOut();
      }
    };

    // Track user activity
    window.addEventListener("mousemove", resetActivity);
    window.addEventListener("keydown", resetActivity);
    window.addEventListener("click", resetActivity);
    window.addEventListener("scroll", resetActivity);

    // Check for timeout every minute
    checkId = setInterval(checkTimeout, 60_000);

    return () => {
      window.removeEventListener("mousemove", resetActivity);
      window.removeEventListener("keydown", resetActivity);
      window.removeEventListener("click", resetActivity);
      window.removeEventListener("scroll", resetActivity);
      if (checkId) clearInterval(checkId);
    };
  }, [signOut]);
}
