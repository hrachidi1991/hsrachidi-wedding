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
        gold: {
          50: '#f2f5f1',
          100: '#e0e8de',
          200: '#c1d1bc',
          300: '#8faa87',
          400: '#6B8A65',
          500: '#546A50',
          600: '#476043',
          700: '#3a5036',
          800: '#2e4029',
          900: '#162013',
        },
        cream: {
          50: '#F5F5F3',
          100: '#EDEDEB',
          200: '#E8E7E5',
          300: '#DDDCDA',
          400: '#CFCECC',
        },
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
        olive: {
          50: '#f2f5f1',
          100: '#e0e8de',
          200: '#c1d1bc',
          300: '#8faa87',
          400: '#546A50',
          500: '#476043',
          600: '#3a5036',
          700: '#2e4029',
          800: '#22301e',
          900: '#162013',
        },
        charcoal: {
          50: '#f6f6f6',
          100: '#e7e7e7',
          200: '#d1d1d1',
          300: '#b0b0b0',
          400: '#888888',
          500: '#6d6d6d',
          600: '#5d5d5d',
          700: '#4f4f4f',
          800: '#3d3d3d',
          900: '#2a2a2a',
          950: '#1a1a1a',
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
