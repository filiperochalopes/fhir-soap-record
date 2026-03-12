import { redirect } from "react-router";

import { clearAuthCookie } from "~/lib/auth.server";

export async function action() {
  throw redirect("/login", {
    headers: {
      "Set-Cookie": clearAuthCookie(),
    },
  });
}

export async function loader() {
  throw redirect("/login");
}

