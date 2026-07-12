/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Semantic tokens resolve through CSS variables (channels declared in
        // src/index.css under :root [dark] and .light [parchment]). The
        // rgb(var(--x) / <alpha-value>) form preserves Tailwind opacity
        // modifiers like border-primary/40.
        surface: "rgb(var(--surface) / <alpha-value>)",
        "surface-dim": "rgb(var(--surface-dim) / <alpha-value>)",
        "surface-bright": "rgb(var(--surface-bright) / <alpha-value>)",
        "surface-container-lowest": "rgb(var(--surface-container-lowest) / <alpha-value>)",
        "surface-container-low": "rgb(var(--surface-container-low) / <alpha-value>)",
        "surface-container": "rgb(var(--surface-container) / <alpha-value>)",
        "surface-container-high": "rgb(var(--surface-container-high) / <alpha-value>)",
        "surface-container-highest": "rgb(var(--surface-container-highest) / <alpha-value>)",
        "surface-variant": "rgb(var(--surface-variant) / <alpha-value>)",
        "on-surface": "rgb(var(--on-surface) / <alpha-value>)",
        "on-surface-variant": "rgb(var(--on-surface-variant) / <alpha-value>)",
        outline: "rgb(var(--outline) / <alpha-value>)",
        "outline-variant": "rgb(var(--outline-variant) / <alpha-value>)",
        primary: "rgb(var(--primary) / <alpha-value>)",
        "on-primary": "rgb(var(--on-primary) / <alpha-value>)",
        "primary-container": "rgb(var(--primary-container) / <alpha-value>)",
        "on-primary-container": "rgb(var(--on-primary-container) / <alpha-value>)",
        "primary-fixed": "rgb(var(--primary-fixed) / <alpha-value>)",
        "primary-fixed-dim": "rgb(var(--primary-fixed-dim) / <alpha-value>)",
        "on-primary-fixed": "rgb(var(--on-primary-fixed) / <alpha-value>)",
        "on-primary-fixed-variant": "rgb(var(--on-primary-fixed-variant) / <alpha-value>)",
        "inverse-primary": "rgb(var(--inverse-primary) / <alpha-value>)",
        secondary: "rgb(var(--secondary) / <alpha-value>)",
        "on-secondary": "rgb(var(--on-secondary) / <alpha-value>)",
        "secondary-container": "rgb(var(--secondary-container) / <alpha-value>)",
        "on-secondary-container": "rgb(var(--on-secondary-container) / <alpha-value>)",
        tertiary: "rgb(var(--tertiary) / <alpha-value>)",
        "on-tertiary": "rgb(var(--on-tertiary) / <alpha-value>)",
        "tertiary-container": "rgb(var(--tertiary-container) / <alpha-value>)",
        "on-tertiary-container": "rgb(var(--on-tertiary-container) / <alpha-value>)",
        error: "rgb(var(--error) / <alpha-value>)",
        "on-error": "rgb(var(--on-error) / <alpha-value>)",
        "error-container": "rgb(var(--error-container) / <alpha-value>)",
        "on-error-container": "rgb(var(--on-error-container) / <alpha-value>)",
        background: "rgb(var(--background) / <alpha-value>)",
        "on-background": "rgb(var(--on-background) / <alpha-value>)",
      },
      fontFamily: {
        serif: ["Newsreader", "ui-serif", "Georgia", "serif"],
        sans: ["Manrope", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      fontSize: {
        "display-lg": ["48px", { lineHeight: "1.1", letterSpacing: "-0.02em", fontWeight: "600" }],
        "headline-md": ["32px", { lineHeight: "1.2", fontWeight: "500" }],
        "title-sm": ["20px", { lineHeight: "1.4", fontWeight: "600" }],
        "body-lg": ["18px", { lineHeight: "1.6", fontWeight: "400" }],
        "body-md": ["16px", { lineHeight: "1.6", fontWeight: "400" }],
        "label-caps": ["12px", { lineHeight: "1.0", letterSpacing: "0.1em", fontWeight: "700" }],
      },
      spacing: {
        unit: "4px",
        xs: "8px",
        sm: "16px",
        md: "24px",
        lg: "40px",
        xl: "64px",
      },
      borderRadius: {
        DEFAULT: "0.25rem",
        sm: "0.125rem",
        md: "0.375rem",
        lg: "0.5rem",
        xl: "0.75rem",
      },
      boxShadow: {
        "brass-glow": "0 0 15px rgba(233, 193, 118, 0.3)",
        "indigo-glow": "0 0 15px rgba(186, 198, 236, 0.25)",
        "inset-card": "inset 0 1px 0 rgba(255,255,255,0.04), inset 0 -1px 0 rgba(0,0,0,0.5)",
      },
      keyframes: {
        "fade-in": {
          "0%": { opacity: "0", transform: "translateY(4px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "die-tumble": {
          "0%": { transform: "rotate(0deg) scale(0.92)" },
          "100%": { transform: "rotate(360deg) scale(1)" },
        },
        "die-settle": {
          "0%": { transform: "scale(1.25)" },
          "60%": { transform: "scale(0.92)" },
          "100%": { transform: "scale(1)" },
        },
      },
      animation: {
        "fade-in": "fade-in 180ms ease-out",
        "die-tumble": "die-tumble 250ms linear infinite",
        "die-settle": "die-settle 320ms ease-out",
      },
    },
  },
  plugins: [],
};
