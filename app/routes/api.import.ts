import { requireApiUser } from "~/lib/auth.server";
import { importProprietaryPayload } from "~/lib/import.server";
import { prisma } from "~/lib/prisma.server";
import { proprietaryImportSchema } from "~/lib/validation/import";

export async function loader() {
  return new Response("Method not allowed", { status: 405 });
}

export async function action({ request }: { request: Request }) {
  const auth = await requireApiUser(request);

  try {
    const payload = proprietaryImportSchema.parse(await request.json());
    const actor = await prisma.authUser.findUniqueOrThrow({
      where: { id: auth.user.id },
    });

    const summary = await importProprietaryPayload(payload, actor);
    return new Response(JSON.stringify(summary, null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
      },
    });
  } catch (error) {
    return new Response(
      JSON.stringify(
        {
          error: error instanceof Error ? error.message : "Invalid import payload",
        },
        null,
        2,
      ),
      {
        status: 400,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
        },
      },
    );
  }
}

