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

  await prisma.user.upsert({
    where: { email: "dealer@mydomain.dev" },
    update: {},
    create: {
      email: "dealer@mydomain.dev",
      passwordHash,
      firstName: "Derek",
      lastName: "Dealer",
      role: UserRole.DEALER,
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
      description:
        "Authentic North Indian cuisine in the heart of the city. Spice Route Kitchen serves freshly prepared tandoori dishes, rich curries, and hand-rolled breads in a warm, family-friendly setting. Dine-in, takeaway, and table reservations available.",
      categoryId: restaurants.id,
      status: BusinessStatus.PUBLISHED,
      isVerified: true,
      phone: "+91-9876543210",
      email: "hello@spicerouteexample.com",
      website: "https://spicerouteexample.com",
      addressLine1: "12 MG Road, 2nd Floor, Near Trinity Metro",
      city: "Bengaluru",
      state: "Karnataka",
      postalCode: "560001",
      country: "IN",
      latitude: 12.9716,
      longitude: 77.5946,
      avgRating: 4.3,
      reviewCount: 3,
    },
  });

  // Photos
  const photoSeeds = ["restaurant-interior", "indian-food-thali", "restaurant-dining", "tandoori-kitchen", "restaurant-bar"];
  for (let i = 0; i < photoSeeds.length; i++) {
    const id = `00000000-0000-0000-0000-0000000001${i.toString().padStart(2, "0")}`;
    await prisma.businessPhoto.upsert({
      where: { id },
      update: {},
      create: {
        id,
        businessId: business.id,
        url: `https://picsum.photos/seed/${photoSeeds[i]}/800/600`,
        caption: photoSeeds[i].replace(/-/g, " "),
        sortOrder: i,
      },
    });
  }

  // Weekly hours (Mon–Sun; closed Tuesday)
  const weeklyHours = [
    { dayOfWeek: 0, openTime: "11:00", closeTime: "23:00", isClosed: false },
    { dayOfWeek: 1, openTime: "10:00", closeTime: "22:00", isClosed: false },
    { dayOfWeek: 2, openTime: "00:00", closeTime: "00:00", isClosed: true },
    { dayOfWeek: 3, openTime: "10:00", closeTime: "22:00", isClosed: false },
    { dayOfWeek: 4, openTime: "10:00", closeTime: "22:00", isClosed: false },
    { dayOfWeek: 5, openTime: "10:00", closeTime: "23:00", isClosed: false },
    { dayOfWeek: 6, openTime: "11:00", closeTime: "23:00", isClosed: false },
  ];
  for (const h of weeklyHours) {
    await prisma.businessHours.upsert({
      where: { businessId_dayOfWeek: { businessId: business.id, dayOfWeek: h.dayOfWeek } },
      update: {},
      create: { businessId: business.id, ...h },
    });
  }

  // Services
  const services = [
    { id: "00000000-0000-0000-0000-000000000001", name: "Table for 2 - Dinner Reservation", description: "Reserve a table for two for dinner.", priceCents: 0, durationMins: 90 },
    { id: "00000000-0000-0000-0000-000000000003", name: "Private Dining Room (up to 12)", description: "Book our private room for celebrations and gatherings.", priceCents: 200000, durationMins: 180 },
    { id: "00000000-0000-0000-0000-000000000004", name: "Home Catering (per head)", description: "Full-service catering delivered to your event.", priceCents: 45000, durationMins: 60 },
  ];
  const service = services[0];
  for (const s of services) {
    await prisma.service.upsert({
      where: { id: s.id },
      update: {},
      create: { businessId: business.id, ...s },
    });
  }

  // Extra reviewer accounts so the trend strip and sorting have content
  const reviewers = [
    { email: "raj@example.dev", firstName: "Raj", lastName: "Kumar" },
    { email: "meera@example.dev", firstName: "Meera", lastName: "Nair" },
  ];
  const reviewerUsers = [customer];
  for (const r of reviewers) {
    const u = await prisma.user.upsert({
      where: { email: r.email },
      update: {},
      create: { email: r.email, passwordHash, firstName: r.firstName, lastName: r.lastName, role: UserRole.CUSTOMER, status: UserStatus.ACTIVE },
    });
    reviewerUsers.push(u);
  }

  const reviewData = [
    { rating: 5, title: "Fantastic food!", comment: "Best butter chicken in town. Cozy ambience and quick service." },
    { rating: 4, title: "Great for families", comment: "Nice place to enjoy dinner with family. The naan is excellent." },
    { rating: 4, title: "Superb", comment: "Good portions and reasonable prices. Will visit again." },
  ];
  for (let i = 0; i < reviewData.length; i++) {
    await prisma.review.upsert({
      where: { businessId_userId: { businessId: business.id, userId: reviewerUsers[i].id } },
      update: {},
      create: { businessId: business.id, userId: reviewerUsers[i].id, ...reviewData[i] },
    });
  }

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
