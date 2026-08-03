import type { ContactType } from "@prisma/client";

import { normalizeBrazilianPhone } from "../../../lib/phone-normalizer";

export type BackfillCompany = {
  id: string;
  phone: string | null;
  email: string | null;
};

export type BackfillContact = {
  id: string;
  type: ContactType;
  value: string;
  originalValue: string | null;
  canonicalValue: string | null;
  isPrimary: boolean;
  archivedAt: Date | null;
};

export type ContactBackfillPlan = {
  creates: Array<{
    companyId: string;
    type: "PHONE" | "EMAIL";
    value: string;
    originalValue: string;
    canonicalValue: string;
    isPrimary: boolean;
  }>;
  updates: Array<{
    contactId: string;
    originalValue: string;
    canonicalValue: string;
  }>;
  ambiguities: Array<{ companyId: string; contactId?: string; field: string }>;
};

function canonicalEmail(value: string | null | undefined) {
  const email = String(value ?? "").trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

export function planCompanyContactBackfill(
  company: BackfillCompany,
  contacts: BackfillContact[]
): ContactBackfillPlan {
  const plan: ContactBackfillPlan = {
    creates: [],
    updates: [],
    ambiguities: [],
  };
  const activeContacts = contacts.filter((contact) => !contact.archivedAt);
  const canonicalPhones = new Set(
    activeContacts
      .filter(
        (contact) =>
          ["PHONE", "WHATSAPP"].includes(contact.type) &&
          contact.canonicalValue
      )
      .map((contact) => contact.canonicalValue as string)
  );
  const canonicalEmails = new Set(
    activeContacts
      .filter((contact) => contact.type === "EMAIL" && contact.canonicalValue)
      .map((contact) => contact.canonicalValue as string)
  );

  for (const contact of activeContacts) {
    if (contact.canonicalValue) continue;
    if (["PHONE", "WHATSAPP"].includes(contact.type)) {
      const normalized = normalizeBrazilianPhone(
        contact.originalValue || contact.value
      );
      if (normalized.ambiguous || normalized.candidates.length !== 1) {
        plan.ambiguities.push({
          companyId: company.id,
          contactId: contact.id,
          field: "contact-phone",
        });
        continue;
      }
      const canonicalValue = normalized.candidates[0].canonical;
      if (canonicalPhones.has(canonicalValue)) continue;
      canonicalPhones.add(canonicalValue);
      plan.updates.push({
        contactId: contact.id,
        originalValue: contact.originalValue || contact.value,
        canonicalValue,
      });
    } else if (contact.type === "EMAIL") {
      const canonicalValue = canonicalEmail(contact.originalValue || contact.value);
      if (!canonicalValue) {
        plan.ambiguities.push({
          companyId: company.id,
          contactId: contact.id,
          field: "contact-email",
        });
        continue;
      }
      if (canonicalEmails.has(canonicalValue)) continue;
      canonicalEmails.add(canonicalValue);
      plan.updates.push({
        contactId: contact.id,
        originalValue: contact.originalValue || contact.value,
        canonicalValue,
      });
    }
  }

  const normalizedCompanyPhone = normalizeBrazilianPhone(company.phone);
  if (normalizedCompanyPhone.ambiguous) {
    plan.ambiguities.push({ companyId: company.id, field: "company-phone" });
  } else {
    const hasPrimaryPhone = activeContacts.some(
      (contact) =>
        ["PHONE", "WHATSAPP"].includes(contact.type) && contact.isPrimary
    );
    normalizedCompanyPhone.candidates.forEach((candidate, index) => {
      if (canonicalPhones.has(candidate.canonical)) return;
      canonicalPhones.add(candidate.canonical);
      plan.creates.push({
        companyId: company.id,
        type: "PHONE",
        value: candidate.display,
        originalValue: normalizedCompanyPhone.original,
        canonicalValue: candidate.canonical,
        isPrimary: !hasPrimaryPhone && index === 0,
      });
    });
  }

  const companyEmail = canonicalEmail(company.email);
  if (company.email && !companyEmail) {
    plan.ambiguities.push({ companyId: company.id, field: "company-email" });
  } else if (companyEmail && !canonicalEmails.has(companyEmail)) {
    const hasPrimaryEmail = activeContacts.some(
      (contact) => contact.type === "EMAIL" && contact.isPrimary
    );
    plan.creates.push({
      companyId: company.id,
      type: "EMAIL",
      value: company.email!.trim(),
      originalValue: company.email!,
      canonicalValue: companyEmail,
      isPrimary: !hasPrimaryEmail,
    });
  }

  return plan;
}
