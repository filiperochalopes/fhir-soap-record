import { Form, Link, useLoaderData } from "react-router";

import { requireUserSession } from "~/lib/auth.server";
import { prisma } from "~/lib/prisma.server";
import { formatDate } from "~/lib/utils";

export async function loader({ request }: { request: Request }) {
  await requireUserSession(request);

  const url = new URL(request.url);
  const query = url.searchParams.get("q")?.trim() ?? "";

  const patients = await prisma.patient.findMany({
    where: query
      ? {
          OR: [
            { name: { contains: query } },
            {
              identifier: {
                some: {
                  value: { contains: query },
                },
              },
            },
          ],
        }
      : undefined,
    include: {
      identifier: true,
      telecom: true,
    },
    orderBy: {
      name: "asc",
    },
    take: 100,
  });

  return { patients, query };
}

export default function PatientsRoute() {
  const { patients, query } = useLoaderData<typeof loader>();

  return (
    <div className="space-y-6">
      <section className="panel p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[color:var(--muted)]">
              Patient registry
            </p>
            <h2 className="mt-2 text-3xl font-semibold">Patients</h2>
          </div>
          <Link className="button-primary" to="/patients/new">
            New patient
          </Link>
        </div>
        <Form className="mt-6 flex flex-col gap-3 md:flex-row" method="get">
          <input
            className="w-full"
            defaultValue={query}
            name="q"
            placeholder="Search by patient name or identifier"
          />
          <button className="button-secondary" type="submit">
            Search
          </button>
        </Form>
      </section>

      <section className="grid gap-4">
        {patients.length ? (
          patients.map((patient) => (
            <article className="panel p-5" key={patient.id}>
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="space-y-2">
                  <h3 className="text-xl font-semibold">{patient.name}</h3>
                  <div className="flex flex-wrap gap-3 text-sm text-[color:var(--muted)]">
                    <span>{formatDate(patient.birthDate)}</span>
                    <span className="uppercase">{patient.gender}</span>
                    {patient.identifier[0] ? (
                      <span>
                        {patient.identifier[0].system}: {patient.identifier[0].value}
                      </span>
                    ) : null}
                    {patient.telecom[0] ? (
                      <span>
                        {patient.telecom[0].system}: {patient.telecom[0].value}
                      </span>
                    ) : null}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link className="button-secondary" to={`/patients/${patient.id}/edit`}>
                    Edit
                  </Link>
                  <Link className="button-primary" to={`/patients/${patient.id}/soap`}>
                    Register SOAP
                  </Link>
                </div>
              </div>
            </article>
          ))
        ) : (
          <section className="panel p-6">
            <p className="text-sm text-[color:var(--muted)]">
              No patients found for this filter.
            </p>
          </section>
        )}
      </section>
    </div>
  );
}

