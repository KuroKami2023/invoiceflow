/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f0f6f1',
          100: '#dcebe0',
          200: '#bbd6c3',
          300: '#8fb99b',
          400: '#5f9871',
          500: '#2e7a47',
          600: '#14532d',
          700: '#123f25',
          800: '#0e3320',
          900: '#0a2718',
          950: '#061a10',
        },
        brass: {
          50: '#fbf8ef',
          100: '#f6ecd4',
          200: '#ead5a3',
          300: '#ddb96f',
          400: '#cfa046',
          500: '#c28427',
          600: '#b45309',
          700: '#93400a',
          800: '#773410',
          900: '#5f2a0e',
        },
        paper: {
          50: '#fdfcf8',
          100: '#faf8f1',
          200: '#f4efe1',
          300: '#e9e1ca',
          400: '#d8ccac',
        },
        ink: {
          500: '#5c6b62',
          600: '#3d4a43',
          700: '#2a3530',
          800: '#1d2622',
          900: '#131a17',
        },
      },
      fontFamily: {
        serif: ['"Iowan Old Style"', '"Palatino Linotype"', 'Palatino', 'Georgia', '"Times New Roman"', 'serif'],
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '"Segoe UI"', 'Roboto', '"Helvetica Neue"', 'Arial', 'sans-serif'],
        mono: ['ui-monospace', '"SF Mono"', '"Cascadia Code"', 'Menlo', 'Consolas', '"Liberation Mono"', 'monospace'],
      },
      boxShadow: {
        ledger: '0 1px 2px rgba(20, 83, 45, 0.06), 0 4px 16px -4px rgba(20, 83, 45, 0.10)',
        'ledger-lg': '0 2px 4px rgba(20, 83, 45, 0.08), 0 12px 32px -8px rgba(20, 83, 45, 0.18)',
        stamp: '0 0 0 1px rgba(180, 83, 9, 0.25)',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-400px 0' },
          '100%': { backgroundPosition: '400px 0' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.5s ease-out both',
      },
    },
  },
  plugins: [],
};
