import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface GeoPoint {
  lat: number;
  lng: number;
}

interface LocationState {
  city: string;
  geo: GeoPoint | null;
  setCity: (city: string) => void;
  setGeo: (geo: GeoPoint | null) => void;
}

// The visitor's chosen location, remembered across pages so a category click
// keeps filtering to where they are.
export const useLocationStore = create<LocationState>()(
  persist(
    (set) => ({
      city: "",
      geo: null,
      // A city and a "near me" point are alternative ways of saying where to
      // search, so setting one clears the other.
      setCity: (city) => set({ city, geo: null }),
      setGeo: (geo) => set((s) => ({ geo, city: geo ? "" : s.city })),
    }),
    { name: "markkito-location" },
  ),
);
