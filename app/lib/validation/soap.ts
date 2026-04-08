import { z } from "zod";

import { parseDateTimeInput, pickFirstString } from "~/lib/utils";

export const soapNoteInputSchema = z.object({
  assessment: z.string().trim().min(1, "Assessment is required"),
  encounteredAt: z.coerce.date(),
  objective: z.string().trim().min(1, "Objective is required"),
  plan: z.string().trim().min(1, "Plan is required"),
  subjective: z.string().trim().min(1, "Subjective is required"),
});

export type SoapNoteInput = z.infer<typeof soapNoteInputSchema>;

export function parseSoapForm(formData: FormData, timeZone?: string) {
  return soapNoteInputSchema.parse({
    assessment: pickFirstString(formData.get("assessment")),
    encounteredAt: parseDateTimeInput(pickFirstString(formData.get("encounteredAt")), timeZone),
    objective: pickFirstString(formData.get("objective")),
    plan: pickFirstString(formData.get("plan")),
    subjective: pickFirstString(formData.get("subjective")),
  });
}
