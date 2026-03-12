import { Prisma, PrismaClient } from "@prisma/client";

type AuditClient = PrismaClient | Prisma.TransactionClient;

export type AuditLogInput = {
  action: string;
  category: string;
  entityId?: string | null;
  entityType?: string | null;
  metadata?: Prisma.InputJsonValue;
  userId?: number | null;
};

export async function writeAuditLog(db: AuditClient, input: AuditLogInput) {
  await db.auditLog.create({
    data: {
      action: input.action,
      category: input.category,
      entityId: input.entityId ?? null,
      entityType: input.entityType ?? null,
      metadata: input.metadata,
      userId: input.userId ?? null,
    },
  });
}

