/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#08090b',
          900: '#0d0f13',
          850: '#12151a',
          800: '#181c23',
          700: '#22272f',
          600: '#2e343e',
          500: '#414855',
          400: '#6b7280',
          300: '#9aa1ad',
          200: '#c7ccd4',
          100: '#e8eaee',
        },
        accent: { DEFAULT: '#d9c5a0', soft: '#f0e6d2' },
      },
      fontFamily: {
        ui: ['Inter', 'system-ui', 'sans-serif'],
        display: ['"Instrument Serif"', 'Georgia', 'serif'],
      },
    },
  },
  plugins: [],
};
