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
