import { z } from "zod";

import { parseDateTimeInput, pickFirstString } from "~/lib/utils";

export const narrativeNoteInputSchema = z.object({
  body: z.string().trim().min(1, "Narrative note content is required"),
  encounteredAt: z.coerce.date(),
  title: z.string().trim().max(191).optional().default(""),
});

export type NarrativeNoteInput = z.infer<typeof narrativeNoteInputSchema>;

export function parseNarrativeForm(formData: FormData, timeZone?: string) {
  return narrativeNoteInputSchema.parse({
    body: pickFirstString(formData.get("body")),
    encounteredAt: parseDateTimeInput(pickFirstString(formData.get("encounteredAt")), timeZone),
    title: pickFirstString(formData.get("title")),
  });
}
