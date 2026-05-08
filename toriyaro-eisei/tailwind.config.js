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
        sans: [
          '"Yu Gothic"',
          'YuGothic',
          '"游ゴシック"',
          '"游ゴシック体"',
          '"Hiragino Kaku Gothic ProN"',
          '"ヒラギノ角ゴ ProN W3"',
          '"Meiryo"',
          'system-ui',
          'sans-serif',
        ],
        display: [
          '"Yu Gothic"',
          'YuGothic',
          '"游ゴシック"',
          '"游ゴシック体"',
          '"Hiragino Kaku Gothic ProN"',
          '"ヒラギノ角ゴ ProN W3"',
          '"Meiryo"',
          'sans-serif',
        ],
        mono: [
          '"Yu Gothic"',
          'YuGothic',
          '"游ゴシック"',
          'ui-monospace',
          'monospace',
        ],
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
          '0%': { transform: 'translateY(100%)' },
          '100%': { transform: 'translateY(0)' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
      },
      animation: {
        pulseDot: 'pulseDot 2s ease-in-out infinite',
        slideUp: 'slideUp 0.3s ease-out',
        fadeIn: 'fadeIn 0.2s ease-out',
      },
    },
  },
  plugins: [],
};
