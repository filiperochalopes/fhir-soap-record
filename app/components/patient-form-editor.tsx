import { useState } from "react";

type PairItem = {
  left: string;
  right: string;
};

type ContactItem = {
  name: string;
  relationship: string;
};

export type PatientFormValues = {
  birthDate: string;
  contacts: ContactItem[];
  gender: string;
  identifiers: PairItem[];
  name: string;
  telecom: PairItem[];
};

function PairRows(props: {
  addLabel: string;
  items: PairItem[];
  labels: { left: string; right: string };
  names: { left: string; right: string };
  onChange: (next: PairItem[]) => void;
}) {
  return (
    <div className="space-y-3">
      {props.items.map((item, index) => (
        <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]" key={`${props.names.left}-${index}`}>
          <input
            aria-label={props.labels.left}
            name={props.names.left}
            placeholder={props.labels.left}
            value={item.left}
            onChange={(event) => {
              const next = [...props.items];
              next[index] = { ...next[index], left: event.target.value };
              props.onChange(next);
            }}
          />
          <input
            aria-label={props.labels.right}
            name={props.names.right}
            placeholder={props.labels.right}
            value={item.right}
            onChange={(event) => {
              const next = [...props.items];
              next[index] = { ...next[index], right: event.target.value };
              props.onChange(next);
            }}
          />
          <button
            className="button-secondary"
            type="button"
            onClick={() => props.onChange(props.items.filter((_, itemIndex) => itemIndex !== index))}
          >
            Remove
          </button>
        </div>
      ))}
      <button
        className="button-secondary"
        type="button"
        onClick={() => props.onChange([...props.items, { left: "", right: "" }])}
      >
        {props.addLabel}
      </button>
    </div>
  );
}

function ContactRows(props: {
  items: ContactItem[];
  onChange: (next: ContactItem[]) => void;
}) {
  return (
    <div className="space-y-3">
      {props.items.map((item, index) => (
        <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]" key={`contact-${index}`}>
          <input
            aria-label="Contact name"
            name="contactName"
            placeholder="Contact name"
            value={item.name}
            onChange={(event) => {
              const next = [...props.items];
              next[index] = { ...next[index], name: event.target.value };
              props.onChange(next);
            }}
          />
          <input
            aria-label="Relationship"
            name="contactRelationship"
            placeholder="Relationship"
            value={item.relationship}
            onChange={(event) => {
              const next = [...props.items];
              next[index] = { ...next[index], relationship: event.target.value };
              props.onChange(next);
            }}
          />
          <button
            className="button-secondary"
            type="button"
            onClick={() => props.onChange(props.items.filter((_, itemIndex) => itemIndex !== index))}
          >
            Remove
          </button>
        </div>
      ))}
      <button
        className="button-secondary"
        type="button"
        onClick={() => props.onChange([...props.items, { name: "", relationship: "" }])}
      >
        Add contact
      </button>
    </div>
  );
}

export function PatientFormEditor(props: { initialValues: PatientFormValues }) {
  const [identifiers, setIdentifiers] = useState<PairItem[]>(
    props.initialValues.identifiers.length ? props.initialValues.identifiers : [{ left: "", right: "" }],
  );
  const [telecom, setTelecom] = useState<PairItem[]>(
    props.initialValues.telecom.length ? props.initialValues.telecom : [{ left: "", right: "" }],
  );
  const [contacts, setContacts] = useState<ContactItem[]>(
    props.initialValues.contacts.length
      ? props.initialValues.contacts
      : [{ name: "", relationship: "" }],
  );

  return (
    <div className="space-y-8">
      <div className="form-grid">
        <label className="block">
          <span className="field-label">Full name</span>
          <input defaultValue={props.initialValues.name} name="name" required />
        </label>
        <label className="block">
          <span className="field-label">Birth date</span>
          <input defaultValue={props.initialValues.birthDate} name="birthDate" required type="date" />
        </label>
        <label className="block md:col-span-2">
          <span className="field-label">Gender</span>
          <select defaultValue={props.initialValues.gender} name="gender">
            <option value="female">Female</option>
            <option value="male">Male</option>
            <option value="other">Other</option>
            <option value="unknown">Unknown</option>
          </select>
        </label>
      </div>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold">Identifiers</h2>
          <p className="text-sm text-[color:var(--muted)]">
            Keep these minimal and workflow-driven.
          </p>
        </div>
        <PairRows
          addLabel="Add identifier"
          items={identifiers}
          labels={{ left: "System", right: "Value" }}
          names={{ left: "identifierSystem", right: "identifierValue" }}
          onChange={setIdentifiers}
        />
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold">Telecom</h2>
          <p className="text-sm text-[color:var(--muted)]">
            Use simple values such as phone or email.
          </p>
        </div>
        <PairRows
          addLabel="Add telecom"
          items={telecom}
          labels={{ left: "System", right: "Value" }}
          names={{ left: "telecomSystem", right: "telecomValue" }}
          onChange={setTelecom}
        />
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold">Contacts</h2>
          <p className="text-sm text-[color:var(--muted)]">
            Keep only the contact person and the relationship.
          </p>
        </div>
        <ContactRows items={contacts} onChange={setContacts} />
      </section>
    </div>
  );
}

