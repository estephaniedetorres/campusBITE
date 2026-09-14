/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Theme: only #432818 #BB9457 #FFE6A7 #DDA15E #BC6C25 - no white
        brand: {
          50: '#FFE6A7',
          100: '#FFE6A7',  // lightest - main bg
          200: '#FFE6A7',
          300: '#DDA15E',  // light golden - borders
          400: '#BB9457',  // tan
          500: '#BB9457',  // tan - secondary
          600: '#BC6C25',  // rust - primary CTA / hover
          700: '#432818',  // darkest - header/nav
          800: '#432818',
          900: '#432818',
        },
        cream: '#FFE6A7',
        tan: '#BB9457',
        gold: '#DDA15E',
        rust: '#BC6C25',
        ink: '#432818',
        latte: '#DDA15E',
        umber: '#BC6C25',
        espresso: '#432818',
        chocolate: '#BC6C25',
        sienna: '#BB9457',
      }
    }
  },
  plugins: []
};
