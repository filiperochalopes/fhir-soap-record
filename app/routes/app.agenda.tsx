import { Form, useLoaderData } from "react-router";

import { requireUserSession } from "~/lib/auth.server";
import { prisma } from "~/lib/prisma.server";
import { getUiTimeZone } from "~/lib/settings.server";
import {
  formatDateTime,
  getDayRangeForTimeZone,
  getTodayDateInputValue,
} from "~/lib/utils";

export async function loader({ request }: { request: Request }) {
  await requireUserSession(request);

  const url = new URL(request.url);
  const dateValue = url.searchParams.get("date");
  const timeZone = await getUiTimeZone();
  const selectedDate = dateValue ?? getTodayDateInputValue(timeZone);
  const dayRange = getDayRangeForTimeZone(selectedDate, timeZone);

  const appointments = await prisma.appointment.findMany({
    where: {
      start: {
        gte: dayRange.start,
        lte: dayRange.end,
      },
    },
    include: {
      patient: true,
    },
    orderBy: {
      start: "asc",
    },
  });

  return {
    appointments,
    date: selectedDate,
    timeZone,
  };
}

export default function AgendaRoute() {
  const { appointments, date, timeZone } = useLoaderData<typeof loader>();

  return (
    <div className="space-y-6">
      <section className="panel p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[color:var(--muted)]">
              Read-only agenda
            </p>
            <h2 className="mt-2 text-3xl font-semibold">Appointments</h2>
          </div>
          <Form className="flex flex-wrap items-end gap-3" method="get">
            <label className="block">
              <span className="field-label">Date</span>
              <input defaultValue={date} name="date" type="date" />
            </label>
            <button className="button-secondary" type="submit">
              Load day
            </button>
          </Form>
        </div>
      </section>

      <section className="panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-black/5 text-xs uppercase tracking-[0.22em] text-[color:var(--muted)] dark:bg-white/5">
              <tr>
                <th className="px-5 py-4">Patient</th>
                <th className="px-5 py-4">Start</th>
                <th className="px-5 py-4">End</th>
                <th className="px-5 py-4">Status</th>
                <th className="px-5 py-4">Type</th>
              </tr>
            </thead>
            <tbody>
              {appointments.length ? (
                appointments.map((appointment) => (
                  <tr className="border-t border-black/5 dark:border-white/10" key={appointment.id}>
                    <td className="px-5 py-4 font-medium">{appointment.patient.name}</td>
                    <td className="px-5 py-4">{formatDateTime(appointment.start, { timeZone })}</td>
                    <td className="px-5 py-4">{formatDateTime(appointment.end, { timeZone })}</td>
                    <td className="px-5 py-4 uppercase text-[color:var(--muted)]">
                      {appointment.status}
                    </td>
                    <td className="px-5 py-4">{appointment.appointmentType}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="px-5 py-6 text-[color:var(--muted)]" colSpan={5}>
                    No appointments registered for this date.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
