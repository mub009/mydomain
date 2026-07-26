/**
 * Bulk demo data: 100 fully-populated businesses.
 *
 * Each listing gets an owner account, photos, weekly opening hours, services,
 * and reviews (with avgRating/reviewCount recomputed from them). Everything is
 * upserted by a stable slug, so running this repeatedly is safe.
 *
 *   npm run seed:businesses
 */
import { BusinessStatus, PrismaClient, UserRole, UserStatus } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// Deterministic PRNG. The stream is re-seeded from the record index at the
// start of every business (see reseed below) so a re-run generates identical
// names and slugs even though it skips work it already did last time — that
// skipped work would otherwise consume a different number of draws and
// desynchronise the sequence, producing duplicates instead of no-ops.
let seed = 20260726;
function reseed(index: number): void {
  seed = (20260726 + index * 7919) & 0x7fffffff;
}
function rand(): number {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff;
  return seed / 0x7fffffff;
}
function pick<T>(list: readonly T[]): T {
  return list[Math.floor(rand() * list.length)];
}
function randInt(min: number, max: number): number {
  return Math.floor(rand() * (max - min + 1)) + min;
}
function jitter(base: number, spread = 0.08): number {
  return Number((base + (rand() - 0.5) * spread).toFixed(6));
}

const CITIES = [
  { city: "Bengaluru", state: "Karnataka", postal: "560001", lat: 12.9716, lng: 77.5946 },
  { city: "Mumbai", state: "Maharashtra", postal: "400001", lat: 19.076, lng: 72.8777 },
  { city: "Delhi", state: "Delhi", postal: "110001", lat: 28.6139, lng: 77.209 },
  { city: "Hyderabad", state: "Telangana", postal: "500001", lat: 17.385, lng: 78.4867 },
  { city: "Chennai", state: "Tamil Nadu", postal: "600001", lat: 13.0827, lng: 80.2707 },
  { city: "Pune", state: "Maharashtra", postal: "411001", lat: 18.5204, lng: 73.8567 },
  { city: "Kochi", state: "Kerala", postal: "682001", lat: 9.9312, lng: 76.2673 },
  { city: "Ahmedabad", state: "Gujarat", postal: "380001", lat: 23.0225, lng: 72.5714 },
  { city: "Jaipur", state: "Rajasthan", postal: "302001", lat: 26.9124, lng: 75.7873 },
  { city: "Kolkata", state: "West Bengal", postal: "700001", lat: 22.5726, lng: 88.3639 },
] as const;

const LOCALITIES = [
  "MG Road", "Park Street", "Anna Nagar", "Banjara Hills", "Koramangala", "Andheri West",
  "Salt Lake", "Gandhi Nagar", "Civil Lines", "Jubilee Hills", "Indiranagar", "Marine Drive",
  "Sector 18", "Rajouri Garden", "Kalyan Nagar", "Panampilly Nagar",
] as const;

interface CategorySpec {
  slug: string;
  name: string;
  description: string;
  photoSeeds: readonly string[];
  namePrefixes: readonly string[];
  nameSuffixes: readonly string[];
  blurb: string;
  services: readonly { name: string; price: number; mins: number; description: string }[];
}

const CATEGORY_SPECS: CategorySpec[] = [
  {
    slug: "restaurants",
    name: "Restaurants",
    description: "Dining and food outlets",
    photoSeeds: ["restaurant-interior", "indian-thali", "restaurant-dining", "tandoori-kitchen", "cafe-table"],
    namePrefixes: ["Spice", "Royal", "Green Leaf", "Curry", "Tandoori", "Coastal", "Urban", "Golden"],
    nameSuffixes: ["Kitchen", "Restaurant", "Diner", "Biryani House", "Cafe", "Grill", "Eatery"],
    blurb:
      "Freshly prepared regional cuisine served in a warm, family-friendly setting. Dine-in, takeaway and table reservations available, with vegetarian and vegan options on every menu.",
    services: [
      { name: "Table Reservation (2 guests)", price: 0, mins: 90, description: "Reserve a table for two." },
      { name: "Private Dining Room", price: 200000, mins: 180, description: "Private room for celebrations, up to 12 guests." },
      { name: "Home Catering (per head)", price: 45000, mins: 60, description: "Full-service catering delivered to your event." },
      { name: "Chef's Tasting Menu", price: 150000, mins: 120, description: "Seven-course tasting menu with pairings." },
    ],
  },
  {
    slug: "home-services",
    name: "Home Services",
    description: "Plumbers, electricians, cleaners",
    photoSeeds: ["plumber-tools", "electrician-work", "home-cleaning", "handyman-repair", "painting-wall"],
    namePrefixes: ["Quick", "Reliable", "Prime", "Sharp", "Trusted", "Expert", "Rapid", "Bright"],
    nameSuffixes: ["Home Services", "Plumbing", "Electricals", "Cleaning Co", "Repairs", "Handyman"],
    blurb:
      "Background-verified technicians for plumbing, electrical, carpentry and deep-cleaning work. Same-day slots, transparent pricing and a 30-day workmanship guarantee on every job.",
    services: [
      { name: "Plumbing Call-out", price: 39900, mins: 60, description: "Diagnosis and minor repairs." },
      { name: "Full Home Deep Clean", price: 249900, mins: 240, description: "Room-by-room deep clean including kitchen and bathrooms." },
      { name: "Electrical Fitting", price: 59900, mins: 90, description: "Switches, sockets and light fittings." },
      { name: "Annual Maintenance Plan", price: 599900, mins: 60, description: "Four scheduled visits across the year." },
    ],
  },
  {
    slug: "beauty-spa",
    name: "Beauty & Spa",
    description: "Salons, spas and wellness studios",
    photoSeeds: ["spa-treatment", "salon-chair", "massage-room", "beauty-products", "hair-styling"],
    namePrefixes: ["Glow", "Serene", "Blush", "Aura", "Velvet", "Bloom", "Luxe", "Radiance"],
    nameSuffixes: ["Salon", "Spa", "Beauty Studio", "Wellness", "Hair & Beauty", "Day Spa"],
    blurb:
      "A calm, hygienic studio offering hair, skin and body treatments by certified stylists and therapists. Walk-ins welcome, with online booking for weekend slots.",
    services: [
      { name: "Haircut & Styling", price: 69900, mins: 60, description: "Consultation, cut, wash and blow-dry." },
      { name: "Swedish Full-Body Massage", price: 179900, mins: 90, description: "Relaxing full-body massage with aromatic oils." },
      { name: "Facial & Clean-up", price: 129900, mins: 75, description: "Deep-cleansing facial suited to your skin type." },
      { name: "Bridal Package", price: 1499900, mins: 300, description: "Complete bridal hair, make-up and skin preparation." },
    ],
  },
  {
    slug: "health-medical",
    name: "Health & Medical",
    description: "Clinics, dentists and diagnostics",
    photoSeeds: ["medical-clinic", "dental-chair", "doctor-consult", "pharmacy-shelf", "lab-testing"],
    namePrefixes: ["City", "Apex", "LifeCare", "Wellness", "Sunrise", "Metro", "Care First", "Prime"],
    nameSuffixes: ["Clinic", "Dental Care", "Diagnostics", "Medical Centre", "Polyclinic", "Health Hub"],
    blurb:
      "Qualified practitioners offering consultations, diagnostics and preventive care. Digital records, insurance assistance and evening appointments for working professionals.",
    services: [
      { name: "General Consultation", price: 50000, mins: 20, description: "Consultation with a general physician." },
      { name: "Dental Scaling & Polishing", price: 150000, mins: 45, description: "Professional cleaning and polishing." },
      { name: "Full Body Health Check", price: 349900, mins: 120, description: "Comprehensive blood work and screening." },
      { name: "Physiotherapy Session", price: 80000, mins: 45, description: "One-to-one session with a physiotherapist." },
    ],
  },
  {
    slug: "education-training",
    name: "Education & Training",
    description: "Coaching centres and skill academies",
    photoSeeds: ["classroom-study", "library-books", "coaching-class", "students-learning", "computer-lab"],
    namePrefixes: ["Bright", "Scholar", "Achievers", "Future", "Insight", "Summit", "Elite", "Genius"],
    nameSuffixes: ["Academy", "Institute", "Coaching Centre", "Learning Hub", "Tutorials", "Classes"],
    blurb:
      "Small-batch coaching with experienced faculty, regular mock assessments and detailed progress reports for parents. Weekend and online batches available.",
    services: [
      { name: "Demo Class", price: 0, mins: 60, description: "Free trial class before enrolling." },
      { name: "Monthly Tuition (per subject)", price: 250000, mins: 60, description: "Twelve sessions across the month." },
      { name: "Crash Course", price: 999900, mins: 120, description: "Intensive six-week exam preparation." },
      { name: "One-to-One Tutoring", price: 120000, mins: 60, description: "Personalised private tutoring session." },
    ],
  },
  {
    slug: "automotive",
    name: "Automotive",
    description: "Garages, car care and spares",
    photoSeeds: ["car-garage", "auto-repair", "car-wash", "mechanic-tools", "tyre-shop"],
    namePrefixes: ["Speed", "Auto", "Torque", "DriveWell", "Gear", "Turbo", "Precision", "Highway"],
    nameSuffixes: ["Motors", "Garage", "Auto Care", "Service Centre", "Car Spa", "Workshop"],
    blurb:
      "Multi-brand workshop with computerised diagnostics, genuine spares and trained technicians. Pick-up and drop facility, plus a free health check with every service.",
    services: [
      { name: "General Car Service", price: 349900, mins: 180, description: "Oil change, filters and a 30-point inspection." },
      { name: "Wheel Alignment & Balancing", price: 129900, mins: 60, description: "Four-wheel alignment and balancing." },
      { name: "Premium Car Wash & Polish", price: 99900, mins: 90, description: "Exterior wash, interior vacuum and wax polish." },
      { name: "AC Service", price: 199900, mins: 120, description: "Gas top-up, filter clean and cooling check." },
    ],
  },
  {
    slug: "event-services",
    name: "Event Services",
    description: "Caterers, decorators and photographers",
    photoSeeds: ["wedding-decor", "event-catering", "photography-camera", "party-lights", "banquet-hall"],
    namePrefixes: ["Grand", "Celebration", "Dream", "Elegant", "Festive", "Signature", "Blissful", "Star"],
    nameSuffixes: ["Events", "Caterers", "Decorators", "Photography", "Wedding Planners", "Banquets"],
    blurb:
      "End-to-end planning for weddings, corporate functions and private parties — venue styling, catering, photography and on-the-day coordination by a dedicated manager.",
    services: [
      { name: "Event Consultation", price: 0, mins: 45, description: "Discuss your requirements and get a quote." },
      { name: "Wedding Catering (per plate)", price: 85000, mins: 60, description: "Multi-cuisine menu with live counters." },
      { name: "Full Venue Decoration", price: 4999900, mins: 480, description: "Floral staging, lighting and seating design." },
      { name: "Photography & Video Package", price: 3499900, mins: 600, description: "Full-day coverage with edited album and film." },
    ],
  },
  {
    slug: "fitness-sports",
    name: "Fitness & Sports",
    description: "Gyms, yoga studios and coaching",
    photoSeeds: ["gym-weights", "yoga-class", "fitness-training", "sports-court", "running-track"],
    namePrefixes: ["Iron", "Pulse", "Zen", "Peak", "Active", "Core", "Vital", "Momentum"],
    nameSuffixes: ["Fitness", "Gym", "Yoga Studio", "Sports Club", "Training Centre", "Wellness Studio"],
    blurb:
      "Modern equipment, certified trainers and group classes throughout the day. Personalised plans, body-composition tracking and nutrition guidance included with membership.",
    services: [
      { name: "Trial Session", price: 0, mins: 60, description: "Free trial workout with a trainer." },
      { name: "Monthly Membership", price: 199900, mins: 60, description: "Unlimited gym access and group classes." },
      { name: "Personal Training (10 sessions)", price: 1200000, mins: 60, description: "Ten one-to-one sessions with a coach." },
      { name: "Yoga Class Pack", price: 399900, mins: 75, description: "Twelve guided yoga sessions." },
    ],
  },
  {
    slug: "electronics-repair",
    name: "Electronics & Repair",
    description: "Mobile, appliance and computer repair",
    photoSeeds: ["phone-repair", "laptop-service", "electronics-workbench", "circuit-board", "appliance-fix"],
    namePrefixes: ["TechFix", "Gadget", "Circuit", "SmartCare", "Digital", "Volt", "PixelPro", "Bit"],
    nameSuffixes: ["Repairs", "Electronics", "Service Hub", "Tech Care", "Solutions", "Mobile Care"],
    blurb:
      "Component-level repair for phones, laptops and home appliances with original parts and a six-month warranty. Most repairs completed the same day while you wait.",
    services: [
      { name: "Diagnostics", price: 0, mins: 30, description: "Free fault diagnosis and estimate." },
      { name: "Mobile Screen Replacement", price: 349900, mins: 60, description: "Original-quality display fitted and tested." },
      { name: "Laptop Servicing", price: 149900, mins: 120, description: "Cleaning, thermal paste and software tune-up." },
      { name: "Appliance Repair Visit", price: 59900, mins: 90, description: "On-site repair for washing machines and fridges." },
    ],
  },
  {
    slug: "real-estate",
    name: "Real Estate",
    description: "Agents, rentals and property services",
    photoSeeds: ["modern-apartment", "house-keys", "property-office", "city-skyline", "interior-living"],
    namePrefixes: ["Prime", "Landmark", "Nest", "Skyline", "Anchor", "Urban", "Crest", "Haven"],
    nameSuffixes: ["Properties", "Realty", "Estates", "Housing", "Property Advisors", "Homes"],
    blurb:
      "Verified residential and commercial listings with transparent brokerage. Assistance with site visits, price negotiation, rental agreements and home-loan paperwork.",
    services: [
      { name: "Property Site Visit", price: 0, mins: 90, description: "Accompanied viewing of shortlisted properties." },
      { name: "Rental Agreement Drafting", price: 250000, mins: 120, description: "Drafting and registration assistance." },
      { name: "Property Valuation Report", price: 500000, mins: 180, description: "Detailed market valuation report." },
      { name: "Home Loan Assistance", price: 0, mins: 60, description: "Documentation help and lender comparison." },
    ],
  },
];

const REVIEW_TEMPLATES = [
  { rating: 5, title: "Excellent experience", comment: "Professional, punctual and great value. Would happily recommend to anyone nearby." },
  { rating: 5, title: "Highly recommended", comment: "Staff were courteous and the quality exceeded what I expected for the price." },
  { rating: 4, title: "Very good", comment: "Good service overall and fair pricing. Slight wait, but the result was worth it." },
  { rating: 4, title: "Reliable", comment: "Second time using them. Consistent quality and easy to get an appointment." },
  { rating: 3, title: "Decent", comment: "Does the job. Communication could be a little better, but no real complaints." },
  { rating: 5, title: "Best in the area", comment: "Clean, well organised and genuinely helpful. My go-to place now." },
  { rating: 4, title: "Good value", comment: "Reasonable rates for the quality delivered. Booking was straightforward." },
  { rating: 2, title: "Average", comment: "Service was okay but took longer than promised. Room for improvement." },
];

const FIRST_NAMES = ["Arun", "Priya", "Rahul", "Sneha", "Vikram", "Anita", "Karan", "Divya", "Sanjay", "Meera", "Rohit", "Kavya", "Amit", "Pooja", "Nikhil", "Lakshmi"];
const LAST_NAMES = ["Sharma", "Nair", "Patel", "Reddy", "Iyer", "Gupta", "Menon", "Singh", "Desai", "Rao", "Joshi", "Kulkarni"];

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

async function main() {
  const TARGET = 100;
  const passwordHash = await bcrypt.hash("Password123!", 12);

  // Categories --------------------------------------------------------------
  const categories = new Map<string, string>();
  for (const spec of CATEGORY_SPECS) {
    const category = await prisma.category.upsert({
      where: { slug: spec.slug },
      update: {},
      create: { name: spec.name, slug: spec.slug, description: spec.description },
    });
    categories.set(spec.slug, category.id);
  }
  console.log(`Categories ready: ${categories.size}`);

  // Reviewer pool -----------------------------------------------------------
  const reviewers: string[] = [];
  for (let i = 0; i < 20; i++) {
    const email = `reviewer${i + 1}@demo.markkito.dev`;
    const user = await prisma.user.upsert({
      where: { email },
      update: {},
      create: {
        email,
        passwordHash,
        firstName: FIRST_NAMES[i % FIRST_NAMES.length],
        lastName: LAST_NAMES[i % LAST_NAMES.length],
        role: UserRole.CUSTOMER,
        status: UserStatus.ACTIVE,
      },
    });
    reviewers.push(user.id);
  }
  console.log(`Reviewers ready: ${reviewers.length}`);

  let createdCount = 0;
  const usedSlugs = new Set<string>();

  for (let i = 0; i < TARGET; i++) {
    // Stable identity per record, independent of work skipped on a re-run.
    reseed(i);
    const spec = CATEGORY_SPECS[i % CATEGORY_SPECS.length];
    const place = pick(CITIES);
    const locality = pick(LOCALITIES);

    // Unique, readable name and slug.
    const baseName = `${pick(spec.namePrefixes)} ${pick(spec.nameSuffixes)}`;
    let name = baseName;
    let slug = slugify(`${baseName}-${place.city}`);
    if (usedSlugs.has(slug)) {
      name = `${baseName} ${locality}`;
      slug = slugify(`${baseName}-${locality}-${place.city}-${i}`);
    }
    usedSlugs.add(slug);

    // Owner account for this listing.
    const ownerFirst = pick(FIRST_NAMES);
    const ownerLast = pick(LAST_NAMES);
    const ownerEmail = `owner${i + 1}@demo.markkito.dev`;
    const owner = await prisma.user.upsert({
      where: { email: ownerEmail },
      update: {},
      create: {
        email: ownerEmail,
        phone: `9${String(700000000 + i * 137).slice(0, 9)}`,
        passwordHash,
        firstName: ownerFirst,
        lastName: ownerLast,
        role: UserRole.BUSINESS_OWNER,
        status: UserStatus.ACTIVE,
      },
    });

    const phone = `+91-9${String(800000000 + i * 971).slice(0, 9)}`;
    const business = await prisma.business.upsert({
      where: { slug },
      update: {},
      create: {
        ownerId: owner.id,
        createdById: owner.id,
        name,
        slug,
        description: `${name} — ${spec.blurb}`,
        categoryId: categories.get(spec.slug)!,
        status: BusinessStatus.PUBLISHED,
        isVerified: rand() > 0.35,
        phone,
        email: `hello@${slug.slice(0, 24)}.example.com`,
        website: `https://${slug.slice(0, 24)}.example.com`,
        addressLine1: `${randInt(1, 240)} ${locality}`,
        addressLine2: `Near ${pick(["Metro Station", "City Mall", "Bus Depot", "Central Park", "Main Market"])}`,
        city: place.city,
        state: place.state,
        postalCode: place.postal,
        country: "IN",
        latitude: jitter(place.lat),
        longitude: jitter(place.lng),
        viewCount: randInt(20, 900),
      },
    });

    // Photos ----------------------------------------------------------------
    const existingPhotos = await prisma.businessPhoto.count({ where: { businessId: business.id } });
    if (existingPhotos === 0) {
      await prisma.businessPhoto.createMany({
        data: spec.photoSeeds.map((photoSeed, index) => ({
          businessId: business.id,
          url: `https://picsum.photos/seed/${photoSeed}-${i}/800/600`,
          caption: `${name} — ${photoSeed.replace(/-/g, " ")}`,
          sortOrder: index,
        })),
      });
    }

    // Opening hours (one random closed day) ---------------------------------
    const existingHours = await prisma.businessHours.count({ where: { businessId: business.id } });
    if (existingHours === 0) {
      const closedDay = randInt(0, 6);
      const opensAt = pick(["08:00", "09:00", "09:30", "10:00", "11:00"]);
      const closesAt = pick(["18:00", "19:00", "20:00", "21:00", "22:00"]);
      await prisma.businessHours.createMany({
        data: Array.from({ length: 7 }, (_, day) => ({
          businessId: business.id,
          dayOfWeek: day,
          openTime: day === closedDay ? "00:00" : opensAt,
          closeTime: day === closedDay ? "00:00" : closesAt,
          isClosed: day === closedDay,
        })),
      });
    }

    // Services --------------------------------------------------------------
    const existingServices = await prisma.service.count({ where: { businessId: business.id } });
    if (existingServices === 0) {
      const count = randInt(2, spec.services.length);
      await prisma.service.createMany({
        data: spec.services.slice(0, count).map((service) => ({
          businessId: business.id,
          name: service.name,
          description: service.description,
          priceCents: service.price,
          currency: "INR",
          durationMins: service.mins,
          isActive: true,
        })),
      });
    }

    // Reviews, then recompute the rating summary from them -------------------
    const existingReviews = await prisma.review.count({ where: { businessId: business.id } });
    if (existingReviews === 0) {
      const reviewCount = randInt(2, 8);
      const shuffled = [...reviewers].sort(() => rand() - 0.5).slice(0, reviewCount);
      for (const userId of shuffled) {
        const template = pick(REVIEW_TEMPLATES);
        await prisma.review.create({
          data: {
            businessId: business.id,
            userId,
            rating: template.rating,
            title: template.title,
            comment: template.comment,
            ownerReply: rand() > 0.7 ? "Thank you for the kind feedback — we look forward to serving you again!" : null,
            ownerRepliedAt: rand() > 0.7 ? new Date() : null,
          },
        });
      }
    }

    const agg = await prisma.review.aggregate({
      where: { businessId: business.id },
      _avg: { rating: true },
      _count: true,
    });
    await prisma.business.update({
      where: { id: business.id },
      data: {
        avgRating: Number((agg._avg.rating ?? 0).toFixed(2)),
        reviewCount: agg._count,
      },
    });

    createdCount++;
    if (createdCount % 20 === 0) console.log(`  …${createdCount}/${TARGET} businesses ready`);
  }

  const totals = {
    businesses: await prisma.business.count(),
    photos: await prisma.businessPhoto.count(),
    services: await prisma.service.count(),
    reviews: await prisma.review.count(),
    categories: await prisma.category.count(),
  };
  console.log("\nDone. Database totals:", totals);
  console.log("Demo logins: owner1@demo.markkito.dev … owner100@demo.markkito.dev / Password123!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
