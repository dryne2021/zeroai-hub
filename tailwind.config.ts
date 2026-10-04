import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: "#14213D", soft: "#24365C", faint: "#E8ECF4" },
        night: { DEFAULT: "#0F1A33", soft: "#18264A" },
        mint: "#7FD3A8",
        paper: "#F5F6F8",
        seal: { DEFAULT: "#1E7B4F", dark: "#165C3B", faint: "#E4F2EA" },
        thread: "#D9DEE7",
        muted: "#5B6578",
        amber: { DEFAULT: "#9A6412", faint: "#FBF0DC" },
        danger: { DEFAULT: "#B42318", faint: "#FDECEA" },
      },
      fontFamily: {
        display: ['"Bricolage Grotesque Variable"', "system-ui", "sans-serif"],
        sans: ['"Public Sans Variable"', "system-ui", "sans-serif"],
      },
      borderRadius: { panel: "14px", control: "8px" },
      maxWidth: { content: "72rem" },
    },
  },
  plugins: [],
} satisfies Config;
