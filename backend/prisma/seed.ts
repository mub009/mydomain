import { PrismaClient, UserRole, UserStatus, BusinessStatus } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const passwordHash = await bcrypt.hash("Password123!", 12);

  const admin = await prisma.user.upsert({
    where: { email: "admin@mydomain.dev" },
    update: {},
    create: {
      email: "admin@mydomain.dev",
      passwordHash,
      firstName: "Ada",
      lastName: "Admin",
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
    },
  });

  const owner = await prisma.user.upsert({
    where: { email: "owner@mydomain.dev" },
    update: {},
    create: {
      email: "owner@mydomain.dev",
      passwordHash,
      firstName: "Olivia",
      lastName: "Owner",
      role: UserRole.BUSINESS_OWNER,
      status: UserStatus.ACTIVE,
    },
  });

  const customer = await prisma.user.upsert({
    where: { email: "customer@mydomain.dev" },
    update: {},
    create: {
      email: "customer@mydomain.dev",
      passwordHash,
      firstName: "Cara",
      lastName: "Customer",
      role: UserRole.CUSTOMER,
      status: UserStatus.ACTIVE,
    },
  });

  const restaurants = await prisma.category.upsert({
    where: { slug: "restaurants" },
    update: {},
    create: { name: "Restaurants", slug: "restaurants", description: "Dining and food outlets" },
  });

  const homeServices = await prisma.category.upsert({
    where: { slug: "home-services" },
    update: {},
    create: { name: "Home Services", slug: "home-services", description: "Plumbers, electricians, cleaners" },
  });

  const manufacturing = await prisma.category.upsert({
    where: { slug: "manufacturing-supplies" },
    update: {},
    create: { name: "Manufacturing & Supplies", slug: "manufacturing-supplies", description: "B2B raw materials and equipment" },
  });

  const business = await prisma.business.upsert({
    where: { slug: "spice-route-kitchen" },
    update: {},
    create: {
      ownerId: owner.id,
      name: "Spice Route Kitchen",
      slug: "spice-route-kitchen",
      description: "Authentic North Indian cuisine in the heart of the city.",
      categoryId: restaurants.id,
      status: BusinessStatus.PUBLISHED,
      isVerified: true,
      phone: "+91-9876543210",
      email: "hello@spicerouteexample.com",
      addressLine1: "12 MG Road",
      city: "Bengaluru",
      state: "Karnataka",
      postalCode: "560001",
      country: "IN",
      latitude: 12.9716,
      longitude: 77.5946,
      avgRating: 4.5,
      reviewCount: 1,
    },
  });

  await prisma.businessHours.upsert({
    where: { businessId_dayOfWeek: { businessId: business.id, dayOfWeek: 1 } },
    update: {},
    create: { businessId: business.id, dayOfWeek: 1, openTime: "10:00", closeTime: "22:00" },
  });

  const service = await prisma.service.upsert({
    where: { id: "00000000-0000-0000-0000-000000000001" },
    update: {},
    create: {
      id: "00000000-0000-0000-0000-000000000001",
      businessId: business.id,
      name: "Table for 2 - Dinner Reservation",
      priceCents: 0,
      durationMins: 90,
    },
  });

  await prisma.review.upsert({
    where: { businessId_userId: { businessId: business.id, userId: customer.id } },
    update: {},
    create: {
      businessId: business.id,
      userId: customer.id,
      rating: 5,
      title: "Fantastic food!",
      comment: "Best butter chicken in town.",
    },
  });

  await prisma.rfq.upsert({
    where: { id: "00000000-0000-0000-0000-000000000002" },
    update: {},
    create: {
      id: "00000000-0000-0000-0000-000000000002",
      buyerId: customer.id,
      categoryId: manufacturing.id,
      title: "Bulk packaging boxes needed",
      description: "Looking for 10,000 corrugated boxes, 12x12x12 inches, delivered monthly.",
      quantity: 10000,
      city: "Bengaluru",
      state: "Karnataka",
    },
  });

  console.log({ admin: admin.email, owner: owner.email, customer: customer.email, categories: [restaurants.slug, homeServices.slug, manufacturing.slug], business: business.slug, service: service.id });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
