/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Smartisan-inspired design tokens for ClaimLex
        background: 'var(--smartisan-background)',
        foreground: 'var(--smartisan-foreground)',
        card: {
          DEFAULT: 'var(--smartisan-card)',
          foreground: 'var(--smartisan-card-foreground)',
        },
        popover: {
          DEFAULT: 'var(--smartisan-popover)',
          foreground: 'var(--smartisan-popover-foreground)',
        },
        primary: {
          DEFAULT: 'var(--smartisan-primary)',
          foreground: 'var(--smartisan-primary-foreground)',
        },
        muted: {
          DEFAULT: 'var(--smartisan-muted)',
          foreground: 'var(--smartisan-muted-foreground)',
        },
        border: 'var(--smartisan-border)',
        input: 'var(--smartisan-input)',
        ring: 'var(--smartisan-ring)',
        // Extended semantic tokens
        ink: {
          DEFAULT: 'var(--smartisan-ink)',
          2: 'var(--smartisan-ink-2)',
          3: 'var(--smartisan-ink-3)',
        },
        line: {
          DEFAULT: 'var(--smartisan-line)',
          strong: 'var(--smartisan-line-strong)',
        },
        brand: {
          DEFAULT: 'var(--smartisan-brand)',
          hover: 'var(--smartisan-brand-hover)',
          ink: 'var(--smartisan-brand-ink)',
        },
        state: {
          success: 'var(--smartisan-state-success)',
          warning: 'var(--smartisan-state-warning)',
          error: 'var(--smartisan-state-error)',
          info: 'var(--smartisan-state-info)',
        },
      },
      borderRadius: {
        sm: 'var(--smartisan-radius-sm)',
        md: 'var(--smartisan-radius-md)',
        lg: 'var(--smartisan-radius-lg)',
      },
      fontFamily: {
        sans: ['Inter', '"Noto Sans SC"', '"PingFang SC"', '"Microsoft YaHei"', 'system-ui', 'sans-serif'],
        mono: ['"SF Mono"', '"Menlo"', '"Monaco"', '"Consolas"', '"Noto Sans SC"', 'monospace'],
      },
      boxShadow: {
        'smartisan-1': 'var(--smartisan-shadow-1)',
        'smartisan-2': 'var(--smartisan-shadow-2)',
        'smartisan-3': 'var(--smartisan-shadow-3)',
      },
      maxWidth: {
        '5xl': '64rem',
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-down': {
          '0%': { opacity: '0', transform: 'translateY(-8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'scale-in': {
          '0%': { opacity: '0', transform: 'scale(0.96)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 200ms ease-out',
        'slide-down': 'slide-down 200ms ease-out',
        'scale-in': 'scale-in 150ms ease-out',
      },
    },
  },
  plugins: [],
}
