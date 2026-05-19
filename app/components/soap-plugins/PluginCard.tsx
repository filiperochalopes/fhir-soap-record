import type { ReactNode } from "react";

export type PluginTone = "violet" | "emerald";

const spotlightClass: Record<PluginTone, string> = {
  emerald: "panel-spotlight-emerald",
  violet: "panel-spotlight",
};

const labelClass: Record<PluginTone, string> = {
  emerald: "text-emerald-700 dark:text-emerald-200",
  violet: "text-violet-700 dark:text-violet-200",
};

const chipClass: Record<PluginTone, string> = {
  emerald:
    "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200",
  violet: "border-violet-500/20 bg-violet-500/10 text-violet-700 dark:text-violet-200",
};

export function PluginCard(props: {
  badge?: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  description: ReactNode;
  label: string;
  title: string;
  tone: PluginTone;
}) {
  const { tone } = props;
  return (
    <details
      className={`panel ${spotlightClass[tone]} summary-details p-6`}
      open={props.defaultOpen ?? true}
    >
      <summary className="summary-toggle flex cursor-pointer list-none items-start justify-between gap-4">
        <div>
          <p
            className={`text-xs font-semibold uppercase tracking-[0.28em] ${labelClass[tone]}`}
          >
            {props.label}
          </p>
          <h3 className="mt-2 text-2xl font-semibold">{props.title}</h3>
          <p className="mt-2 max-w-3xl text-sm text-[color:var(--muted)]">
            {props.description}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {props.badge ? (
            <div
              className={`whitespace-nowrap rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${chipClass[tone]}`}
            >
              {props.badge}
            </div>
          ) : null}
          <span
            aria-hidden="true"
            className={`summary-toggle-icon mt-1 inline-flex h-8 w-8 items-center justify-center rounded-full border ${chipClass[tone]}`}
          >
            <svg
              fill="none"
              height="8"
              viewBox="0 0 12 8"
              width="12"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M1.41 7.41L6 2.83L10.59 7.41L12 6L6 0L0 6L1.41 7.41Z"
                fill="currentColor"
                fillOpacity="0.54"
              />
            </svg>
          </span>
        </div>
      </summary>

      <div className="mt-6">{props.children}</div>
    </details>
  );
}
