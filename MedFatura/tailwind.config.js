/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/react-app/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f3e9df',
          100: '#eedbca',
          200: '#e6c4a6',
          300: '#d9ad87',
          400: '#c18a66',
          500: '#a96b4c',
          600: '#8f573e',
          700: '#744632',
          800: '#5c3929',
          900: '#4a2f22',
        },
      },
    },
  },
  plugins: [],
};
