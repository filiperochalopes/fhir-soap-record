import { requireApiUser } from "~/lib/auth.server";
import { operationOutcome } from "~/lib/fhir/bundle";
import { fhirJson } from "~/lib/fhir/capability";
import { getFhirStore } from "~/lib/fhir/store.server";

export async function loader({
  params,
  request,
}: {
  params: { id?: string };
  request: Request;
}) {
  await requireApiUser(request);

  const resource = params.id
    ? await getFhirStore().getRelatedResource("Encounter", params.id)
    : null;
  if (!resource) {
    return fhirJson(operationOutcome("error", "not-found", "Encounter not found"), 404);
  }

  return fhirJson(resource);
}
