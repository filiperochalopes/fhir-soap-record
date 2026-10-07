import { useTranslation } from "react-i18next";
import { Form, redirect, useActionData } from "react-router";

import {
  authenticateToken,
  buildAuthCookie,
  getAuthContext,
  recordLoginAudit,
} from "~/lib/auth.server";
import i18n from "~/i18n";
import { loginSchema } from "~/lib/validation/auth";

export async function loader({ request }: { request: Request }) {
  const auth = await getAuthContext(request);
  if (auth) {
    throw redirect("/patients");
  }

  return null;
}

export async function action({ request }: { request: Request }) {
  const formData = await request.formData();
  const parsed = loginSchema.safeParse({
    token: formData.get("token"),
  });

  if (!parsed.success) {
    return {
      error: parsed.error.flatten().fieldErrors.token?.[0] ?? i18n.t("login.tokenRequired"),
    };
  }

  const auth = await authenticateToken(parsed.data.token);
  if (!auth) {
    return {
      error: i18n.t("login.tokenNotRecognized"),
    };
  }

  await recordLoginAudit(auth);

  throw redirect("/patients", {
    headers: {
      "Set-Cookie": buildAuthCookie(parsed.data.token),
    },
  });
}

export default function LoginRoute() {
  const actionData = useActionData<typeof action>();
  const { t } = useTranslation();

  return (
    <main className="mx-auto flex min-h-screen max-w-4xl items-center px-4 py-10 sm:px-6">
      <section className="panel grid w-full overflow-hidden lg:grid-cols-[1.15fr_0.85fr]">
        <div className="bg-[color:var(--accent-soft)] px-8 py-10">
          <p className="text-xs font-semibold uppercase tracking-[0.32em] text-[color:var(--muted)]">
            {t("login.eyebrow")}
          </p>
          <h1 className="mt-4 max-w-md text-4xl font-semibold leading-tight">
            {t("login.heading")}
          </h1>
          <p className="mt-4 max-w-lg text-sm leading-6 text-[color:var(--muted)]">
            {t("login.intro")}
          </p>
        </div>
        <div className="px-8 py-10">
          <h2 className="text-2xl font-semibold">{t("login.signIn")}</h2>
          <p className="mt-2 text-sm text-[color:var(--muted)]">
            {t("login.tokenHelp")}
          </p>
          <Form className="mt-8 space-y-4" method="post">
            <label className="block">
              <span className="field-label">{t("login.accessToken")}</span>
              <textarea
                autoComplete="off"
                className="min-h-36 w-full"
                name="token"
                placeholder={t("login.tokenPlaceholder")}
                required
              />
            </label>
            {actionData?.error ? (
              <p className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200 dark:text-red-100">
                {actionData.error}
              </p>
            ) : null}
            <button className="button-primary w-full" type="submit">
              {t("login.submit")}
            </button>
          </Form>
        </div>
      </section>
    </main>
  );
}
