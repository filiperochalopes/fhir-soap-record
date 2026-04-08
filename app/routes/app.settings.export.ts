import { writeAuditLog } from "~/lib/audit.server";
import { requireUserSession } from "~/lib/auth.server";
import { buildFullInstanceExportBundle } from "~/lib/export.server";
import { prisma } from "~/lib/prisma.server";

export async function loader({ request }: { request: Request }) {
  const auth = await requireUserSession(request);
  const { bundle, fileName, summary } = await buildFullInstanceExportBundle();

  await writeAuditLog(prisma, {
    action: "export.instance.downloaded",
    category: "export",
    entityType: "ExportBundle",
    metadata: summary,
    userId: auth.user.id,
  });

  return new Response(`${JSON.stringify(bundle, null, 2)}\n`, {
    headers: {
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Content-Type": "application/fhir+json; charset=utf-8",
    },
  });
}
