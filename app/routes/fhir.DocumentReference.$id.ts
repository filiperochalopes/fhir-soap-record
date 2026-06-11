import { requireApiUser } from "~/lib/auth.server";
import { getFhirAttachmentById } from "~/lib/attachments.server";
import { operationOutcome } from "~/lib/fhir/bundle";
import { fhirJson } from "~/lib/fhir/capability";
import {
  parseDocumentReferenceFhirId,
  toFhirDocumentReference,
} from "~/lib/fhir/document-reference";

export async function loader({
  params,
  request,
}: {
  params: { id?: string };
  request: Request;
}) {
  await requireApiUser(request);

  const id = params.id ? parseDocumentReferenceFhirId(params.id) : null;
  const attachment = id ? await getFhirAttachmentById(id) : null;
  if (!attachment) {
    return fhirJson(
      operationOutcome("error", "not-found", "DocumentReference not found"),
      404,
    );
  }

  const url = new URL(request.url);
  return fhirJson(toFhirDocumentReference(attachment, url.origin));
}
