/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./App.tsx",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        'poppins': ['Poppins', 'sans-serif'],
        'inter': ['Inter', 'sans-serif'],
      },
      colors: {
        'pc-primary': '#0052FF',
        'pc-accent': '#00C49A',
        'pc-text': '#1E2A3B',
        'pc-neutral': '#F0F4F8',
      },
      screens: {
        'xs': '475px',
      },
    },
  },
  plugins: [],
}