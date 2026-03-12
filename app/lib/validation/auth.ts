import { z } from "zod";

export const loginSchema = z.object({
  token: z.string().trim().min(1, "Token is required"),
});

export const authUserCliSchema = z.object({
  crm: z.string().trim().min(1, "CRM is required"),
  crmUf: z
    .string()
    .trim()
    .min(2, "CRM UF is required")
    .max(10)
    .transform((value) => value.toUpperCase()),
  fullName: z.string().trim().min(3, "Full name is required"),
});

