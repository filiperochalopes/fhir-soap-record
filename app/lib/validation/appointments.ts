import { z } from "zod";

export const appointmentInputSchema = z
  .object({
    appointmentType: z.string().trim().min(1, "Appointment type is required"),
    end: z.date(),
    patientId: z.number().int().positive("Patient reference is required"),
    start: z.date(),
    status: z.string().trim().min(1, "Appointment status is required"),
  })
  .superRefine((value, ctx) => {
    if (value.end <= value.start) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Appointment end must be later than start.",
        path: ["end"],
      });
    }
  });

export type AppointmentInput = z.infer<typeof appointmentInputSchema>;
