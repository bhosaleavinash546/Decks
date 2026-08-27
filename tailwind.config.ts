import type { Config } from 'tailwindcss'

// Colour lives in tokens.css and nowhere else. These names only forward to the
// custom properties so a class can reference a token without duplicating a hex.
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        void: 'var(--void)',
        panel: 'var(--panel)',
        'panel-up': 'var(--panel-up)',
        legend: 'var(--legend)',
        lamp: 'var(--lamp)',
        hot: 'var(--hot)',
      },
    },
  },
} satisfies Config
