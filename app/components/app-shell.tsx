import { Form, Link, NavLink, Outlet, useLoaderData } from "react-router";

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
            <Link
              aria-label="Settings"
              className="button-secondary h-11 w-11 rounded-full p-0"
              title="Settings"
              to="/settings"
            >
              <svg
                aria-hidden="true"
                fill="none"
                height="20"
                viewBox="0 0 20 20"
                width="20"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  clipRule="evenodd"
                  d="M17.2294 10C17.2294 10.34 17.1993 10.66 17.1593 10.98L19.2693 12.63C19.4594 12.78 19.5093 13.05 19.3893 13.27L17.3893 16.73C17.2993 16.89 17.1293 16.98 16.9594 16.98C16.8993 16.98 16.8394 16.97 16.7793 16.95L14.2893 15.95C13.7693 16.34 13.2094 16.68 12.5994 16.93L12.2194 19.58C12.1893 19.82 11.9794 20 11.7294 20H7.72937C7.47937 20 7.26929 19.82 7.23938 19.58L6.85938 16.93C6.24939 16.68 5.68933 16.35 5.16931 15.95L2.67932 16.95C2.62927 16.97 2.56934 16.98 2.50928 16.98C2.32935 16.98 2.1593 16.89 2.06934 16.73L0.0693359 13.27C-0.0506592 13.05 -0.000610352 12.78 0.189331 12.63L2.29932 10.98C2.25928 10.66 2.22937 10.33 2.22937 10C2.22937 9.67001 2.25928 9.34 2.29932 9.01999L0.189331 7.37C-0.000610352 7.22 -0.0606689 6.95001 0.0693359 6.73001L2.06934 3.26999C2.1593 3.10999 2.32935 3.01999 2.49939 3.01999C2.55933 3.01999 2.61938 3.03 2.67932 3.04999L5.16931 4.04999C5.68933 3.66 6.24939 3.32001 6.85938 3.07001L7.23938 0.420013C7.26929 0.179993 7.47937 0 7.72937 0H11.7294C11.9794 0 12.1893 0.179993 12.2194 0.420013L12.5994 3.07001C13.2094 3.32001 13.7693 3.64999 14.2893 4.04999L16.7793 3.04999C16.8293 3.03 16.8893 3.01999 16.9493 3.01999C17.1293 3.01999 17.2993 3.10999 17.3893 3.26999L19.3893 6.73001C19.5093 6.95001 19.4594 7.22 19.2693 7.37L17.1593 9.01999C17.1993 9.34 17.2294 9.66 17.2294 10ZM15.2294 10C15.2294 9.79001 15.2194 9.57999 15.1793 9.26999L15.0393 8.14001L15.9293 7.44L16.9994 6.59L16.2993 5.38L15.0293 5.89001L13.9694 6.32001L13.0593 5.62C12.6593 5.32001 12.2594 5.09 11.8293 4.91L10.7693 4.48001L10.6094 3.35001L10.4193 2H9.0293L8.82935 3.35001L8.66931 4.48001L7.60938 4.91C7.19934 5.07999 6.78931 5.32001 6.35938 5.64001L5.45935 6.32001L4.41931 5.89999L3.14929 5.39001L2.44934 6.60001L3.5293 7.44L4.41931 8.14001L4.2793 9.26999C4.24939 9.57001 4.22937 9.79999 4.22937 10C4.22937 10.2 4.24939 10.43 4.2793 10.74L4.41931 11.87L3.5293 12.57L2.44934 13.41L3.14929 14.62L4.41931 14.11L5.47937 13.68L6.38928 14.38C6.78931 14.68 7.18933 14.91 7.61938 15.09L8.67932 15.52L8.83936 16.65L9.0293 18H10.4293L10.6294 16.65L10.7893 15.52L11.8494 15.09C12.2594 14.92 12.6693 14.68 13.0994 14.36L13.9994 13.68L15.0393 14.1L16.3093 14.61L17.0094 13.4L15.9293 12.56L15.0393 11.86L15.1793 10.73C15.2094 10.43 15.2294 10.21 15.2294 10ZM9.72937 6C7.51941 6 5.72937 7.79001 5.72937 10C5.72937 12.21 7.51941 14 9.72937 14C11.9393 14 13.7294 12.21 13.7294 10C13.7294 7.79001 11.9393 6 9.72937 6ZM7.72937 10C7.72937 11.1 8.62939 12 9.72937 12C10.8293 12 11.7294 11.1 11.7294 10C11.7294 8.89999 10.8293 8 9.72937 8C8.62939 8 7.72937 8.89999 7.72937 10Z"
                  fill="currentColor"
                  fillOpacity="0.54"
                  fillRule="evenodd"
                />
              </svg>
            </Link>
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
