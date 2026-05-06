/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#f5f4f0',
        surface: '#ffffff',
        surface2: '#f0efe9',
        border: '#e0ddd6',
        accent: '#d4500a',
        ok: '#1a7a3c',
        'ok-bg': '#e8f5ed',
        warn: '#c47d00',
        'warn-bg': '#fff8e6',
        ng: '#c0392b',
        'ng-bg': '#fdecea',
        text: '#1a1a1a',
        'text-muted': '#7a7570',
      },
      fontFamily: {
        sans: ['"Noto Sans JP"', 'system-ui', 'sans-serif'],
        display: ['Syne', '"Noto Sans JP"', 'sans-serif'],
        mono: ['"DM Mono"', 'ui-monospace', 'monospace'],
      },
      maxWidth: {
        app: '640px',
      },
      keyframes: {
        pulseDot: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.4' },
        },
        slideUp: {
          from: { transform: 'translateY(100%)' },
          to: { transform: 'translateY(0)' },
        },
        fadeIn: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        popIn: {
          '0%': { transform: 'scale(0.8)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
      },
      animation: {
        pulseDot: 'pulseDot 1.6s ease-in-out infinite',
        slideUp: 'slideUp 0.28s ease-out',
        fadeIn: 'fadeIn 0.2s ease-out',
        popIn: 'popIn 0.32s cubic-bezier(0.34, 1.56, 0.64, 1)',
      },
    },
  },
  plugins: [],
};
