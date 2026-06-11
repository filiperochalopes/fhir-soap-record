import { z } from "zod";

const envSchema = z.object({
  APP_URL: z.string().url().default("http://localhost:3000"),
  COOKIE_NAME: z.string().default("clinic_token"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  API_DRY_RUN: z.preprocess(
    (value) =>
      typeof value === "string"
        ? value.trim().toLowerCase() === "true"
        : value,
    z.boolean().default(false),
  ),
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  PORT: z.coerce.number().default(3000),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_BUCKET: z.string().optional(),
  S3_ENDPOINT: z.string().optional(),
  S3_FORCE_PATH_STYLE: z.preprocess(
    (value) =>
      typeof value === "string"
        ? value.trim().toLowerCase() === "true"
        : value,
    z.boolean().default(false),
  ),
  S3_REGION: z.string().default("us-east-1"),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
});

export const env = envSchema.parse(process.env);

if (env.API_DRY_RUN) {
  console.warn(
    "[DRY RUN] API_DRY_RUN=true — FHIR API writes are stored in memory only. Data will be lost on restart.",
  );
}
