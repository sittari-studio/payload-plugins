/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{ts,tsx}'],
  corePlugins: {
    preflight: false,
  },
  prefix: 'st-',
  theme: {
    extend: {
      borderRadius: {
        md: 'var(--style-radius-m)',
        sm: 'var(--style-radius-s)',
      },
      boxShadow: {
        card: '0 8px 22px color-mix(in srgb, var(--theme-elevation-1000) 8%, transparent)',
        focus: '0 0 0 2px var(--theme-success-400)',
        popover:
          '0 8px 24px color-mix(in srgb, var(--theme-elevation-1000) 12%, transparent)',
      },
      colors: {
        blue: {
          100: 'var(--theme-blue-100)',
          600: 'var(--theme-blue-600)',
          700: 'var(--theme-blue-700)',
        },
        elevation: {
          0: 'var(--theme-elevation-0)',
          50: 'var(--theme-elevation-50)',
          100: 'var(--theme-elevation-100)',
          150: 'var(--theme-elevation-150)',
          200: 'var(--theme-elevation-200)',
          250: 'var(--theme-elevation-250)',
          300: 'var(--theme-elevation-300)',
          400: 'var(--theme-elevation-400)',
          450: 'var(--theme-elevation-450)',
          500: 'var(--theme-elevation-500)',
          550: 'var(--theme-elevation-550)',
          600: 'var(--theme-elevation-600)',
          700: 'var(--theme-elevation-700)',
          800: 'var(--theme-elevation-800)',
        },
        error: {
          100: 'var(--theme-error-100)',
          500: 'var(--theme-error-500)',
          700: 'var(--theme-error-700)',
        },
        foreground: 'var(--theme-text)',
        input: 'var(--theme-input-bg)',
        success: {
          100: 'var(--theme-success-100)',
          400: 'var(--theme-success-400)',
          500: 'var(--theme-success-500)',
          700: 'var(--theme-success-700)',
        },
        warning: {
          100: 'var(--theme-warning-100)',
          700: 'var(--theme-warning-700)',
          800: 'var(--theme-warning-800)',
        },
      },
      fontFamily: {
        body: 'var(--font-body)',
        mono: 'var(--font-mono)',
      },
      spacing: {
        base: 'var(--base)',
        'base-25': 'calc(var(--base) * .25)',
        'base-35': 'calc(var(--base) * .35)',
        'base-40': 'calc(var(--base) * .4)',
        'base-45': 'calc(var(--base) * .45)',
        'base-50': 'calc(var(--base) * .5)',
        'base-55': 'calc(var(--base) * .55)',
        'base-60': 'calc(var(--base) * .6)',
        'base-65': 'calc(var(--base) * .65)',
        'base-70': 'calc(var(--base) * .7)',
        'base-75': 'calc(var(--base) * .75)',
        'base-125': 'calc(var(--base) * 1.25)',
        'base-150': 'calc(var(--base) * 1.5)',
      },
    },
  },
};
