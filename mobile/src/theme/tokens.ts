import { useColorScheme } from 'react-native';

// Design tokens: every colour in the app comes from here. The names and values mirror
// web/src/index.css so both apps look like the same product; change them in both places.
// Dark mode only swaps the values, so components read colours through useTokens() and never
// check the colour scheme themselves.
const light = {
  canvas: '#f5f6f8', // screen background
  surface: '#ffffff', // cards
  surfaceMuted: '#f0f2f5', // inputs, tracks
  line: '#e3e6eb', // borders and dividers
  ink: '#101828', // main text
  muted: '#586174', // secondary text
  subtle: '#8a92a2', // hints, placeholders

  accent: '#0f766e', // brand teal: primary actions, highlights
  accentSoft: '#e3f3f1',
  onAccent: '#ffffff',

  positive: '#157a3f', // money held, savings
  positiveSoft: '#e5f4ea',
  negative: '#b42318', // money owed, errors
  negativeSoft: '#fdecea',
  onNegative: '#ffffff', // text on a solid red button
  warning: '#a15c07', // needs attention
  warningSoft: '#fdf1df',

  // Categorical chart colours (web: chart-1..6), distinguishable from each other in both themes.
  chart1: '#0f766e',
  chart2: '#3b6fd8',
  chart3: '#c2410c',
  chart4: '#8b5cf6',
  chart5: '#ca8a04',
  chart6: '#64748b',
};

export type Tokens = typeof light;

const dark: Tokens = {
  canvas: '#0b0f16',
  surface: '#131a25',
  surfaceMuted: '#1b2331',
  line: '#263041',
  ink: '#e7eaf0',
  muted: '#a2abbb',
  subtle: '#6e7889',

  accent: '#2cc4b0',
  accentSoft: '#0f2d2a',
  onAccent: '#04211d',

  positive: '#4ccf7f',
  positiveSoft: '#10291b',
  negative: '#f2776c',
  negativeSoft: '#331614',
  onNegative: '#2a0b08',
  warning: '#f0b44c',
  warningSoft: '#33250c',

  chart1: '#2cc4b0',
  chart2: '#6f9bf0',
  chart3: '#f08a5d',
  chart4: '#a98bfa',
  chart5: '#e3b341',
  chart6: '#94a3b8',
};

export const tokens = { light, dark };

// The current theme's colours; re-renders when the phone switches between light and dark.
export function useTokens(): Tokens {
  return useColorScheme() === 'dark' ? dark : light;
}
