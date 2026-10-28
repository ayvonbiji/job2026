/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        cream: { 50: '#fffdf8', 100: '#fbf7ee', 200: '#f3ecdc', 300: '#e7dcc4' },
        navy: { 50: '#eef2f9', 100: '#d9e1ef', 300: '#8fa3c7', 500: '#2f5aa8', 600: '#244a8c', 700: '#1c3a6e', 800: '#15294d', 900: '#0f1d38' },
        gold: { 50: '#fbf4e4', 100: '#f4e4bd', 300: '#dcb866', 500: '#b07d12', 600: '#8f650d', 700: '#6e4d0a' },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'Segoe UI', 'Roboto', 'sans-serif'],
        serif: ['"Cormorant Garamond"', 'Georgia', 'serif'],
      },
      boxShadow: { card: '0 1px 2px rgba(15,29,56,0.04), 0 4px 16px rgba(15,29,56,0.05)' },
    },
  },
  plugins: [],
}
