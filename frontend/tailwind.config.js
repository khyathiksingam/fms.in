/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f0f7ff',
          100: '#e0effe',
          200: '#b9dffe',
          300: '#7cc2fd',
          400: '#36a2fa',
          500: '#0c87eb',
          600: '#026bc9',
          700: '#0255a2',
          800: '#064985',
          900: '#0b3d6f',
          950: '#07264a',
        },
      },
    },
  },
  plugins: [],
}
