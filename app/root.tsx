import "./app.css";

import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "react-router";

const themeScript = `
(() => {
  const key = "theme-preference";
  const root = document.documentElement;
  const stored = localStorage.getItem(key) || "system";
  const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  root.dataset.theme = stored;
  root.classList.toggle("dark", stored === "dark" || (stored === "system" && systemDark));
})();
`;

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function AppRoot() {
  return <Outlet />;
}
