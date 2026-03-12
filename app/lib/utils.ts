import clsx from "clsx";

export function cn(...values: Array<string | false | null | undefined>) {
  return clsx(values);
}

export function parseDateInput(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

export function parseDateTimeInput(value: string) {
  return new Date(value);
}

export function formatDate(value: Date | string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
  }).format(new Date(value));
}

export function formatDateTime(value: Date | string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

export function startOfDay(value: Date) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

export function endOfDay(value: Date) {
  const date = new Date(value);
  date.setHours(23, 59, 59, 999);
  return date;
}

export function toDateInputValue(value: Date | string) {
  return new Date(value).toISOString().slice(0, 10);
}

export function toDateTimeLocalValue(value: Date | string) {
  const date = new Date(value);
  const tzOffset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - tzOffset).toISOString().slice(0, 16);
}

export function pickFirstString(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value : "";
}

export function extractRepeatedPairs(
  formData: FormData,
  leftKey: string,
  rightKey: string,
) {
  const left = formData.getAll(leftKey).map((value) => String(value).trim());
  const right = formData.getAll(rightKey).map((value) => String(value).trim());

  return left
    .map((first, index) => ({
      first,
      second: right[index] ?? "",
    }))
    .filter((item) => item.first || item.second);
}

export function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function stripHtml(value: string) {
  return value.replace(/<[^>]+>/g, "").trim();
}

