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
          50: '#fefce8',
          100: '#fef9c3',
          200: '#fef08a',
          300: '#fde047',
          400: '#facc15',
          500: '#C9A96E',
          600: '#B8954A',
          700: '#92702E',
          800: '#6B5220',
          900: '#463512',
        },
        cream: {
          50: '#FFFDF7',
          100: '#FFF9EB',
          200: '#FFF3D6',
          300: '#FFECC2',
          400: '#FFE0A3',
        },
        sage: {
          50: '#f6f7f4',
          100: '#e8ebe3',
          200: '#d1d7c7',
          300: '#b1bca2',
          400: '#8fa07b',
          500: '#6f8560',
          600: '#566a4a',
          700: '#44543b',
          800: '#394532',
          900: '#313b2c',
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
      },
      animation: {
        'fade-in': 'fadeIn 1s ease-out forwards',
        'fade-in-up': 'fadeInUp 0.8s ease-out forwards',
        'fade-in-down': 'fadeInDown 0.8s ease-out forwards',
        'scale-in': 'scaleIn 0.6s ease-out forwards',
        'float': 'float 6s ease-in-out infinite',
        'shimmer': 'shimmer 2s ease-in-out infinite',
        'seal-break': 'sealBreak 0.8s ease-out forwards',
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
