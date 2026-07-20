import {
  Baby,
  Briefcase,
  Building2,
  Car,
  Dumbbell,
  Factory,
  GraduationCap,
  Hammer,
  HeartPulse,
  Home,
  type LucideIcon,
  PawPrint,
  Scissors,
  ShoppingBag,
  Sparkles,
  Store,
  Truck,
  UtensilsCrossed,
  Wrench,
} from "lucide-react";

interface IconRule {
  keywords: string[];
  icon: LucideIcon;
  tint: string;
}

const RULES: IconRule[] = [
  { keywords: ["restaurant", "food", "dining", "cafe"], icon: UtensilsCrossed, tint: "bg-orange-50 text-orange-600" },
  { keywords: ["hotel", "stay", "travel"], icon: Building2, tint: "bg-sky-50 text-sky-600" },
  { keywords: ["spa", "beauty", "salon"], icon: Sparkles, tint: "bg-pink-50 text-pink-600" },
  { keywords: ["home", "decor", "furniture", "interior"], icon: Home, tint: "bg-amber-50 text-amber-600" },
  { keywords: ["wedding", "event", "party"], icon: PawPrint, tint: "bg-fuchsia-50 text-fuchsia-600" },
  { keywords: ["education", "school", "training", "coaching"], icon: GraduationCap, tint: "bg-indigo-50 text-indigo-600" },
  { keywords: ["rent", "hire", "car", "vehicle"], icon: Car, tint: "bg-blue-50 text-blue-600" },
  { keywords: ["hospital", "doctor", "clinic", "health", "medical"], icon: HeartPulse, tint: "bg-red-50 text-red-600" },
  { keywords: ["contractor", "construction", "builder"], icon: Hammer, tint: "bg-yellow-50 text-yellow-700" },
  { keywords: ["pet"], icon: PawPrint, tint: "bg-lime-50 text-lime-600" },
  { keywords: ["gym", "fitness"], icon: Dumbbell, tint: "bg-emerald-50 text-emerald-600" },
  { keywords: ["loan", "finance", "bank"], icon: Briefcase, tint: "bg-teal-50 text-teal-600" },
  { keywords: ["courier", "packer", "mover", "logistics", "delivery"], icon: Truck, tint: "bg-cyan-50 text-cyan-600" },
  { keywords: ["repair", "service", "plumb", "electric", "home-services"], icon: Wrench, tint: "bg-slate-50 text-slate-600" },
  { keywords: ["salon", "barber"], icon: Scissors, tint: "bg-rose-50 text-rose-600" },
  { keywords: ["manufactur", "supply", "supplies", "b2b", "industrial", "wholesale"], icon: Factory, tint: "bg-violet-50 text-violet-600" },
  { keywords: ["shop", "retail", "store"], icon: ShoppingBag, tint: "bg-brand-50 text-brand-700" },
  { keywords: ["child", "kids", "baby"], icon: Baby, tint: "bg-purple-50 text-purple-600" },
];

const DEFAULT: IconRule = { keywords: [], icon: Store, tint: "bg-brand-50 text-brand-700" };

export function getCategoryIcon(label: string): { icon: LucideIcon; tint: string } {
  const lower = label.toLowerCase();
  const match = RULES.find((rule) => rule.keywords.some((kw) => lower.includes(kw)));
  return match ?? DEFAULT;
}
