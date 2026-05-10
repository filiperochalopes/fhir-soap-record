import { useEffect, useRef, useState } from "react";

type Section = "request" | "response";

type Props = {
  request: unknown;
  response: unknown;
  onClose: () => void;
};

export function DebugJsonModal({ request, response, onClose }: Props) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const [section, setSection] = useState<Section>("request");
  const [copied, setCopied] = useState(false);

  const data = section === "request" ? request : response;
  const json = JSON.stringify(data, null, 2);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  function handleOverlayClick(e: React.MouseEvent) {
    if (e.target === overlayRef.current) onClose();
  }

  function handleCopy() {
    void navigator.clipboard.writeText(json).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      ref={overlayRef}
      onClick={handleOverlayClick}
    >
      <div className="panel flex max-h-[80vh] w-full max-w-2xl flex-col overflow-hidden p-0">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[color:var(--panel-border)] px-5 py-3">
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)]">
            Debug — MCP Calc
          </span>
          <div className="flex items-center gap-2">
            <button
              className="button-secondary px-3 py-1 text-xs"
              onClick={handleCopy}
              type="button"
            >
              {copied ? "Copiado ✓" : "Copiar"}
            </button>
            <button
              aria-label="Fechar"
              className="flex h-7 w-7 items-center justify-center rounded-full border border-[color:var(--panel-border)] text-[color:var(--muted)] transition hover:opacity-70"
              onClick={onClose}
              type="button"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-[color:var(--panel-border)]">
          {(["request", "response"] as Section[]).map((tab) => (
            <button
              className={[
                "px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.16em] transition",
                section === tab
                  ? "border-b-2 border-emerald-500 text-emerald-700 dark:text-emerald-300"
                  : "text-[color:var(--muted)] hover:text-[color:var(--page-ink)]",
              ].join(" ")}
              key={tab}
              onClick={() => setSection(tab)}
              type="button"
            >
              {tab === "request" ? "Request (payload)" : "Response (tool results)"}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="overflow-auto">
          <pre className="p-5 text-xs leading-relaxed text-[color:var(--page-ink)]">{json}</pre>
        </div>
      </div>
    </div>
  );
}
