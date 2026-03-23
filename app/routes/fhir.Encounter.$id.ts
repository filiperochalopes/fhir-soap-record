import { requireApiUser } from "~/lib/auth.server";
import { operationOutcome } from "~/lib/fhir/bundle";
import { fhirJson } from "~/lib/fhir/capability";
import { parseSoapEncounterFhirId } from "~/lib/fhir/ids";
import { toFhirEncounter } from "~/lib/fhir/soap";
import { getSoapNoteById } from "~/lib/soap-notes.server";

export async function loader({
  params,
  request,
}: {
  params: { id?: string };
  request: Request;
}) {
  await requireApiUser(request);

  const noteId = params.id ? parseSoapEncounterFhirId(params.id) : null;
  const note = noteId ? await getSoapNoteById(noteId) : null;
  if (!note) {
    return fhirJson(operationOutcome("error", "not-found", "Encounter not found"), 404);
  }

  return fhirJson(toFhirEncounter(note));
}
