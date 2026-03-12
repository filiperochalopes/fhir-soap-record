import { requireApiUser } from "~/lib/auth.server";
import { operationOutcome } from "~/lib/fhir/bundle";
import { fhirJson } from "~/lib/fhir/capability";
import { importFhirBundle } from "~/lib/import.server";
import { prisma } from "~/lib/prisma.server";
import { bundleSchema } from "~/lib/validation/import";

export async function loader() {
  return fhirJson(
    operationOutcome(
      "information",
      "informational",
      "POST a Bundle to this endpoint to import external FHIR payloads.",
    ),
  );
}

export async function action({ request }: { request: Request }) {
  const auth = await requireApiUser(request);

  try {
    const bundle = bundleSchema.parse(await request.json());
    const actor = await prisma.authUser.findUniqueOrThrow({
      where: { id: auth.user.id },
    });
    const summary = await importFhirBundle(bundle, actor);

    return fhirJson(
      operationOutcome(
        "information",
        "informational",
        "Bundle processed",
        `processed=${summary.processed} created=${summary.created} updated=${summary.updated} skipped=${summary.skipped} errors=${summary.errors.length}`,
      ),
    );
  } catch (error) {
    return fhirJson(
      operationOutcome(
        "error",
        "invalid",
        "Bundle import failed",
        error instanceof Error ? error.message : "Invalid bundle payload",
      ),
      400,
    );
  }
}
