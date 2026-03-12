import { redirect } from "react-router";

import { getAuthContext } from "~/lib/auth.server";

export async function loader({ request }: { request: Request }) {
  const auth = await getAuthContext(request);
  throw redirect(auth ? "/patients" : "/login");
}

export default function IndexRoute() {
  return null;
}

