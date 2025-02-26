/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
      "./src/**/*.{js,jsx,ts,tsx}",
    ],
    theme: {
      extend: {
        colors: {
          primary: '#2D1573',
          secondary: '#6949FF',
          'card-bg': '#3B1D8F',
        },
        animation: {
          progress: 'progress 1.5s ease-in-out infinite',
          bounce: 'bounce 1s infinite',
        },
        keyframes: {
          progress: {
            '0%': { width: '0%' },
            '50%': { width: '100%' },
            '100%': { width: '0%' },
          },
        },
      },
    },
    plugins: [],
  }