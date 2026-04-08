import { Form, Link, NavLink, Outlet, useLoaderData } from "react-router";

import { ThemeToggle } from "~/components/theme-toggle";
import { cn } from "~/lib/utils";

type LoaderData = {
  user: {
    crm: string;
    crmUf: string;
    fullName: string;
  };
};

const links = [
  { label: "Patients", to: "/patients" },
  { label: "Agenda", to: "/agenda" },
  { label: "Settings", to: "/settings" },
];

export function AppShell() {
  const { user } = useLoaderData() as LoaderData;
  const currentYear = new Date().getFullYear();

  return (
    <div className="mx-auto min-h-screen max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <header className="panel mb-6 overflow-hidden">
        <div className="flex flex-col gap-4 border-b border-black/5 px-6 py-5 dark:border-white/10 md:flex-row md:items-center md:justify-between">
          <div>
            <Link className="text-xs font-semibold uppercase tracking-[0.28em] text-[color:var(--muted)]" to="/patients">
              Clinical MVP
            </Link>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight">
              FHIR-aligned private office workflow
            </h1>
            <p className="mt-1 text-sm text-[color:var(--muted)]">
              {user.fullName} · CRM {user.crm}/{user.crmUf}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <ThemeToggle />
            <Form action="/logout" method="post">
              <button className="button-secondary" type="submit">
                Logout
              </button>
            </Form>
          </div>
        </div>
        <nav className="flex flex-wrap gap-2 px-4 py-4">
          {links.map((link) => (
            <NavLink
              key={link.to}
              className={({ isActive }) =>
                cn(
                  "rounded-full px-4 py-2 text-sm font-medium transition",
                  isActive ? "bg-[color:var(--accent)] text-white" : "button-secondary",
                )
              }
              to={link.to}
            >
              {link.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main>
        <Outlet />
      </main>
      <footer className="mt-10 border-t border-black/5 px-2 py-6 text-sm text-[color:var(--muted)] dark:border-white/10">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p>
            Developed br{" "}
            <a
              className="font-medium text-[color:var(--foreground)] transition hover:text-[color:var(--accent)]"
              href="https://link.orango.io/Iyqdm"
              rel="noreferrer"
              target="_blank"
            >
              Filipe Lopes
            </a>
            {", MD © "}
            {currentYear}
          </p>
          <div className="flex items-center gap-4">
            <Link className="transition hover:text-[color:var(--accent)]" to="/docs">
              Docs
            </Link>
            <a
              className="transition hover:text-[color:var(--accent)]"
              href="https://github.com/filiperochalopes/fhir-soap-record"
              rel="noreferrer"
              target="_blank"
            >
              Github
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
