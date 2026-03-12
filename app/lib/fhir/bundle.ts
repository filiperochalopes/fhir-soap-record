export function toSearchBundle(
  resourceType: string,
  resources: unknown[],
  fullUrlBase: string,
) {
  return {
    resourceType: "Bundle",
    type: "searchset",
    total: resources.length,
    entry: resources.map((resource: any) => ({
      fullUrl: `${fullUrlBase}/${resourceType}/${resource.id}`,
      resource,
    })),
  };
}

export function operationOutcome(
  severity: "error" | "information",
  code: string,
  details: string,
  diagnostics?: string,
) {
  return {
    resourceType: "OperationOutcome",
    issue: [
      {
        severity,
        code,
        details: {
          text: details,
        },
        ...(diagnostics ? { diagnostics } : {}),
      },
    ],
  };
}

