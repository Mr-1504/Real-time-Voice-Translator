/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Màu sắc giao diện phù hợp cho chế độ dịch song song
        speaker1: '#3b82f6', // Xanh dương cho Speaker 1
        speaker2: '#10b981', // Xanh lục cho Speaker 2
      },
    },
  },
  plugins: [],
}