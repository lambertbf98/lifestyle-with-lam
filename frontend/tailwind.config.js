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
        // New dark theme - warmer, richer colors
        dark: {
          950: '#09090b',    // Almost black
          900: '#0c0c10',    // Deep dark
          800: '#151518',    // Card backgrounds
          700: '#1f1f23',    // Elevated surfaces
          600: '#2a2a30',    // Borders
          500: '#3f3f46',    // Muted elements
        },
        // Vibrant accent palette
        accent: {
          primary: '#f97316',    // Warm orange
          secondary: '#8b5cf6',  // Violet purple
          success: '#22c55e',    // Emerald green
          warning: '#eab308',    // Golden yellow
          danger: '#ef4444',     // Red
          info: '#06b6d4',       // Cyan
        },
        // Gradient colors
        gradient: {
          start: '#f97316',      // Orange
          mid: '#ec4899',        // Pink
          end: '#8b5cf6',        // Purple
        },
        // Neon/glow effects
        neon: {
          orange: '#f97316',
          pink: '#ec4899',
          purple: '#8b5cf6',
          green: '#22c55e',
          blue: '#3b82f6',
          cyan: '#06b6d4',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'glow-orange': '0 0 20px rgba(249, 115, 22, 0.4)',
        'glow-pink': '0 0 20px rgba(236, 72, 153, 0.4)',
        'glow-purple': '0 0 20px rgba(139, 92, 246, 0.4)',
        'glow-green': '0 0 20px rgba(34, 197, 94, 0.4)',
        'glow-multi': '0 0 30px rgba(249, 115, 22, 0.2), 0 0 60px rgba(236, 72, 153, 0.1)',
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
        'gradient-vibrant': 'linear-gradient(135deg, #f97316 0%, #ec4899 50%, #8b5cf6 100%)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'gradient': 'gradient 8s ease infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
      },
      keyframes: {
        gradient: {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
        glow: {
          '0%': { boxShadow: '0 0 5px rgba(249, 115, 22, 0.5)' },
          '100%': { boxShadow: '0 0 20px rgba(236, 72, 153, 0.8)' },
        }
      }
    },
  },
  plugins: [],
}
