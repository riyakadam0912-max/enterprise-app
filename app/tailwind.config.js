/** @type {import('tailwindcss').Config} */
module.exports = { content: ['./app/**/*.{js,jsx,ts,tsx}', './src/**/*.{js,jsx,ts,tsx}'], darkMode: 'class', presets: [require('nativewind/preset')], theme: { extend: { colors: { ink: '#172033', ember: '#ea580c', mist: '#f8fafc' } } }, plugins: [] };
