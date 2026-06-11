import { requireApiUser } from "~/lib/auth.server";
import { getFhirAttachments } from "~/lib/attachments.server";
import { operationOutcome, toSearchBundle } from "~/lib/fhir/bundle";
import { fhirJson } from "~/lib/fhir/capability";
import { toFhirDocumentReference } from "~/lib/fhir/document-reference";

function normalizeNumericId(id: string | null) {
  if (!id) {
    return null;
  }

  const value = id.includes("/") ? id.split("/").pop() : id;
  const numericId = Number(value);
  return Number.isInteger(numericId) && numericId > 0 ? numericId : null;
}

export async function loader({ request }: { request: Request }) {
  await requireApiUser(request);

  const url = new URL(request.url);
  const patientParam = url.searchParams.get("patient");
  const patientId = normalizeNumericId(patientParam);
  if (patientParam && !patientId) {
    return fhirJson(
      operationOutcome("error", "invalid", "Invalid patient search parameter."),
      400,
    );
  }

  const resources = (await getFhirAttachments(patientId)).map((attachment) =>
    toFhirDocumentReference(attachment, url.origin),
  );

  return fhirJson(toSearchBundle("DocumentReference", resources, url.origin));
}
