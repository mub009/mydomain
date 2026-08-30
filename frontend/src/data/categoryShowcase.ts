export interface ShowcaseItem {
  label: string;
  query: string;
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
      { label: "Banquet Halls", query: "banquet hall" },
      { label: "Bridal Requisite", query: "bridal" },
      { label: "Caterers", query: "caterer" },
    ],
  },
  {
    title: "Beauty & Spa",
    items: [
      { label: "Beauty Parlours", query: "beauty parlour" },
      { label: "Spa & Massages", query: "spa massage" },
      { label: "Salons", query: "salon" },
    ],
  },
  {
    title: "Repairs & Services",
    items: [
      { label: "AC Service", query: "ac service" },
      { label: "Car Service", query: "car service" },
      { label: "Bike Service", query: "bike service" },
    ],
  },
  {
    title: "Daily Needs",
    items: [
      { label: "Grocery", query: "grocery" },
      { label: "Electricians", query: "electrician" },
      { label: "Laundry", query: "laundry" },
    ],
  },
];
