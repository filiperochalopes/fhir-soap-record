import { z } from "zod";

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
