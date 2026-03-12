import { requireApiUser } from "~/lib/auth.server";
import { capabilityStatement, fhirJson } from "~/lib/fhir/capability";

export async function loader({ request }: { request: Request }) {
  await requireApiUser(request);
  const url = new URL(request.url);
  return fhirJson(capabilityStatement(url.origin));
}

