export function buildOpenApiSpec(serverUrl = "http://localhost:3000") {
  return {
    openapi: "3.1.0",
    info: {
      title: "FHIR SOAP Record MVP API",
      version: "0.1.0",
      description:
        "Single-runtime clinical MVP with token authentication, proprietary import, and FHIR-oriented endpoints.",
    },
    servers: [{ url: serverUrl }],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "Token",
        },
      },
      schemas: {
        ImportSummary: {
          type: "object",
          properties: {
            processed: { type: "integer", example: 4 },
            created: { type: "integer", example: 3 },
            updated: { type: "integer", example: 1 },
            skipped: { type: "integer", example: 0 },
            errors: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  item: { type: "string" },
                  message: { type: "string" },
                },
              },
            },
          },
        },
        ProprietaryImportPayload: {
          type: "object",
          required: ["sourceSystem", "patients"],
          properties: {
            sourceSystem: { type: "string", example: "legacy-office-system" },
            patients: {
              type: "array",
              items: {
                type: "object",
                required: ["name", "gender", "birthDate", "soapNotes"],
                properties: {
                  externalId: { type: "string", example: "LEG-1001" },
                  name: { type: "string", example: "Maria de Souza" },
                  gender: { type: "string", example: "female" },
                  birthDate: { type: "string", format: "date", example: "1980-09-14" },
                  identifiers: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        system: { type: "string", example: "cpf" },
                        value: { type: "string", example: "11122233344" },
                      },
                    },
                  },
                  telecom: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        system: { type: "string", example: "phone" },
                        value: { type: "string", example: "+55 71 99999-0000" },
                      },
                    },
                  },
                  contacts: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        name: { type: "string", example: "Joao de Souza" },
                        relationship: { type: "string", example: "Brother" },
                      },
                    },
                  },
                  soapNotes: {
                    type: "array",
                    items: {
                      type: "object",
                      required: [
                        "sourceRecordId",
                        "encounteredAt",
                        "subjective",
                        "objective",
                        "assessment",
                        "plan",
                      ],
                      properties: {
                        sourceRecordId: { type: "string", example: "SOAP-993" },
                        encounteredAt: {
                          type: "string",
                          format: "date-time",
                          example: "2026-03-10T14:30:00Z",
                        },
                        subjective: { type: "string", example: "Headache for 2 days." },
                        objective: { type: "string", example: "Afebrile. BP 120/80." },
                        assessment: { type: "string", example: "Tension headache." },
                        plan: { type: "string", example: "Hydration and analgesic guidance." },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    security: [{ bearerAuth: [] }],
    paths: {
      "/fhir/metadata": {
        get: {
          summary: "CapabilityStatement",
          security: [{ bearerAuth: [] }],
          responses: {
            "200": {
              description: "FHIR CapabilityStatement",
              content: {
                "application/fhir+json": {
                  schema: { type: "object" },
                },
              },
            },
          },
        },
      },
      "/fhir/Patient": {
        get: {
          summary: "Search patients",
          parameters: [
            {
              in: "query",
              name: "name",
              schema: { type: "string" },
              required: false,
            },
          ],
          responses: {
            "200": {
              description: "FHIR Patient searchset",
              content: {
                "application/fhir+json": {
                  example: {
                    resourceType: "Bundle",
                    type: "searchset",
                    total: 1,
                    entry: [
                      {
                        fullUrl: `${serverUrl}/fhir/Patient/1`,
                        resource: {
                          resourceType: "Patient",
                          id: "1",
                          name: [{ text: "Maria de Souza" }],
                          gender: "female",
                          birthDate: "1980-09-14",
                        },
                      },
                    ],
                  },
                },
              },
            },
          },
        },
      },
      "/fhir/Patient/{id}": {
        get: {
          summary: "Read patient",
          parameters: [
            {
              in: "path",
              name: "id",
              required: true,
              schema: { type: "string" },
            },
          ],
          responses: {
            "200": {
              description: "FHIR Patient resource",
              content: {
                "application/fhir+json": {
                  schema: { type: "object" },
                },
              },
            },
          },
        },
      },
      "/fhir/Appointment": {
        get: {
          summary: "Search appointments",
          parameters: [
            { in: "query", name: "date", schema: { type: "string", format: "date" } },
            { in: "query", name: "patient", schema: { type: "string" } },
          ],
          responses: {
            "200": {
              description: "FHIR Appointment searchset",
              content: {
                "application/fhir+json": {
                  schema: { type: "object" },
                },
              },
            },
          },
        },
      },
      "/fhir/Appointment/{id}": {
        get: {
          summary: "Read appointment",
          parameters: [
            {
              in: "path",
              name: "id",
              required: true,
              schema: { type: "string" },
            },
          ],
          responses: {
            "200": {
              description: "FHIR Appointment resource",
              content: {
                "application/fhir+json": {
                  schema: { type: "object" },
                },
              },
            },
          },
        },
      },
      "/fhir/Composition": {
        get: {
          summary: "Search SOAP compositions",
          parameters: [
            { in: "query", name: "patient", schema: { type: "string" } },
          ],
          responses: {
            "200": {
              description: "FHIR Composition searchset",
              content: {
                "application/fhir+json": {
                  schema: { type: "object" },
                },
              },
            },
          },
        },
      },
      "/fhir/Composition/{id}": {
        get: {
          summary: "Read SOAP composition",
          parameters: [
            {
              in: "path",
              name: "id",
              required: true,
              schema: { type: "string" },
            },
          ],
          responses: {
            "200": {
              description: "FHIR Composition resource",
              content: {
                "application/fhir+json": {
                  schema: { type: "object" },
                },
              },
            },
          },
        },
      },
      "/fhir": {
        post: {
          summary: "Import Bundle payloads",
          requestBody: {
            required: true,
            content: {
              "application/fhir+json": {
                example: {
                  resourceType: "Bundle",
                  type: "transaction",
                  entry: [
                    {
                      fullUrl: "urn:uuid:patient-1",
                      resource: {
                        resourceType: "Patient",
                        id: "external-patient-1",
                        name: [{ text: "Maria de Souza" }],
                        gender: "female",
                        birthDate: "1980-09-14",
                      },
                    },
                    {
                      resource: {
                        resourceType: "Composition",
                        id: "soap-1",
                        subject: { reference: "urn:uuid:patient-1" },
                        date: "2026-03-10T14:30:00Z",
                        section: [
                          {
                            title: "Subjective",
                            text: { status: "generated", div: "<div><p>Headache for 2 days.</p></div>" },
                          },
                          {
                            title: "Objective",
                            text: { status: "generated", div: "<div><p>Afebrile. BP 120/80.</p></div>" },
                          },
                          {
                            title: "Assessment",
                            text: { status: "generated", div: "<div><p>Tension headache.</p></div>" },
                          },
                          {
                            title: "Plan",
                            text: { status: "generated", div: "<div><p>Hydration and analgesic guidance.</p></div>" },
                          },
                        ],
                      },
                    },
                  ],
                },
              },
            },
          },
          responses: {
            "200": {
              description: "FHIR OperationOutcome with import summary",
              content: {
                "application/fhir+json": {
                  schema: { type: "object" },
                },
              },
            },
          },
        },
      },
      "/api/import": {
        post: {
          summary: "Import proprietary clinical JSON",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ProprietaryImportPayload" },
              },
            },
          },
          responses: {
            "200": {
              description: "Import summary",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ImportSummary" },
                },
              },
            },
          },
        },
      },
    },
  };
}
