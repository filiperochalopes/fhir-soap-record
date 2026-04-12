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

  if (!params.id) {
    return fhirJson(operationOutcome("error", "not-found", "Composition not found"), 404);
  }

  const resource = await getFhirStore().getRelatedResource("Composition", params.id);
  if (!resource) {
    return fhirJson(operationOutcome("error", "not-found", "Composition not found"), 404);
  }

  return fhirJson(resource);
}
