import { z } from "zod";

import { patientImportSchema } from "~/lib/validation/patients";

export const proprietaryImportSchema = z.object({
  patients: z.array(patientImportSchema).min(1, "At least one patient is required"),
  sourceSystem: z.string().trim().min(1, "sourceSystem is required"),
});

export type ProprietaryImportPayload = z.infer<typeof proprietaryImportSchema>;

export const bundleSchema = z.object({
  entry: z
    .array(
      z.object({
        fullUrl: z.string().optional(),
        resource: z.record(z.string(), z.unknown()),
      }),
    )
    .min(1),
  resourceType: z.literal("Bundle"),
  type: z.string().default("transaction"),
});

export type BundlePayload = z.infer<typeof bundleSchema>;

