import { Prisma, PrismaClient } from "@prisma/client";

import { writeAuditLog } from "~/lib/audit.server";
import { prisma } from "~/lib/prisma.server";
import type { AppointmentInput } from "~/lib/validation/appointments";

type AppointmentClient = PrismaClient | Prisma.TransactionClient;

async function assertSchedulablePatient(patientId: number, db: AppointmentClient) {
  const patient = await db.patient.findUnique({
    where: { id: patientId },
    select: {
      active: true,
      id: true,
      mergedIntoPatientId: true,
    },
  });

  if (!patient) {
    throw new Error("Patient not found.");
  }

  if (!patient.active || patient.mergedIntoPatientId) {
    throw new Error("Appointment patient must reference an active patient.");
  }
}

export async function saveAppointment(
  input: AppointmentInput,
  actorUserId: number,
  appointmentId?: number,
) {
  return prisma.$transaction(async (tx) => {
    if (appointmentId) {
      const existingAppointment = await tx.appointment.findUnique({
        where: { id: appointmentId },
        select: { id: true },
      });

      if (!existingAppointment) {
        throw new Error("Appointment not found.");
      }
    }

    await assertSchedulablePatient(input.patientId, tx);

    const appointment = appointmentId
      ? await tx.appointment.update({
          where: { id: appointmentId },
          data: {
            appointmentType: input.appointmentType,
            end: input.end,
            patientId: input.patientId,
            start: input.start,
            status: input.status,
          },
          include: {
            patient: true,
          },
        })
      : await tx.appointment.create({
          data: {
            appointmentType: input.appointmentType,
            end: input.end,
            patientId: input.patientId,
            start: input.start,
            status: input.status,
          },
          include: {
            patient: true,
          },
        });

    await writeAuditLog(tx, {
      action: appointmentId ? "appointment.updated" : "appointment.created",
      category: "appointment",
      entityId: String(appointment.id),
      entityType: "Appointment",
      metadata: {
        appointmentType: appointment.appointmentType,
        end: appointment.end.toISOString(),
        patientId: appointment.patientId,
        start: appointment.start.toISOString(),
        status: appointment.status,
      } satisfies Prisma.JsonObject,
      userId: actorUserId,
    });

    return appointment;
  });
}
