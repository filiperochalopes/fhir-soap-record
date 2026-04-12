import { fhirAppErrorCoding, type FhirAppErrorCode } from "~/lib/fhir/errors";

type SearchBundleResource = {
  id: number | string;
  resourceType?: string;
};

function bundleEntry(
  resource: SearchBundleResource,
  defaultResourceType: string,
  fullUrlBase: string,
  mode: "include" | "match",
) {
  const resolvedResourceType =
    typeof resource.resourceType === "string" ? resource.resourceType : defaultResourceType;

  return {
    fullUrl: `${fullUrlBase}/${resolvedResourceType}/${resource.id}`,
    resource,
    search: {
      mode,
    },
  };
}

export function toSearchBundle(
  resourceType: string,
  resources: SearchBundleResource[],
  fullUrlBase: string,
  includedResources: SearchBundleResource[] = [],
) {
  const entries = [
    ...resources.map((resource) => bundleEntry(resource, resourceType, fullUrlBase, "match")),
    ...includedResources.map((resource) =>
      bundleEntry(
        resource,
        typeof resource.resourceType === "string" ? resource.resourceType : resourceType,
        fullUrlBase,
        "include",
      ),
    ),
  ];
  const seen = new Set<string>();

  return {
    resourceType: "Bundle",
    type: "searchset",
    total: resources.length,
    entry: entries.filter((entry) => {
      const key = `${entry.resource.resourceType ?? resourceType}/${entry.resource.id}`;
      if (seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    }),
  };
}

export function operationOutcome(
  severity: "error" | "information",
  code: string,
  details: string,
  diagnostics?: string,
  options?: {
    appCode?: FhirAppErrorCode;
    expression?: string[];
  },
) {
  return {
    resourceType: "OperationOutcome",
    issue: [
      {
        severity,
        code,
        details: {
          ...(options?.appCode
            ? {
                coding: [fhirAppErrorCoding(options.appCode)],
              }
            : {}),
          text: details,
        },
        ...(options?.expression?.length ? { expression: options.expression } : {}),
        ...(diagnostics ? { diagnostics } : {}),
      },
    ],
  };
}
