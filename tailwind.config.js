/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        "./src/**/*.{js,jsx,ts,tsx}",
    ],
    theme: {
        extend: {
            fontFamily: {
                sans: ['Inter', 'sans-serif'],
            },
            colors: {
                'brand-blue': '#0071e3',
                'brand-dark': '#1d1d1f',
                'brand-gray': '#86868b',
                'brand-light': '#d2d2d7',
            }
        },
    },
    plugins: [],
}
