#!/usr/bin/env node
try {
  process.loadEnvFile?.();
} catch (error) {
  if (!(error instanceof Error) || !("code" in error) || error.code !== "ENOENT") {
    throw error;
  }
}

function readArg(flag: string) {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      'DATABASE_URL is missing. Create a .env file or export DATABASE_URL before running the CLI.',
    );
  }

  const [{ createUserToken }, { authUserCliSchema }] = await Promise.all([
    import("../app/lib/auth.server"),
    import("../app/lib/validation/auth"),
  ]);

  const parsed = authUserCliSchema.parse({
    crm: readArg("--crm"),
    crmUf: readArg("--crmUf"),
    fullName: readArg("--fullName"),
  });

  const { rawToken, user } = await createUserToken(parsed);

  console.log("");
  console.log("User created");
  console.log(`ID: ${user.id}`);
  console.log(`Name: ${user.fullName}`);
  console.log(`CRM: ${user.crm}/${user.crmUf}`);
  console.log("");
  console.log("Token");
  console.log(rawToken);
  console.log("");
  console.log("Store this token now. It is only shown in plaintext at creation time.");
}

main().catch((error) => {
  console.error(
    error instanceof Error ? error.message : "Could not create auth user and token",
  );
  process.exit(1);
});
