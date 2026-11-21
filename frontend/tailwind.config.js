/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}'
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'Consolas', 'monospace']
      },
      animation: {
        'pulse-fast': 'pulse 1s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'hit-glow': 'hitGlow 1.3s ease-out forwards'
      },
      keyframes: {
        hitGlow: {
          '0%': { transform: 'scale(1.03)', filter: 'drop-shadow(0 0 18px rgba(16, 185, 129, 0.95))' },
          '100%': { transform: 'scale(1)', filter: 'drop-shadow(0 0 0px rgba(16, 185, 129, 0))' }
        }
      }
    }
  },
  plugins: []
};
