/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        stone: {
          50: '#FAFAF9',
          100: '#F5F5F4',
          200: '#E7E5E4',
          300: '#D6D3D1',
          400: '#A8A29E',
          500: '#78716C',
          600: '#57534E',
          700: '#44403C',
          800: '#292524',
          900: '#1C1917',
        },
        fork: {
          green: '#0F4C4A',
          greenSoft: '#E6F2F0',
          greenDark: '#0A3330',
        },
        cb: {
          orange: '#EA580C',
          orangeSoft: '#FFF1E6',
        }
      },
      fontFamily: {
        serif: ['Cormorant Garamond', 'ui-serif', 'Georgia', 'serif'],
        sans: ['Inter', 'DM Sans', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        fork: '0 2px 16px rgba(28,25,23,0.06), 0 1px 3px rgba(28,25,23,0.04)',
        forkHover: '0 8px 24px rgba(28,25,23,0.08), 0 4px 8px rgba(28,25,23,0.04)',
      },
      borderRadius: {
        '4xl': '28px',
      }
    }
  },
  plugins: []
};
