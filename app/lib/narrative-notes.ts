function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

export type NarrativeSection = {
  text: string;
  title: string;
};

export function normalizeNarrativeSections(value: unknown): NarrativeSection[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    const record = asRecord(item);
    if (!record) {
      return [];
    }

    const text = typeof record.text === "string" ? record.text.trim() : "";
    if (!text) {
      return [];
    }

    return [
      {
        text,
        title: typeof record.title === "string" ? record.title.trim() : "",
      },
    ];
  });
}

export function serializeNarrativeSections(sections: NarrativeSection[]) {
  return sections.map((section) => ({
    text: section.text.trim(),
    title: section.title.trim(),
  }));
}
