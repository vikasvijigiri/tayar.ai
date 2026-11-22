/**
 * Tayar.ai mobile design tokens.
 *
 * Keep visual primitives here so screens share one source of truth.
 * Existing semantic color aliases are retained for a behavior-preserving migration.
 */
export const colors = {
  background: "#0A1020",
  surface: "#121C30",
  surfaceRaised: "#17243B",
  textPrimary: "#F4F7FC",
  textSecondary: "#9AAAC3",
  accentPrimary: "#53E0C1",
  accentSecondary: "#85A9FF",
  accentWarm: "#FFC76A",
  border: "#263650",
  danger: "#FF7D86",
  success: "#53E0C1",
  overlay: "rgba(4, 9, 18, 0.72)",
} as const;

/** Backwards-compatible semantic aliases used by the existing screens. */
export const C = {
  bg: colors.background,
  panel: colors.surface,
  panel2: colors.surfaceRaised,
  text: colors.textPrimary,
  muted: colors.textSecondary,
  teal: colors.accentPrimary,
  blue: colors.accentSecondary,
  amber: colors.accentWarm,
  border: colors.border,
  red: colors.danger,
} as const;

export const spacing = {
  none: 0,
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
  '4xl': 40,
  '5xl': 48,
} as const;

export const radii = {
  xs: 6,
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
  pill: 999,
} as const;

export const typography = {
  caption: 11,
  footnote: 12,
  small: 13,
  body: 15,
  bodyLarge: 17,
  titleSmall: 20,
  title: 24,
  display: 30,
} as const;

export const layout = {
  compactBreakpoint: 360,
  regularBreakpoint: 430,
  contentMaxWidth: 760,
  comfortableReadingWidth: 520,
  minimumTouchTarget: 48,
} as const;

export const motion = {
  fast: 140,
  standard: 220,
  emphasis: 320,
} as const;

export type ColorToken = keyof typeof colors;
export type SpacingToken = keyof typeof spacing;
