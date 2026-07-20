/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#f0fdf6",
          100: "#dcfced",
          200: "#b8f5d8",
          300: "#7fe9bb",
          400: "#42d497",
          500: "#1ab97c",
          600: "#0f9e68",
          700: "#0d7f56",
          800: "#0d6547",
          900: "#0b533c",
        },
        gold: {
          50: "#fffbeb",
          100: "#fef3c7",
          400: "#f5b301",
          500: "#e29c00",
        },
        ink: {
          900: "#1a1d23",
          700: "#3a3f47",
          500: "#6b7280",
        },
      },
      fontFamily: {
        sans: [
          "Inter",
          "ui-sans-serif",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
      },
      boxShadow: {
        card: "0 1px 2px rgba(16,24,40,0.06), 0 1px 3px rgba(16,24,40,0.10)",
        "card-hover": "0 4px 12px rgba(16,24,40,0.10), 0 2px 6px rgba(16,24,40,0.08)",
        popover: "0 10px 30px rgba(16,24,40,0.15)",
      },
      borderRadius: {
        xl2: "1rem",
      },
    },
  },
  plugins: [],
};
