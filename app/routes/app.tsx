import { AppShell } from "~/components/app-shell";
import { requireUserSession } from "~/lib/auth.server";
import { getPatientPersonalDataPrivacy } from "~/lib/settings.server";

export async function loader({ request }: { request: Request }) {
  const auth = await requireUserSession(request);
  const patientPersonalDataPrivacy = await getPatientPersonalDataPrivacy(request);
  return { patientPersonalDataPrivacy, user: auth.user };
}

export default function AppLayoutRoute() {
  return <AppShell />;
}
