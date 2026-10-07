/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Colores dominicanos oficiales
        'dominican-blue': '#002D62',
        'dominican-red': '#CE1126',
        'dominican-white': '#FFFFFF',
        // Variaciones para mejor UX
        'dominican-blue-light': '#004085',
        'dominican-blue-dark': '#001A3A',
        'dominican-red-light': '#E8253A',
        'dominican-red-dark': '#A50E1E',
        // Acentos caribeños para la sala de juego
        'larimar': '#0E9AA7',
        'ambar': '#D98A00',
        'palma': '#1F8F4E',
        'arena': '#FFF6E5',
      },
      fontFamily: {
        // Títulos y números grandes de la sala de juego
        display: ['"Lilita One"', 'system-ui', 'sans-serif'],
      },
      animation: {
        'pulse-fast': 'pulse 1s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'bounce-subtle': 'bounce 2s infinite',
      }
    },
  },
  plugins: [],
}