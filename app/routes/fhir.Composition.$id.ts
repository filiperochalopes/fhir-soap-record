import { requireApiUser } from "~/lib/auth.server";
import { operationOutcome } from "~/lib/fhir/bundle";
import { fhirJson } from "~/lib/fhir/capability";
import { parseCompositionFhirId } from "~/lib/fhir/ids";
import { toFhirNarrativeComposition } from "~/lib/fhir/narrative";
import { toFhirComposition } from "~/lib/fhir/soap";
import { getNarrativeNoteById } from "~/lib/narrative-notes.server";
import { getSoapNoteById } from "~/lib/soap-notes.server";

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

  const parsedId = parseCompositionFhirId(params.id);
  if (!parsedId) {
    return fhirJson(operationOutcome("error", "not-found", "Composition not found"), 404);
  }

  if (parsedId.kind === "soap") {
    const note = await getSoapNoteById(parsedId.noteId);
    if (!note) {
      return fhirJson(operationOutcome("error", "not-found", "Composition not found"), 404);
    }

    return fhirJson(toFhirComposition(note));
  }

  const note = await getNarrativeNoteById(parsedId.noteId);
  if (!note) {
    return fhirJson(operationOutcome("error", "not-found", "Composition not found"), 404);
  }

  return fhirJson(toFhirNarrativeComposition(note));
}
