import type { Appointment, Patient } from "@prisma/client";

export type AppointmentWithPatient = Appointment & {
  patient: Patient;
};

export function toFhirAppointment(appointment: AppointmentWithPatient) {
  return {
    resourceType: "Appointment",
    id: String(appointment.id),
    status: appointment.status,
    start: appointment.start.toISOString(),
    end: appointment.end.toISOString(),
    appointmentType: {
      text: appointment.appointmentType,
    },
    participant: [
      {
        actor: {
          display: appointment.patient.name,
          reference: `Patient/${appointment.patientId}`,
        },
        status: "accepted",
      },
    ],
  };
}

