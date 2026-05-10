import type { PluginTone } from "./PluginCard";

type Option<T extends string> = {
  disabled?: boolean;
  label: string;
  value: T;
};

const activeClass: Record<PluginTone, string> = {
  emerald:
    "border-emerald-500/40 bg-emerald-500/20 text-emerald-800 shadow-sm dark:text-emerald-100",
  violet:
    "border-violet-500/40 bg-violet-500/20 text-violet-800 shadow-sm dark:text-violet-100",
};

export function SegmentedControl<T extends string>(props: {
  onChange: (value: T) => void;
  options: Option<T>[];
  tone?: PluginTone;
  value: T;
}) {
  const tone = props.tone ?? "violet";
  return (
    <div
      className="inline-flex items-center gap-1 rounded-full border border-[color:var(--panel-border)] bg-white/50 p-1 dark:bg-slate-950/40"
      role="radiogroup"
    >
      {props.options.map((opt) => {
        const selected = props.value === opt.value;
        return (
          <button
            aria-checked={selected}
            className={`rounded-full border px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] transition disabled:cursor-not-allowed disabled:opacity-40 ${
              selected
                ? activeClass[tone]
                : "border-transparent text-[color:var(--muted)] hover:opacity-80"
            }`}
            disabled={opt.disabled}
            key={opt.value}
            onClick={() => props.onChange(opt.value)}
            role="radio"
            type="button"
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
