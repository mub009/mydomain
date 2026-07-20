export interface ShowcaseItem {
  label: string;
  query: string;
  seed: string;
}

export interface ShowcaseGroup {
  title: string;
  items: ShowcaseItem[];
}

// Curated "explore" shortcuts shown on the home page — independent of the
// live category tree in the database, similar to how directory sites
// surface popular subcategories as an editorial discovery grid. Clicking a
// tile runs a keyword search rather than a strict category filter, since
// these are commonly searched terms rather than formal taxonomy nodes.
export const CATEGORY_SHOWCASE: ShowcaseGroup[] = [
  {
    title: "Wedding Requisites",
    items: [
      { label: "Banquet Halls", query: "banquet hall", seed: "banquet-halls" },
      { label: "Bridal Requisite", query: "bridal", seed: "bridal-requisite" },
      { label: "Caterers", query: "caterer", seed: "caterers" },
    ],
  },
  {
    title: "Beauty & Spa",
    items: [
      { label: "Beauty Parlours", query: "beauty parlour", seed: "beauty-parlours" },
      { label: "Spa & Massages", query: "spa massage", seed: "spa-massages" },
      { label: "Salons", query: "salon", seed: "salons" },
    ],
  },
  {
    title: "Repairs & Services",
    items: [
      { label: "AC Service", query: "ac service", seed: "ac-service" },
      { label: "Car Service", query: "car service", seed: "car-service" },
      { label: "Bike Service", query: "bike service", seed: "bike-service" },
    ],
  },
  {
    title: "Daily Needs",
    items: [
      { label: "Grocery", query: "grocery", seed: "grocery" },
      { label: "Electricians", query: "electrician", seed: "electricians" },
      { label: "Laundry", query: "laundry", seed: "laundry" },
    ],
  },
];
