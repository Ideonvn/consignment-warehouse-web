"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils/cn";

export type ToastTone = "neutral" | "success" | "danger" | "accent";

export type ToastInput = {
  title: string;
  description?: string;
  tone?: ToastTone;
  durationMs?: number;
  action?: { label: string; onClick: () => void };
};

type Toast = ToastInput & { id: string };

type ToastContextValue = {
  showToast: (toast: ToastInput) => string;
  dismissToast: (id: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const TONE_STYLES: Record<ToastTone, string> = {
  neutral: "border-border bg-surface-raised text-text",
  success: "border-success/40 bg-surface-raised text-text",
  danger: "border-danger/50 bg-surface-raised text-text",
  accent: "border-accent-text/50 bg-surface-raised text-text",
};

const TONE_BAR: Record<ToastTone, string> = {
  neutral: "bg-text-muted",
  success: "bg-success",
  danger: "bg-danger",
  accent: "bg-accent-text",
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const dismissToast = useCallback((id: string) => {
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback(
    (input: ToastInput) => {
      const id = crypto.randomUUID();
      setToasts((current) => [...current.slice(-2), { ...input, id }]);
      timers.current.set(
        id,
        setTimeout(() => dismissToast(id), input.durationMs ?? 4500),
      );
      return id;
    },
    [dismissToast],
  );

  const value = useMemo(() => ({ showToast, dismissToast }), [showToast, dismissToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        aria-relevant="additions"
        className="pointer-events-none fixed inset-x-0 top-0 z-50 mx-auto flex max-w-(--app-width) flex-col gap-2 px-4 pt-[calc(env(safe-area-inset-top)+0.75rem)]"
      >
        <AnimatePresence initial={false}>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              layout
              initial={{ opacity: 0, y: -16, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -12, scale: 0.98 }}
              transition={{ type: "spring", stiffness: 500, damping: 40 }}
              className={cn(
                "pointer-events-auto flex items-start gap-3 overflow-hidden rounded-2xl border p-3 shadow-lg shadow-black/40",
                TONE_STYLES[toast.tone ?? "neutral"],
              )}
            >
              <span
                aria-hidden
                className={cn("mt-0.5 h-full w-1 shrink-0 rounded-full", TONE_BAR[toast.tone ?? "neutral"])}
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{toast.title}</p>
                {toast.description ? (
                  <p className="mt-0.5 text-sm text-text-muted">{toast.description}</p>
                ) : null}
                {toast.action ? (
                  <button
                    type="button"
                    onClick={() => {
                      toast.action?.onClick();
                      dismissToast(toast.id);
                    }}
                    className="mt-2 min-h-11 text-sm font-semibold text-accent-text underline underline-offset-4"
                  >
                    {toast.action.label}
                  </button>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => dismissToast(toast.id)}
                aria-label="Dismiss notification"
                className="-m-1 shrink-0 rounded-full p-2 text-text-muted hover:text-text"
              >
                <svg viewBox="0 0 20 20" className="h-4 w-4" aria-hidden fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M5 5l10 10M15 5L5 15" strokeLinecap="round" />
                </svg>
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used inside <ToastProvider>");
  return context;
}
