import { randomUUID } from "node:crypto";

import { prisma } from "~/lib/prisma.server";
import {
  DEFAULT_UI_TIME_ZONE,
  normalizeTimeZone,
} from "~/lib/utils";

const INSTANCE_EXPORT_NAMESPACE_PROPERTY = "instance.exportNamespace";
const PATIENT_PERSONAL_DATA_BLUR_PROPERTY = "privacy.blurPatientPersonalData";
const PATIENT_PERSONAL_DATA_VISIBLE_COOKIE = "privacyPatientPersonalDataVisible";
const UI_TIME_ZONE_PROPERTY = "ui.timeZone";

function createInstanceExportNamespace() {
  return randomUUID().replace(/-/g, "").slice(0, 12);
}

export async function getOrCreateInstanceExportNamespace() {
  const existing = await prisma.generalSetting.findUnique({
    where: {
      property: INSTANCE_EXPORT_NAMESPACE_PROPERTY,
    },
  });

  if (existing?.value.trim()) {
    return existing.value.trim();
  }

  const created = await prisma.generalSetting.upsert({
    where: {
      property: INSTANCE_EXPORT_NAMESPACE_PROPERTY,
    },
    create: {
      property: INSTANCE_EXPORT_NAMESPACE_PROPERTY,
      value: createInstanceExportNamespace(),
    },
    update: existing?.value.trim()
      ? {}
      : {
          value: createInstanceExportNamespace(),
        },
  });

  return created.value.trim();
}

export async function getUiTimeZone() {
  const setting = await prisma.generalSetting.findUnique({
    where: {
      property: UI_TIME_ZONE_PROPERTY,
    },
  });

  return normalizeTimeZone(setting?.value ?? DEFAULT_UI_TIME_ZONE);
}

export async function setUiTimeZone(value: string) {
  const normalizedValue = normalizeTimeZone(value);

  const setting = await prisma.generalSetting.upsert({
    where: {
      property: UI_TIME_ZONE_PROPERTY,
    },
    create: {
      property: UI_TIME_ZONE_PROPERTY,
      value: normalizedValue,
    },
    update: {
      value: normalizedValue,
    },
  });

  return normalizeTimeZone(setting.value);
}

export async function getBlurPatientPersonalData() {
  const setting = await prisma.generalSetting.findUnique({
    where: {
      property: PATIENT_PERSONAL_DATA_BLUR_PROPERTY,
    },
  });

  return setting?.value === "true";
}

export async function setBlurPatientPersonalData(value: boolean) {
  const setting = await prisma.generalSetting.upsert({
    where: {
      property: PATIENT_PERSONAL_DATA_BLUR_PROPERTY,
    },
    create: {
      property: PATIENT_PERSONAL_DATA_BLUR_PROPERTY,
      value: String(value),
    },
    update: {
      value: String(value),
    },
  });

  return setting.value === "true";
}

function cookieValue(request: Request, name: string) {
  const cookie = request.headers.get("Cookie") ?? "";
  const parts = cookie.split(";").map((part) => part.trim());
  const match = parts.find((part) => part.startsWith(`${name}=`));

  return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
}

function serializeCookie(name: string, value: string) {
  return `${name}=${encodeURIComponent(value)}; Path=/; SameSite=Lax`;
}

export async function getPatientPersonalDataPrivacy(request: Request) {
  const enabled = await getBlurPatientPersonalData();
  const visible = cookieValue(request, PATIENT_PERSONAL_DATA_VISIBLE_COOKIE) === "true";

  return {
    enabled,
    shouldBlur: enabled && !visible,
    visible: enabled && visible,
  };
}

export function setPatientPersonalDataVisibleCookie(value: boolean) {
  return serializeCookie(PATIENT_PERSONAL_DATA_VISIBLE_COOKIE, String(value));
}
