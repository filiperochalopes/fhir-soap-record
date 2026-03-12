import "swagger-ui-react/swagger-ui.css";
import SwaggerUI from "swagger-ui-react";
import { useLoaderData } from "react-router";

import { buildOpenApiSpec } from "~/lib/openapi/spec";

export async function loader({ request }: { request: Request }) {
  return {
    origin: new URL(request.url).origin,
  };
}

export default function DocsRoute() {
  const { origin } = useLoaderData<typeof loader>();

  return (
    <main className="min-h-screen bg-white">
      <SwaggerUI spec={buildOpenApiSpec(origin)} />
    </main>
  );
}
