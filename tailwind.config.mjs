/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        'rc-black': '#050505',
        'rc-charcoal': '#151515',
        'rc-charcoal-2': '#1e1e1e',
        'rc-purple': '#7024C9',
        'rc-purple-light': '#9153E8',
        'rc-purple-dark': '#4E1893',
        'rc-lime': '#A7D500',
        'rc-lime-light': '#C4F229',
        'rc-lime-dark': '#7DA300',
        'rc-white': '#FFFFFF',
        'rc-silver': '#C8C8C8',
        'rc-silver-dark': '#8C8C8C',
      },
      fontFamily: {
        display: ['"Rajdhani"', '"Archivo Black"', 'sans-serif'],
        heading: ['"Barlow Condensed"', 'sans-serif'],
        body: ['"Inter"', 'system-ui', 'sans-serif'],
      },
      backgroundImage: {
        'rc-gradient': 'linear-gradient(135deg, #7024C9 0%, #4E1893 45%, #050505 100%)',
        'rc-gradient-lime': 'linear-gradient(135deg, #A7D500 0%, #7DA300 100%)',
        'rc-radial-glow': 'radial-gradient(circle at 50% 0%, rgba(112,36,201,0.35), transparent 60%)',
        'court-lines': "linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)",
      },
      boxShadow: {
        'glow-purple': '0 0 40px rgba(112,36,201,0.45)',
        'glow-lime': '0 0 40px rgba(167,213,0,0.4)',
        'card': '0 10px 40px rgba(0,0,0,0.5)',
      },
      animation: {
        'float-slow': 'float 8s ease-in-out infinite',
        'spin-slow': 'spin 14s linear infinite',
        'pulse-glow': 'pulseGlow 3s ease-in-out infinite',
        'marquee': 'marquee 30s linear infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-16px)' },
        },
        pulseGlow: {
          '0%, 100%': { opacity: '0.55' },
          '50%': { opacity: '1' },
        },
        marquee: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
      },
      maxWidth: {
        content: '1440px',
      },
    },
  },
  plugins: [],
};
