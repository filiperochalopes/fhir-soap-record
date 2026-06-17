import pkg from "@prisma/client";
const { Prisma, PrismaClient } = pkg;

export { Prisma };

type PrismaClientInstance = InstanceType<typeof PrismaClient>;

declare global {
  var __prisma__: PrismaClientInstance | undefined;
}

export const prisma =
  globalThis.__prisma__ ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalThis.__prisma__ = prisma;
}
