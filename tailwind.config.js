/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        warmBg: "#FAF9F6",
        cardBg: "#FFFFFF",
        primaryText: "#18181B",
        mutedText: "#71717A",
        accent: {
          DEFAULT: "#E8623D",
          hover: "#D6532F",
          subtle: "#FDF2EF",
          border: "#F5C7B8",
          dark: "#B84323",
        },
        ebay: {
          DEFAULT: "#4A6B82",
          bg: "#F2F6F9",
          border: "#D1DFE8",
        },
        poshmark: {
          DEFAULT: "#964867",
          bg: "#FAF0F4",
          border: "#E9D2DC",
        },
        facebook: {
          DEFAULT: "#2D6A9F",
          bg: "#F0F6FA",
          border: "#C8DEED",
        }
      },
      fontFamily: {
        sans: ["var(--font-inter)", "sans-serif"],
        heading: ["var(--font-space-grotesk)", "sans-serif"],
      },
      boxShadow: {
        warm: "0 4px 20px -2px rgba(120, 80, 60, 0.05), 0 2px 6px -1px rgba(120, 80, 60, 0.03)",
        warmHover: "0 10px 25px -3px rgba(120, 80, 60, 0.09), 0 4px 10px -2px rgba(120, 80, 60, 0.04)",
        warmCard: "0 1px 3px 0 rgba(120, 80, 60, 0.04), 0 1px 2px -1px rgba(120, 80, 60, 0.03)",
      },
      borderRadius: {
        button: "8px",
        card: "16px",
      }
    },
  },
  plugins: [],
};
