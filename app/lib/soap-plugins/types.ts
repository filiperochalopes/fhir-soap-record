import type { ComponentType } from "react";

export type SoapPluginCardProps = {
  patientId: number;
  patient: {
    birthDate: Date | string | null;
    gender: string;
  };
  soapNoteCount: number;
  draftStorageKey: string;
  timeZone: string;
};

export type SoapPlugin = {
  id: string;
  label: string;
  Card: ComponentType<SoapPluginCardProps>;
};
