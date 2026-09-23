"use client";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type ToastTone = "default" | "success" | "danger";

type Toast = { id: number; message: string; tone: ToastTone };

type ToastContextValue = {
  push: (message: string, tone?: ToastTone) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((message: string, tone: ToastTone = "default") => {
    const id = Date.now() + Math.random();
    setToasts((cur) => [...cur, { id, message, tone }]);
    setTimeout(() => {
      setToasts((cur) => cur.filter((t) => t.id !== id));
    }, 3500);
  }, []);
  const value = useMemo(() => ({ push }), [push]);
  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed bottom-4 right-4 flex flex-col gap-2 z-50">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`px-4 py-2 rounded-[var(--radius-sm)] shadow-[var(--shadow-modal)] text-sm ${
              t.tone === "success"
                ? "bg-[var(--color-success)] text-[var(--color-primary)]"
                : t.tone === "danger"
                  ? "bg-[var(--color-error)] text-[var(--color-primary)]"
                  : "bg-[var(--color-ink)] text-[var(--color-primary)]"
            }`}
            role={t.tone === "danger" ? "alert" : "status"}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}