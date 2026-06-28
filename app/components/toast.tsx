import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type ToastTone = "info" | "success" | "warning" | "error";

type Toast = {
  id: number;
  message: string;
  tone: ToastTone;
};

type ToastContextValue = {
  showToast: (input: { message: string; tone?: ToastTone }) => void;
};

const ToastContext = createContext<ToastContextValue>({
  showToast: () => undefined,
});

function toneClassName(tone: ToastTone) {
  if (tone === "info") {
    return "border-sky-500/30 bg-sky-500/15 text-sky-950 dark:text-sky-50";
  }

  if (tone === "success") {
    return "border-emerald-500/30 bg-emerald-500/15 text-emerald-950 dark:text-emerald-50";
  }

  if (tone === "warning") {
    return "border-amber-500/30 bg-amber-500/15 text-amber-950 dark:text-amber-50";
  }

  return "border-red-500/30 bg-red-500/15 text-red-950 dark:text-red-50";
}

export function ToastProvider(props: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((input: { message: string; tone?: ToastTone }) => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    const toast = {
      id,
      message: input.message,
      tone: input.tone ?? "error",
    } satisfies Toast;

    setToasts((current) => [toast, ...current.filter((item) => item.message !== input.message)]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((item) => item.id !== id));
    }, 9000);
  }, []);

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {props.children}
      <div className="fixed right-4 top-4 z-50 flex w-[min(28rem,calc(100vw-2rem))] flex-col gap-2">
        {toasts.map((toast) => (
          <div
            className={`rounded-2xl border px-4 py-3 text-sm shadow-lg backdrop-blur ${toneClassName(
              toast.tone,
            )}`}
            key={toast.id}
            role="alert"
          >
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
