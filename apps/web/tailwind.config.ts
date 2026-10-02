import type { Config } from "tailwindcss";

// Neutral colours are read from CSS variables (see globals.css), so the dark
// theme can swap them without a `dark:` class on every element. Backgrounds,
// text and borders are mapped separately: in the dark theme "text-gray-900"
// becomes light while "bg-gray-900" (buttons, chosen chips) becomes the accent.
const fromVariable = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;
const shades = (family: string, list: number[]) =>
  Object.fromEntries(list.map((shade) => [shade, fromVariable(`${family}-gray-${shade}`)]));

const config: Config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
      },
      backgroundColor: {
        white: fromVariable("bg-white"),
        black: fromVariable("bg-black"),
        gray: shades("bg", [50, 100, 200, 300, 700, 900]),
      },
      textColor: {
        gray: shades("text", [200, 300, 400, 500, 600, 700, 800, 900]),
      },
      borderColor: {
        gray: shades("border", [100, 200, 300, 400, 700, 900]),
      },
      ringColor: {
        white: fromVariable("ring-white"),
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
  plugins: [],
};
export default config;
