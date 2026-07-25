import bcrypt from "bcryptjs";
import { BusinessStatus, Prisma, RegistrationPaymentMethod, UserRole, UserStatus } from "@prisma/client";
import { prisma } from "@/config/database";
import { AppError } from "@/common/errors";
import { parsePagination } from "@/common/pagination";

interface OwnerInput {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  password: string;
}

interface PaymentInput {
  amount: number; // rupees
  currency?: string;
  paymentMethod?: RegistrationPaymentMethod;
  notes?: string;
}

interface RegisterShopInput {
  owner: OwnerInput;
  business: Record<string, unknown>;
  payment: PaymentInput;
}

const REGISTRATION_INCLUDE = {
  business: { select: { id: true, name: true, slug: true, city: true, state: true, status: true } },
  owner: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
  dealer: { select: { id: true, firstName: true, lastName: true, email: true } },
} satisfies Prisma.ShopRegistrationInclude;

// A dealer registers a shop on behalf of an owner and records the onboarding
// fee they collected. Creates (or reuses) the owner account, the business
// listing, and the registration record atomically.
export async function registerShop(dealerId: string, input: RegisterShopInput) {
  const { owner, business, payment } = input;

  const category = await prisma.category.findUnique({ where: { id: business.categoryId as string } });
  if (!category) throw AppError.badRequest("Invalid categoryId");

  const slugTaken = await prisma.business.findUnique({ where: { slug: business.slug as string } });
  if (slugTaken) throw AppError.conflict("That business URL slug is already taken — choose another");

  // Resolve the owner: reuse an existing customer/owner account by email, or
  // create a fresh business-owner account. Staff accounts can't be targeted.
  const existingOwner = await prisma.user.findUnique({ where: { email: owner.email } });
  if (existingOwner && (existingOwner.role === UserRole.ADMIN || existingOwner.role === UserRole.DEALER)) {
    throw AppError.badRequest("This email belongs to a staff account and can't be registered as a shop owner");
  }

  // Guard phone uniqueness up front for a clean error message.
  if (owner.phone && (!existingOwner || existingOwner.phone !== owner.phone)) {
    const phoneTaken = await prisma.user.findUnique({ where: { phone: owner.phone } });
    if (phoneTaken && phoneTaken.id !== existingOwner?.id) {
      throw AppError.conflict("That phone number is already registered to another account");
    }
  }

  const amountCents = Math.round(payment.amount * 100);

  const result = await prisma.$transaction(async (tx) => {
    let ownerRecord = existingOwner;

    if (ownerRecord) {
      // Promote a plain customer to a business owner; leave existing owners as-is.
      if (ownerRecord.role === UserRole.CUSTOMER) {
        ownerRecord = await tx.user.update({ where: { id: ownerRecord.id }, data: { role: UserRole.BUSINESS_OWNER } });
      }
    } else {
      const passwordHash = await bcrypt.hash(owner.password, 12);
      ownerRecord = await tx.user.create({
        data: {
          email: owner.email,
          phone: owner.phone,
          passwordHash,
          firstName: owner.firstName,
          lastName: owner.lastName,
          role: UserRole.BUSINESS_OWNER,
          status: UserStatus.ACTIVE,
        },
      });
    }

    const createdBusiness = await tx.business.create({
      data: {
        ...(business as any),
        ownerId: ownerRecord.id,
        status: BusinessStatus.PENDING_APPROVAL,
      },
    });

    const registration = await tx.shopRegistration.create({
      data: {
        businessId: createdBusiness.id,
        ownerId: ownerRecord.id,
        dealerId,
        amountCents,
        currency: payment.currency ?? "INR",
        paymentMethod: payment.paymentMethod ?? RegistrationPaymentMethod.CASH,
        notes: payment.notes,
      },
      include: REGISTRATION_INCLUDE,
    });

    return { registration, ownerReused: !!existingOwner };
  });

  return result;
}

// A dealer's own registrations plus a running total of what they've collected.
export async function listMyRegistrations(dealerId: string, query: { page?: number; pageSize?: number; search?: string }) {
  const { page, pageSize, skip, take } = parsePagination(query);
  const where: Prisma.ShopRegistrationWhereInput = { dealerId };
  if (query.search) {
    where.business = { is: { name: { contains: query.search } } };
  }

  const [items, total, agg] = await Promise.all([
    prisma.shopRegistration.findMany({ where, skip, take, orderBy: { createdAt: "desc" }, include: REGISTRATION_INCLUDE }),
    prisma.shopRegistration.count({ where }),
    prisma.shopRegistration.aggregate({
      where: { dealerId, status: "COLLECTED" },
      _sum: { amountCents: true },
      _count: true,
    }),
  ]);

  return {
    items,
    meta: { page, pageSize, total },
    summary: { totalCollectedCents: agg._sum.amountCents ?? 0, collectedCount: agg._count },
  };
}

// Admin-wide view of every dealer registration, for oversight and reconciliation.
export async function listAllRegistrations(query: { page?: number; pageSize?: number; search?: string }) {
  const { page, pageSize, skip, take } = parsePagination(query);
  const where: Prisma.ShopRegistrationWhereInput = {};
  if (query.search) {
    where.business = { is: { name: { contains: query.search } } };
  }

  const [items, total, agg] = await Promise.all([
    prisma.shopRegistration.findMany({ where, skip, take, orderBy: { createdAt: "desc" }, include: REGISTRATION_INCLUDE }),
    prisma.shopRegistration.count({ where }),
    prisma.shopRegistration.aggregate({ where: { status: "COLLECTED" }, _sum: { amountCents: true }, _count: true }),
  ]);

  return {
    items,
    meta: { page, pageSize, total },
    summary: { totalCollectedCents: agg._sum.amountCents ?? 0, collectedCount: agg._count },
  };
}
