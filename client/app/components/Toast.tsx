import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export interface Toast {
  id: string;
  icon?: string;
  title: string;
  body?: string;
  action?: string;
  onAction?: () => void;
}

interface ToastContextValue {
  toasts: Toast[];
  push: (t: Omit<Toast, "id">) => void;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export const ToastProvider = ({ children }: { children: ReactNode }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (t: Omit<Toast, "id">) => {
      const id = Math.random().toString(36).slice(2);
      setToasts((prev) => [...prev, { ...t, id }]);
      const ttl = t.action ? 9000 : 5500;
      setTimeout(() => dismiss(id), ttl);
    },
    [dismiss]
  );

  const value = useMemo(
    () => ({ toasts, push, dismiss }),
    [toasts, push, dismiss]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastHost />
    </ToastContext.Provider>
  );
};

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}

const ToastHost = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) return null;
  const { toasts, dismiss } = ctx;
  return (
    <div className="toast-wrap" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className="toast">
          <span style={{ fontSize: 18 }}>{t.icon || "✨"}</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600 }}>{t.title}</div>
            {t.body && (
              <div style={{ fontSize: 13, opacity: 0.85 }}>{t.body}</div>
            )}
          </div>
          {t.action && (
            <button
              type="button"
              className="toast-cta"
              onClick={() => {
                t.onAction?.();
                dismiss(t.id);
              }}
            >
              {t.action}
            </button>
          )}
        </div>
      ))}
    </div>
  );
};
