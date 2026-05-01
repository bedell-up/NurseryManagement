/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        forest: {
          50:  '#f2f7f2',
          100: '#e0ede0',
          200: '#c2dbc3',
          300: '#97c099',
          400: '#669e69',
          500: '#4a8a4d',
          600: '#376e3a',
          700: '#2d5830',
          800: '#264628',
          900: '#1f3a22',
          950: '#0f1f12',
        },
        earth: {
          50:  '#fdf8f0',
          100: '#faefd9',
          200: '#f3dbb1',
          300: '#eac17f',
          400: '#e0a04d',
          500: '#d4852c',
          600: '#bc6a21',
          700: '#9c511e',
          800: '#7e4020',
          900: '#67351d',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        serif: ['HandCraftedA', 'Lora', 'Georgia', 'serif'],
      },
    },
  },
  plugins: [],
}
