/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#f4f6fa',
        surface: '#ffffff',
        surface2: '#edf1f7',
        border: '#dfe5ee',
        accent: '#1657c4',
        'accent-deep': '#0d3d91',
        ok: '#1a7a3c',
        'ok-bg': '#e8f5ed',
        warn: '#c47d00',
        'warn-bg': '#fff8e6',
        ng: '#c0392b',
        'ng-bg': '#fdecea',
        text: '#17202b',
        'text-muted': '#64707f',
      },
      fontFamily: {
        sans: ['"Noto Sans JP"', 'system-ui', 'sans-serif'],
      },
      maxWidth: {
        app: '640px',
      },
      animation: {
        pulse: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'slide-up': 'slideUp 0.3s ease-out',
        'fade-in': 'fadeIn 0.2s ease-out',
      },
      keyframes: {
        slideUp: {
          '0%': { transform: 'translateY(100%)' },
          '100%': { transform: 'translateY(0)' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
      },
    },
  },
  plugins: [],
};
