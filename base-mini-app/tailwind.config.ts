import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        base: {
          blue: '#0052FF',
          'blue-dark': '#0049E0',
          'blue-light': '#1A6CFF',
          black: '#000000',
          white: '#FFFFFF',
          gray: {
            50: '#F7F8F9',
            100: '#EBEDEF',
            200: '#D4D7DC',
            300: '#B8BCC4',
            400: '#9CA1AC',
            500: '#808694',
            600: '#646B7C',
            700: '#485064',
            800: '#2C354C',
            900: '#101A34',
          },
        },
        vaultfire: {
          purple: '#8B5CF6',
          'purple-dark': '#7C3AED',
          'purple-light': '#A78BFA',
          green: '#10B981',
          'green-dark': '#059669',
          red: '#EF4444',
          'red-dark': '#DC2626',
        },
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-base': 'linear-gradient(135deg, #0052FF 0%, #7C3AED 100%)',
        'gradient-vaultfire': 'linear-gradient(135deg, #8B5CF6 0%, #0052FF 100%)',
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-in-out',
        'slide-up': 'slideUp 0.5s ease-out',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'shimmer': 'shimmer 2s linear infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-1000px 0' },
          '100%': { backgroundPosition: '1000px 0' },
        },
      },
    },
  },
  plugins: [],
}
export default config
