import {
  ContactInvalidReason,
  ContactType,
  ContactValidity,
  Prisma,
} from "@prisma/client";
import "server-only";

import { prisma } from "@/lib/prisma";
import { canonicalPhone } from "@/lib/phone-normalizer";

type ContactInput = {
  companyId: string;
  type: ContactType;
  value: string;
  isPrimary: boolean;
  isWhatsapp: boolean;
  responsibleName?: string;
  role?: string;
  source?: string;
  validity: ContactValidity;
  notes?: string;
};

const snapshotSelect = {
  id: true,
  companyId: true,
  type: true,
  value: true,
  canonicalValue: true,
  source: true,
  isPrimary: true,
  isWhatsapp: true,
  validity: true,
  invalidReason: true,
  archivedAt: true,
  responsibleName: true,
  role: true,
  notes: true,
} satisfies Prisma.CompanyContactSelect;

type ContactSnapshot = Prisma.CompanyContactGetPayload<{
  select: typeof snapshotSelect;
}>;

function isPhoneType(type: ContactType) {
  return type === ContactType.PHONE || type === ContactType.WHATSAPP;
}

function categoryTypes(type: ContactType): ContactType[] {
  return isPhoneType(type)
    ? [ContactType.PHONE, ContactType.WHATSAPP]
    : [type];
}

function canonicalContactValue(type: ContactType, value: string) {
  const trimmed = value.trim();
  if (isPhoneType(type)) {
    return canonicalPhone(trimmed);
  }
  if (type === ContactType.EMAIL) {
    const normalized = trimmed.toLowerCase();
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)
      ? normalized
      : null;
  }
  return trimmed.toLocaleLowerCase("pt-BR");
}

function eventState(contact: ContactSnapshot): Prisma.InputJsonObject {
  return {
    type: contact.type,
    value: contact.value,
    canonicalValue: contact.canonicalValue,
    source: contact.source,
    isPrimary: contact.isPrimary,
    isWhatsapp: contact.isWhatsapp,
    validity: contact.validity,
    invalidReason: contact.invalidReason,
    archivedAt: contact.archivedAt?.toISOString() ?? null,
    responsibleName: contact.responsibleName,
    role: contact.role,
    notes: contact.notes,
  };
}

async function clearOtherPrimaryContacts(
  tx: Prisma.TransactionClient,
  contact: Pick<ContactSnapshot, "id" | "companyId" | "type">,
  userId: string
) {
  const others = await tx.companyContact.findMany({
    where: {
      id: { not: contact.id },
      companyId: contact.companyId,
      type: { in: categoryTypes(contact.type) },
      isPrimary: true,
      archivedAt: null,
    },
    select: snapshotSelect,
  });
  if (others.length === 0) return;

  await tx.companyContact.updateMany({
    where: { id: { in: others.map((item) => item.id) } },
    data: { isPrimary: false },
  });
  await tx.companyContactEvent.createMany({
    data: others.map((item) => ({
      contactId: item.id,
      companyId: item.companyId,
      userId,
      type: "PRIMARY_CHANGED" as const,
      previousState: eventState(item),
      nextState: { ...eventState(item), isPrimary: false },
    })),
  });
}

export class CompanyContactService {
  static canonicalValue(type: ContactType, value: string) {
    return canonicalContactValue(type, value);
  }

  static async create(input: ContactInput & { userId: string }) {
    const canonicalValue = canonicalContactValue(input.type, input.value);
    if (!canonicalValue) throw new Error("INVALID_CONTACT_VALUE");

    return prisma.$transaction(async (tx) => {
      const company = await tx.company.findUnique({
        where: { id: input.companyId },
        select: { id: true },
      });
      if (!company) throw new Error("COMPANY_NOT_FOUND");

      const duplicate = await tx.companyContact.findFirst({
        where: {
          companyId: input.companyId,
          type: { in: categoryTypes(input.type) },
          canonicalValue,
          archivedAt: null,
        },
        select: { id: true },
      });
      if (duplicate) throw new Error("DUPLICATE_CONTACT");

      const contact = await tx.companyContact.create({
        data: {
          companyId: input.companyId,
          type: input.type,
          value: input.value.trim(),
          originalValue: input.value,
          canonicalValue,
          isPrimary: false,
          isWhatsapp: input.isWhatsapp || input.type === ContactType.WHATSAPP,
          responsibleName: input.responsibleName,
          role: input.role,
          source: input.source,
          validity: input.validity,
          validatedAt:
            input.validity === ContactValidity.UNKNOWN ? null : new Date(),
          notes: input.notes,
          createdByUserId: input.userId,
        },
        select: snapshotSelect,
      });

      if (input.isPrimary) {
        await clearOtherPrimaryContacts(tx, contact, input.userId);
      }
      const finalContact = input.isPrimary
        ? await tx.companyContact.update({
            where: { id: contact.id },
            data: { isPrimary: true },
            select: snapshotSelect,
          })
        : contact;

      await tx.companyContactEvent.create({
        data: {
          contactId: finalContact.id,
          companyId: finalContact.companyId,
          userId: input.userId,
          type: "CREATED",
          nextState: eventState(finalContact),
        },
      });
      return finalContact;
    });
  }

  static async update(
    contactId: string,
    input: Pick<
      ContactInput,
      "value" | "responsibleName" | "role" | "notes" | "isWhatsapp"
    > & { userId: string }
  ) {
    return prisma.$transaction(async (tx) => {
      const previous = await tx.companyContact.findUnique({
        where: { id: contactId },
        select: snapshotSelect,
      });
      if (!previous || previous.archivedAt) throw new Error("CONTACT_NOT_FOUND");
      const canonicalValue = canonicalContactValue(previous.type, input.value);
      if (!canonicalValue) throw new Error("INVALID_CONTACT_VALUE");

      const duplicate = await tx.companyContact.findFirst({
        where: {
          id: { not: previous.id },
          companyId: previous.companyId,
          type: { in: categoryTypes(previous.type) },
          canonicalValue,
          archivedAt: null,
        },
        select: { id: true },
      });
      if (duplicate) throw new Error("DUPLICATE_CONTACT");

      const updated = await tx.companyContact.update({
        where: { id: previous.id },
        data: {
          value: input.value.trim(),
          canonicalValue,
          responsibleName: input.responsibleName,
          role: input.role,
          notes: input.notes,
          isWhatsapp: input.isWhatsapp,
        },
        select: snapshotSelect,
      });
      await tx.companyContactEvent.create({
        data: {
          contactId: updated.id,
          companyId: updated.companyId,
          userId: input.userId,
          type: "UPDATED",
          previousState: eventState(previous),
          nextState: eventState(updated),
        },
      });
      return updated;
    });
  }

  static async applyIntent({
    contactId,
    userId,
    intent,
    reason,
  }: {
    contactId: string;
    userId: string;
    intent:
      | "valid"
      | "primary"
      | "whatsapp"
      | "not_whatsapp"
      | "invalid_wrong"
      | "invalid_nonexistent"
      | "invalid_email"
      | "invalid_other"
      | "archive"
      | "restore";
    reason?: string;
  }) {
    return prisma.$transaction(async (tx) => {
      const previous = await tx.companyContact.findUnique({
        where: { id: contactId },
        select: snapshotSelect,
      });
      if (!previous) throw new Error("CONTACT_NOT_FOUND");

      if (intent === "primary") {
        if (previous.archivedAt || previous.validity === ContactValidity.INVALID) {
          throw new Error("CONTACT_NOT_USABLE");
        }
        await clearOtherPrimaryContacts(tx, previous, userId);
      }

      const invalidReason: ContactInvalidReason | null =
        intent === "invalid_wrong"
          ? ContactInvalidReason.WRONG_NUMBER
          : intent === "invalid_nonexistent"
            ? ContactInvalidReason.NONEXISTENT
          : intent === "invalid_email"
              ? ContactInvalidReason.INVALID_EMAIL
            : intent === "invalid_other"
              ? ContactInvalidReason.OTHER
            : null;
      const now = new Date();
      const data: Prisma.CompanyContactUpdateInput =
        intent === "valid"
          ? {
              validity: ContactValidity.VALID,
              validatedAt: now,
              invalidReason: null,
              invalidatedAt: null,
              invalidatedByUser: { disconnect: true },
            }
          : intent === "primary"
            ? {
                isPrimary: true,
                validity: ContactValidity.VALID,
                validatedAt: now,
                invalidReason: null,
                invalidatedAt: null,
                invalidatedByUser: { disconnect: true },
              }
            : invalidReason
              ? {
                  validity: ContactValidity.INVALID,
                  validatedAt: now,
                  invalidReason,
                  invalidatedAt: now,
                  invalidatedByUser: { connect: { id: userId } },
                  isPrimary: false,
                }
              : intent === "archive"
                ? {
                    archivedAt: now,
                    archivedByUser: { connect: { id: userId } },
                    isPrimary: false,
                  }
                : intent === "restore"
                  ? {
                      archivedAt: null,
                      archivedByUser: { disconnect: true },
                    }
                  : { isWhatsapp: intent === "whatsapp" };

      const updated = await tx.companyContact.update({
        where: { id: previous.id },
        data,
        select: snapshotSelect,
      });
      const eventType = invalidReason
        ? "INVALIDATED"
        : intent === "archive"
          ? "ARCHIVED"
          : intent === "restore"
            ? "RESTORED"
            : intent === "primary"
              ? "PRIMARY_CHANGED"
              : intent === "valid"
                ? "VALIDATED"
                : "UPDATED";
      await tx.companyContactEvent.create({
        data: {
          contactId: updated.id,
          companyId: updated.companyId,
          userId,
          type: eventType,
          reason,
          previousState: eventState(previous),
          nextState: eventState(updated),
        },
      });

      const usablePhones = isPhoneType(updated.type)
        ? await tx.companyContact.count({
            where: {
              companyId: updated.companyId,
              type: { in: [ContactType.PHONE, ContactType.WHATSAPP] },
              archivedAt: null,
              validity: { not: ContactValidity.INVALID },
            },
          })
        : null;
      return { contact: updated, suggestContactUpdate: usablePhones === 0 };
    });
  }
}
