/** @type {import('tailwindcss').Config} */
// Baseline design tokens are placeholders; the finalized palette, spacing scale,
// and type ramp are owned by UX in a later sprint (see ADR-001).
module.exports = {
  content: ['./app/**/*.{js,jsx,ts,tsx}', './components/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        // Placeholder brand palette — replace with finalized UX tokens.
        brand: {
          50: '#eef6ff',
          100: '#d9ebff',
          500: '#2f7ed8',
          600: '#1f63b3',
          700: '#184e8c',
        },
        surface: {
          light: '#ffffff',
          dark: '#0f172a',
        },
        muted: '#666666',
      },
      spacing: {
        // Placeholder 4pt-based spacing tokens.
        xs: '4px',
        sm: '8px',
        md: '16px',
        lg: '24px',
        xl: '32px',
      },
      fontSize: {
        // Placeholder type ramp.
        caption: ['12px', { lineHeight: '16px' }],
        body: ['16px', { lineHeight: '24px' }],
        title: ['24px', { lineHeight: '32px' }],
      },
    },
  },
  plugins: [],
};
