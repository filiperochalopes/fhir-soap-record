import { buildOpenApiSpec } from "~/lib/openapi/spec";

export async function loader({ request }: { request: Request }) {
  const url = new URL(request.url);

  return new Response(JSON.stringify(buildOpenApiSpec(url.origin), null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}

