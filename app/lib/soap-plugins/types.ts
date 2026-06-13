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

export abstract class Plugin<TProps> {
  id: string;
  label: string;
  Card: ComponentType<TProps>;

  constructor(input: {
    id: string;
    label: string;
    Card: ComponentType<TProps>;
  }) {
    this.id = input.id;
    this.label = input.label;
    this.Card = input.Card;
  }
}

export class SoapPlugin extends Plugin<SoapPluginCardProps> {}

export type LegacySoapPlugin = {
  id: string;
  label: string;
  Card: ComponentType<SoapPluginCardProps>;
};
