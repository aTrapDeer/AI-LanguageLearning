import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";
import defaultTheme from "tailwindcss/defaultTheme";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  darkMode: ["class"],
  theme: {
  	extend: {
  		fontFamily: {
  			sans: ['var(--font-geist-sans)', ...defaultTheme.fontFamily.sans],
  			mono: ['var(--font-geist-mono)', ...defaultTheme.fontFamily.mono],
  			display: ['var(--font-display)', 'var(--font-geist-sans)', ...defaultTheme.fontFamily.sans]
  		},
  		colors: {
  			// Brand night: the deep indigo/violet the lesson screens are set in.
  			ink: {
  				'50': '#f4f2fb',
  				'100': '#e9e5f8',
  				'200': '#d2cbef',
  				'300': '#aea3de',
  				'400': '#8678c8',
  				'500': '#5f50ad',
  				'600': '#4b4569',
  				'700': '#342c63',
  				'800': '#251c58',
  				'900': '#18123f',
  				'950': '#0e0a29'
  			},
  			// Warm accent for streaks, XP and the one action that matters.
  			ember: {
  				'50': '#fff6ea',
  				'100': '#ffe9c9',
  				'200': '#ffd290',
  				'300': '#ffb957',
  				'400': '#ff9f2e',
  				'500': '#f98212',
  				'600': '#dd6208',
  				'700': '#b5480b',
  				'800': '#923910',
  				'900': '#783011'
  			},
  			paper: {
  				DEFAULT: '#f7f5f0',
  				deep: '#efebe2'
  			},
  			border: 'hsl(var(--border))',
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))',
  			background: 'hsl(var(--background))',
  			foreground: 'hsl(var(--foreground))',
  			primary: {
  				DEFAULT: 'hsl(var(--primary))',
  				foreground: 'hsl(var(--primary-foreground))'
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))'
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			accent: {
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))'
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			},
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
  			chart: {
  				'1': 'hsl(var(--chart-1))',
  				'2': 'hsl(var(--chart-2))',
  				'3': 'hsl(var(--chart-3))',
  				'4': 'hsl(var(--chart-4))',
  				'5': 'hsl(var(--chart-5))'
  			}
  		},
  		animation: {
  			first: 'moveVertical 30s ease infinite',
  			second: 'moveInCircle 20s reverse infinite',
  			third: 'moveInCircle 40s linear infinite',
  			fourth: 'moveHorizontal 40s ease infinite',
  			fifth: 'moveInCircle 20s ease infinite',
  			float: 'float 18s ease-in-out infinite',
  			'soft-ping': 'softPing 2.4s cubic-bezier(0, 0, 0.2, 1) infinite',
  			rise: 'rise 0.8s cubic-bezier(0.2, 0.7, 0.2, 1) both',
  			wave: 'wave 1.1s ease-in-out infinite',
  			'float-slow': 'float 26s ease-in-out infinite reverse'
  		},
  		keyframes: {
  			rise: {
  				from: { opacity: '0', transform: 'translateY(18px)' },
  				to: { opacity: '1', transform: 'translateY(0)' }
  			},
  			softPing: {
  				'0%': { transform: 'scale(1)', opacity: '0.55' },
  				'80%, 100%': { transform: 'scale(1.45)', opacity: '0' }
  			},
  			wave: {
  				'0%, 100%': { transform: 'scaleY(0.35)' },
  				'50%': { transform: 'scaleY(1)' }
  			},
  			float: {
  				'0%, 100%': {
  					transform: 'translate3d(0, 0, 0) scale(1)'
  				},
  				'50%': {
  					transform: 'translate3d(4%, -6%, 0) scale(1.08)'
  				}
  			},
  			moveHorizontal: {
  				'0%': {
  					transform: 'translateX(-50%) translateY(-10%)'
  				},
  				'50%': {
  					transform: 'translateX(50%) translateY(10%)'
  				},
  				'100%': {
  					transform: 'translateX(-50%) translateY(-10%)'
  				}
  			},
  			moveInCircle: {
  				'0%': {
  					transform: 'rotate(0deg)'
  				},
  				'50%': {
  					transform: 'rotate(180deg)'
  				},
  				'100%': {
  					transform: 'rotate(360deg)'
  				}
  			},
  			moveVertical: {
  				'0%': {
  					transform: 'translateY(-50%)'
  				},
  				'50%': {
  					transform: 'translateY(50%)'
  				},
  				'100%': {
  					transform: 'translateY(-50%)'
  				}
  			}
  		},
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)'
  		}
  	}
  },
  plugins: [tailwindcssAnimate],
};

export default config;
