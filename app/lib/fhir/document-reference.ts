import type { AuthUser, ClinicalAttachment, Patient } from "@prisma/client";

export type AttachmentWithRelations = ClinicalAttachment & {
  author: AuthUser;
  patient: Patient;
};

export function toDocumentReferenceFhirId(id: number) {
  return `attachment-${id}`;
}

export function parseDocumentReferenceFhirId(id: string) {
  if (/^\d+$/.test(id)) {
    return Number(id);
  }

  if (!id.startsWith("attachment-")) {
    return null;
  }

  const numericId = Number(id.slice("attachment-".length));
  return Number.isInteger(numericId) && numericId > 0 ? numericId : null;
}

export function toFhirDocumentReference(
  attachment: AttachmentWithRelations,
  baseUrl: string,
) {
  const downloadUrl = `${baseUrl}/attachments/${attachment.id}/download`;
  const hash = Buffer.from(attachment.sha256, "hex").toString("base64");

  return {
    resourceType: "DocumentReference",
    id: toDocumentReferenceFhirId(attachment.id),
    status: "current",
    type: {
      text: attachment.fileName,
    },
    subject: {
      display: attachment.patient.name,
      reference: `Patient/${attachment.patientId}`,
    },
    date: attachment.createdAt.toISOString(),
    author: [
      {
        display: `${attachment.author.fullName} CRM ${attachment.author.crm}/${attachment.author.crmUf}`,
      },
    ],
    content: [
      {
        attachment: {
          contentType: attachment.contentType,
          hash,
          size: attachment.byteSize,
          title: attachment.fileName,
          url: downloadUrl,
        },
      },
    ],
    ...(attachment.soapNoteId
      ? {
          context: {
            encounter: [
              {
                reference: `Encounter/soap-encounter-${attachment.soapNoteId}`,
              },
            ],
          },
        }
      : {}),
  };
}
