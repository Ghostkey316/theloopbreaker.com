/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Dark ember/fire theme
        'ember-bg': '#0A0A0C',
        'ember-surface': '#1A1A1E',
        'ember-surface-light': '#2A2A2E',
        'ember-text': '#ECEDEE',
        'ember-text-muted': '#9BA1A6',
        'ember-accent': '#FF6B35',
        'ember-accent-dark': '#E55A24',
        'ember-accent-light': '#FF8C5A',
        'base-accent': '#00D9FF',
        'avalanche-accent': '#E84142',
      },
      fontFamily: {
        sans: ['system-ui', 'sans-serif'],
      },
      spacing: {
        'sidebar': '280px',
      },
    },
  },
  plugins: [],
};
