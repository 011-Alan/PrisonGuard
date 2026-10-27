/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bgMain: '#080d1a',
        bgCard: '#0f172a',
        borderMuted: '#1e293b',
        borderSubtle: '#334155',
      }
    },
  },
  plugins: [],
}
