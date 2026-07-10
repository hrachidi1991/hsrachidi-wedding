import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Monochrome ink accent (pure black & white film reskin — no emerald)
        gold: {
          50: '#F7F7F5',
          100: '#E7E6E4',
          200: '#D1CFCB',
          300: '#B0ACA6',
          400: '#8A857D',
          500: '#6B655C',
          600: '#4A463F',
          700: '#38342E',
          800: '#2A2724',
          900: '#1C1A18',
        },
        // Paper / luminous light grounds
        cream: {
          50: '#F7F7F5',
          100: '#EFEEEA',
          200: '#E4E3DE',
          300: '#DAD9D3',
          400: '#CFCEC8',
        },
        // Neutral grayscale (retired sage tint → true gray)
        sage: {
          50: '#f5f5f5',
          100: '#e8e8e8',
          200: '#d4d4d4',
          300: '#b8b8b8',
          400: '#a3a3a3',
          500: '#9B9B9B',
          600: '#8A8A8A',
          700: '#858585',
          800: '#6b6b6b',
          900: '#525252',
        },
        // olive aliased to the same grayscale ramp so legacy text-olive-* reads mono
        olive: {
          50: '#F7F7F5',
          100: '#E7E6E4',
          200: '#D1CFCB',
          300: '#B0ACA6',
          400: '#8A857D',
          500: '#6B655C',
          600: '#4A463F',
          700: '#38342E',
          800: '#2A2724',
          900: '#1C1A18',
        },
        // Ink charcoal (minimal black)
        charcoal: {
          50: '#f6f6f5',
          100: '#e7e6e4',
          200: '#d1cfcb',
          300: '#b0aca6',
          400: '#8a857d',
          500: '#6B655C',
          600: '#57524a',
          700: '#4A463F',
          800: '#38342e',
          900: '#2A2724',
          950: '#1c1a18',
        },
      },
      fontFamily: {
        display: ['Cormorant Garamond', 'serif'],
        body: ['Lora', 'serif'],
        arabic: ['Amiri', 'serif'],
        arabicDisplay: ['Aref Ruqaa', 'serif'],
        script: ['Great Vibes', 'cursive'],
        trajan: ['Cinzel', 'serif'],
      },
      animation: {
        'fade-in': 'fadeIn 1s ease-out forwards',
        'fade-in-up': 'fadeInUp 0.8s ease-out forwards',
        'fade-in-down': 'fadeInDown 0.8s ease-out forwards',
        'scale-in': 'scaleIn 0.6s ease-out forwards',
        'float': 'float 6s ease-in-out infinite',
        'shimmer': 'shimmer 2s ease-in-out infinite',
        'seal-break': 'sealBreak 0.8s ease-out forwards',
        'seal-break-gold': 'sealBreakGold 700ms ease-out forwards',
        'envelope-open': 'envelopeOpen 1.2s ease-out forwards',
        'slide-up': 'slideUp 0.6s ease-out forwards',
        'pulse-soft': 'pulseSoft 2s ease-in-out infinite',
        'count-tick': 'countTick 0.3s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(30px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeInDown: {
          '0%': { opacity: '0', transform: 'translateY(-30px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.9)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        shimmer: {
          '0%, 100%': { opacity: '0.5' },
          '50%': { opacity: '1' },
        },
        sealBreak: {
          '0%': { transform: 'scale(1) rotate(0deg)', opacity: '1' },
          '50%': { transform: 'scale(1.3) rotate(15deg)', opacity: '0.8' },
          '100%': { transform: 'scale(0) rotate(45deg)', opacity: '0' },
        },
        sealBreakGold: {
          '0%': { transform: 'scale(1)', opacity: '1' },
          '30%': { transform: 'scale(1.25)', opacity: '1' },
          '100%': { transform: 'scale(0)', opacity: '0' },
        },
        envelopeOpen: {
          '0%': { transform: 'rotateX(0deg)' },
          '100%': { transform: 'rotateX(180deg)' },
        },
        slideUp: {
          '0%': { transform: 'translateY(100%)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '0.6' },
          '50%': { opacity: '1' },
        },
        countTick: {
          '0%': { transform: 'scale(1.1)' },
          '100%': { transform: 'scale(1)' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
