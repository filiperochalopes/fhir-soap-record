import { requireApiUser } from "~/lib/auth.server";
import { toSearchBundle } from "~/lib/fhir/bundle";
import { fhirJson } from "~/lib/fhir/capability";
import { getFhirStore } from "~/lib/fhir/store.server";

export async function loader({ request }: { request: Request }) {
  await requireApiUser(request);

  const url = new URL(request.url);
  const patient = url.searchParams.get("patient");
  const resources = await getFhirStore().searchRelatedResources({
    patient,
    resourceType: "Composition",
  });

  return fhirJson(
    toSearchBundle(
      "Composition",
      resources,
      url.origin,
    ),
  );
}
