/** @type {import('tailwindcss').Config} */
// Paleta Leadrix (skill leadrix-design): preto quente #1D1D1B, azul #2D7FF9 como
// cor de interação, verde #48AD46 reservado à marca e a sinais de resultado/IA.
// A área de trabalho é clara (densa em dados); a moldura (menu) é preta.
export default {
  content: { relative: true, files: ['./index.html', './src/**/*.{js,jsx}'] },
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#EEF5FF',
          100: '#DCEAFE',
          200: '#BBD5FD',
          300: '#93BEFD',
          400: '#5C9DFB',
          500: '#2D7FF9', // azul Leadrix (interação)
          600: '#2266E6',
          700: '#1A54BF',
          800: '#12408F',
          900: '#0D2F69',
          950: '#081D42',
        },
        accent: {
          50: '#EEF8EE',
          100: '#DDF2DC',
          200: '#BDE5BC',
          300: '#8FD68D',
          400: '#66C264',
          500: '#48AD46', // verde da marca
          600: '#3A9438',
          700: '#2E7A2C',
          800: '#265F25',
          900: '#1F4D1E',
        },
        ink: {
          50: '#F6F6F4',
          100: '#ECECEA',
          200: '#DADAD6',
          300: '#BEBEB9',
          400: '#9A9A94',
          500: '#74746F',
          600: '#52524F',
          700: '#3A3A38',
          800: '#2A2A28',
          900: '#1D1D1B', // preto Leadrix
          950: '#0E0E0D',
        },
      },
      fontFamily: {
        sans: ['Manrope', 'system-ui', 'Segoe UI', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'],
        display: ['Jost', 'Century Gothic', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
    },
  },
  plugins: [],
}
