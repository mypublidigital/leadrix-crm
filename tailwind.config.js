/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Marca Consulcard — Azul (#354454) como primária, Verde (#8DC63F) como acento.
        brand: {
          50: '#f4f5f7',
          100: '#e5e8eb',
          200: '#ccd2d9',
          300: '#a6b0bb',
          400: '#6f7d8c',
          500: '#354454', // Azul Consulcard (primária)
          600: '#2b3844',
          700: '#232d37',
          800: '#1c242c',
          900: '#151b21',
          950: '#0e1216',
        },
        accent: {
          50: '#f2f9e8',
          100: '#e3f2ce',
          200: '#cbe8a4',
          300: '#aed86f',
          400: '#97cd4f',
          500: '#8dc63f', // Verde Consulcard
          600: '#6fa62c',
          700: '#567f24',
          800: '#456420',
          900: '#3a531e',
        },
        ink: {
          50: '#f5f7f8',
          100: '#eaedf0',
          200: '#d4dae0',
          300: '#aab4bf',
          400: '#7e8b99',
          500: '#5c6875',
          600: '#48535e',
          700: '#3b4550',
          800: '#354454', // alinhado ao Azul Consulcard
          900: '#232d37',
          950: '#161d24',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'Segoe UI', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
