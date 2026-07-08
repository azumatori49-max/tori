/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eff8ff',
          100: '#dbeefe',
          200: '#bfe3fe',
          300: '#93d2fd',
          400: '#60b8fa',
          500: '#3b9af6',
          600: '#257ceb',
          700: '#1d65d8',
          800: '#1e52af',
          900: '#1e478a',
          950: '#172c54',
        },
      },
      fontFamily: {
        sans: [
          '"Hiragino Sans"',
          '"Hiragino Kaku Gothic ProN"',
          '"Noto Sans JP"',
          'Meiryo',
          'system-ui',
          'sans-serif',
        ],
      },
    },
  },
  plugins: [],
}
