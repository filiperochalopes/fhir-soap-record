import { requireApiUser } from "~/lib/auth.server";
import { operationOutcome } from "~/lib/fhir/bundle";
import { fhirJson } from "~/lib/fhir/capability";
import { toFhirCondition } from "~/lib/fhir/soap";
import { getSoapNoteById } from "~/lib/soap-notes.server";

export async function loader({
  params,
  request,
}: {
  params: { id?: string };
  request: Request;
}) {
  await requireApiUser(request);

  const note = await getSoapNoteById(Number(params.id));
  if (!note) {
    return fhirJson(operationOutcome("error", "not-found", "Condition not found"), 404);
  }

  return fhirJson(toFhirCondition(note));
}

