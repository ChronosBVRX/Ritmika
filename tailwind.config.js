/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./public/**/*.html",
    "./public/**/*.js",
    "./server/**/*.js"
  ],
  theme: {
    extend: {
      colors: {
        'neon-pink':   '#ec4899',
        'neon-cyan':   '#22d3ee',
        'neon-purple': '#a855f7',
        'neon-yellow': '#facc15',
        'antro-bg':    '#0f172a',
        'antro-card':  '#1e293b',
        'jb-magenta':  '#f0047f',
        'jb-cyan':     '#00e5ff',
        'jb-yellow':   '#ffe600',
        'jb-lime':     '#b8ff57',
        'jb-orange':   '#ff6b00',
        'jb-purple':   '#9b00ff',
      },
      fontFamily: {
        outfit:  ['Outfit', 'sans-serif'],
        fredoka: ['Fredoka', 'sans-serif'],
        paytone: ['Paytone One', 'sans-serif'],
      },
      rotate: {
        '1.5': '1.5deg',
        '-1.5': '-1.5deg',
        '2.5': '2.5deg',
        '-2.5': '-2.5deg'
      },
    },
  },
  plugins: [],
}
