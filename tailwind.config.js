/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: '#1a6b3c', dark: '#145530', light: '#2d8f55' },
        forest: { DEFAULT: '#0F4C3A', dark: '#0B3A2B', light: '#1A5E48' },
        accent: '#f5a623',
        earth: '#5d4e37',
        neutral: { 50: '#F8F9FA', 100: '#FFFFFF' },
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'system-ui', 'sans-serif'],
        display: ['Syne', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
