import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#17202a',
        lagoon: '#087f8c',
        canopy: '#247a4d',
        ember: '#d95d39',
        marigold: '#f6ae2d',
      },
      boxShadow: {
        soft: '0 18px 48px rgba(15, 23, 42, 0.12)',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
} satisfies Config;
