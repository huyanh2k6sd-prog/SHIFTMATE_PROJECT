/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    darkMode: 'class',
    theme: {
        extend: {
            colors: {
                "border-color": "var(--color-border-color)",
                "primary": "#99ffda",
                "primary-dark": "#34d399",
                "background-light": "#f5f8f7",
                "background-dark": "#0f231c",
                "neutral-100": "#e6f4ef",
                "neutral-200": "#cdeadf",
                "neutral-800": "#0c1d17",
                "neutral-600": "#45a17f",
                "brand-navy": "#0A3F2F",
            },
            fontFamily: {
                'display': ['Plus Jakarta Sans', 'sans-serif'],
            },
            borderRadius: {
                "DEFAULT": "0.5rem",
                "lg": "1rem",
                "xl": "1.5rem",
                "full": "9999px"
            },
        },
    },
    plugins: [],
}
