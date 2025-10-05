const defaultTheme = require('tailwindcss/defaultTheme')

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', '"Noto Sans JP"', ...defaultTheme.fontFamily.sans],
        heading: ['"Plus Jakarta Sans"', '"Noto Sans JP"', ...defaultTheme.fontFamily.sans]
      }
    }
  },
  plugins: []
}
