#!/usr/bin/env node
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

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

type CreateUserInput = {
  crm?: string;
  crmUf?: string;
  fullName?: string;
};

type PromptValidator = {
  safeParse: (
    value: unknown,
  ) =>
    | { success: true; data: string }
    | { success: false; error: { issues: Array<{ message: string }> } };
};

function hasValue(value: string | undefined) {
  return value !== undefined && value.trim().length > 0;
}

async function promptForMissingFields(
  initialInput: CreateUserInput,
  validators: {
    crm: PromptValidator;
    crmUf: PromptValidator;
    fullName: PromptValidator;
  },
) {
  const missingFields = Object.entries(initialInput)
    .filter(([, value]) => !hasValue(value))
    .map(([key]) => key);

  if (missingFields.length === 0) {
    return initialInput;
  }

  if (!input.isTTY || !output.isTTY) {
    throw new Error(
      "Missing required arguments. Run in an interactive terminal or pass --fullName, --crm and --crmUf.",
    );
  }

  const terminal = createInterface({ input, output });
  const values = { ...initialInput };

  try {
    console.log("");
    console.log("Enter the clinical user details:");

    while (!hasValue(values.fullName)) {
      const answer = await terminal.question("Full name: ");
      const parsed = validators.fullName.safeParse(answer);

      if (parsed.success) {
        values.fullName = parsed.data;
        break;
      }

      console.log(parsed.error.issues[0]?.message ?? "Full name is invalid");
    }

    while (!hasValue(values.crm)) {
      const answer = await terminal.question("CRM: ");
      const parsed = validators.crm.safeParse(answer);

      if (parsed.success) {
        values.crm = parsed.data;
        break;
      }

      console.log(parsed.error.issues[0]?.message ?? "CRM is invalid");
    }

    while (!hasValue(values.crmUf)) {
      const answer = await terminal.question("CRM UF: ");
      const parsed = validators.crmUf.safeParse(answer);

      if (parsed.success) {
        values.crmUf = parsed.data;
        break;
      }

      console.log(parsed.error.issues[0]?.message ?? "CRM UF is invalid");
    }

    console.log("");

    return values;
  } finally {
    terminal.close();
  }
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

  const input = await promptForMissingFields(
    {
      crm: readArg("--crm"),
      crmUf: readArg("--crmUf"),
      fullName: readArg("--fullName"),
    },
    authUserCliSchema.shape,
  );

  const parsed = authUserCliSchema.parse({
    crm: input.crm,
    crmUf: input.crmUf,
    fullName: input.fullName,
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
