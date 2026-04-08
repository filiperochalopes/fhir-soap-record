import { useEffect, useRef, useState } from "react";
import { Form, Link, useLoaderData, useSubmit } from "react-router";

import { requireUserSession } from "~/lib/auth.server";
import { prisma } from "~/lib/prisma.server";
import { getUiTimeZone } from "~/lib/settings.server";
import { formatDate, formatPatientAge } from "~/lib/utils";

const PAGE_SIZE = 25;

function buildPatientsFilter(query: string) {
  if (!query) {
    return { active: true };
  }

  return {
    active: true,
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
  };
}

function buildPatientsPageHref(query: string, page: number) {
  const params = new URLSearchParams();

  if (query) {
    params.set("q", query);
  }

  params.set("page", String(page));
  return `/patients?${params.toString()}`;
}

function parsePage(value: string | null) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

export async function loader({ request }: { request: Request }) {
  await requireUserSession(request);

  const url = new URL(request.url);
  const query = url.searchParams.get("q")?.trim() ?? "";
  const requestedPage = parsePage(url.searchParams.get("page"));
  const where = buildPatientsFilter(query);
  const timeZone = await getUiTimeZone();

  const totalPatients = await prisma.patient.count({ where });
  const totalPages = Math.max(1, Math.ceil(totalPatients / PAGE_SIZE));
  const currentPage = Math.min(requestedPage, totalPages);
  const offset = (currentPage - 1) * PAGE_SIZE;

  const patients = await prisma.patient.findMany({
    where,
    include: {
      identifier: true,
      telecom: true,
    },
    orderBy: {
      name: "asc",
    },
    skip: offset,
    take: PAGE_SIZE,
  });

  return {
    currentPage,
    pageSize: PAGE_SIZE,
    patients,
    query,
    timeZone,
    totalPatients,
    totalPages,
  };
}

function PatientsSearchForm(props: { query: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const submit = useSubmit();
  const [value, setValue] = useState(props.query);

  useEffect(() => {
    setValue(props.query);
  }, [props.query]);

  useEffect(() => {
    if (!formRef.current || value === props.query) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      const formData = new FormData(formRef.current!);
      formData.set("q", value);
      formData.set("page", "1");
      submit(formData, { method: "get", replace: true });
    }, 300);

    return () => window.clearTimeout(timeoutId);
  }, [props.query, submit, value]);

  return (
    <Form className="mt-6 flex flex-col gap-3 md:flex-row" method="get" ref={formRef}>
      <input name="page" type="hidden" value="1" />
      <input
        className="w-full"
        name="q"
        placeholder="Search by patient name or identifier"
        value={value}
        onChange={(event) => setValue(event.currentTarget.value)}
      />
      <button className="button-secondary" type="submit">
        Search
      </button>
    </Form>
  );
}

function Pagination(props: {
  currentPage: number;
  query: string;
  totalPages: number;
  totalPatients: number;
}) {
  if (props.totalPatients <= PAGE_SIZE) {
    return null;
  }

  const startPage = Math.max(1, props.currentPage - 2);
  const endPage = Math.min(props.totalPages, startPage + 4);
  const pageNumbers = [];

  for (let page = startPage; page <= endPage; page += 1) {
    pageNumbers.push(page);
  }

  return (
    <section className="panel flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
      <p className="text-sm text-[color:var(--muted)]">
        Page {props.currentPage} of {props.totalPages} · {props.totalPatients} patients
      </p>
      <div className="flex flex-wrap gap-2">
        {props.currentPage > 1 ? (
          <Link
            className="button-secondary"
            to={buildPatientsPageHref(props.query, props.currentPage - 1)}
          >
            Previous
          </Link>
        ) : null}

        {pageNumbers.map((page) => (
          <Link
            className={page === props.currentPage ? "button-primary" : "button-secondary"}
            key={page}
            to={buildPatientsPageHref(props.query, page)}
          >
            {page}
          </Link>
        ))}

        {props.currentPage < props.totalPages ? (
          <Link
            className="button-secondary"
            to={buildPatientsPageHref(props.query, props.currentPage + 1)}
          >
            Next
          </Link>
        ) : null}
      </div>
    </section>
  );
}

export default function PatientsRoute() {
  const { currentPage, patients, query, timeZone, totalPages, totalPatients } =
    useLoaderData<typeof loader>();

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
        <PatientsSearchForm query={query} />
      </section>

      <section className="grid gap-4">
        {patients.length ? (
          patients.map((patient) => {
            const patientAge = formatPatientAge(patient.birthDate, { timeZone });

            return (
              <article className="panel p-5" key={patient.id}>
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-3">
                      <h3 className="text-xl font-semibold">{patient.name}</h3>
                      {patientAge ? (
                        <span className="text-sm font-medium text-[color:var(--muted)]">
                          {patientAge}
                        </span>
                      ) : null}
                      {patient.isDraft ? (
                        <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-700">
                          Draft
                        </span>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap gap-3 text-sm text-[color:var(--muted)]">
                      <span>{patient.birthDate ? formatDate(patient.birthDate) : "Birth date pending"}</span>
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
                      Register notes
                    </Link>
                  </div>
                </div>
              </article>
            );
          })
        ) : (
          <section className="panel p-6">
            <p className="text-sm text-[color:var(--muted)]">
              No patients found for this filter.
            </p>
          </section>
        )}
      </section>

      <Pagination
        currentPage={currentPage}
        query={query}
        totalPages={totalPages}
        totalPatients={totalPatients}
      />
    </div>
  );
}
