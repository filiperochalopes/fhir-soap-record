import { AppShell } from "~/components/app-shell";
import { requireUserSession } from "~/lib/auth.server";

export async function loader({ request }: { request: Request }) {
  const auth = await requireUserSession(request);
  return { user: auth.user };
}

export default function AppLayoutRoute() {
  return <AppShell />;
}

