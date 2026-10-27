/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bgMain: '#0b0f19',
        bgCard: '#111827',
        bgCardHover: '#162032',
        borderMuted: '#1e293b',
        borderSubtle: '#2d3748',
        brandRed: '#ef4444',
        brandAmber: '#f59e0b',
        brandGreen: '#10b981',
        brandCyan: '#06b6d4',
        brandBlue: '#3b82f6',
      }
    },
  },
  plugins: [],
}
