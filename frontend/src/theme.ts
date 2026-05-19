// Kelime Zinciri — Premium matte theme
// Design language: Clean teal→blue gradient background, matte saturated components,
// tactile letter tiles with subtle top highlight + soft drop shadow, rounded
// game-friendly typography (Nunito). No waves, no hills, no harsh plastic glows.
import { Platform } from "react-native";

export const colors = {
  // Background gradient stops: saturated teal at top → deep blue at bottom.
  // Slight cyan tint in the middle keeps it feeling vivid without wavy decor.
  bgTop: "#0F6B5C",       // deep teal / forest-teal at top
  bgMid: "#0E4C6A",       // ocean teal
  bgBottom: "#0A2F55",    // deep navy-blue at bottom
  background: "#0F4F55",

  // Matte surfaces (lower contrast, warmer)
  surface: "rgba(255,255,255,0.045)",
  surfaceSolid: "#13394A",
  surfaceLight: "rgba(255,255,255,0.08)",
  surfaceCard: "rgba(12, 48, 62, 0.78)",
  surfaceCardElevated: "rgba(16, 60, 78, 0.92)",
  border: "rgba(255,255,255,0.09)",
  borderSoft: "rgba(255,255,255,0.05)",
  // Top-edge highlight on matte components (very subtle)
  topHighlight: "rgba(255,255,255,0.10)",

  // Accents — matte saturated, not neon
  green: "#2FB27A",        // matte mint-green
  greenDark: "#1E7A52",
  greenDeep: "#155A3C",
  greenGlow: "rgba(47, 178, 122, 0.42)",

  orange: "#E68A3C",       // warm matte amber
  orangeDark: "#B26423",
  orangeGlow: "rgba(230, 138, 60, 0.42)",

  yellow: "#F2C94C",
  yellowDark: "#B38400",
  yellowGlow: "rgba(242, 201, 76, 0.45)",

  red: "#E15A6B",
  redGlow: "rgba(225, 90, 107, 0.55)",

  blue: "#5AA9E6",
  blueDark: "#2D6FA6",

  // Tile — off-white with subtle warm tone for "physical" feel
  tileTop: "#F7F5F0",       // warm off-white top
  tileBottom: "#E4E1D7",    // slightly cooler bottom (for shade)
  tileShadow: "rgba(0, 0, 0, 0.22)",
  tileBorder: "rgba(0, 0, 0, 0.05)",
  tileNavyText: "#163350",

  tileGreenTop: "#39C089",
  tileGreenBottom: "#268F62",
  tileGreenShadow: "rgba(0, 80, 50, 0.35)",

  // Text
  textPrimary: "#FFFFFF",
  textSecondary: "rgba(255,255,255,0.72)",
  textMuted: "rgba(255,255,255,0.44)",
  textOnLight: "#163350",

  // Status
  danger: "#E15A6B",

  // Back-compat shims
  primary: "#2FB27A",
  primaryDim: "#1E7A52",
  primaryGlow: "rgba(47, 178, 122, 0.42)",
  secondary: "#E68A3C",
  secondaryGlow: "rgba(230, 138, 60, 0.42)",
  accent: "#F2C94C",
  tileWhite: "#F7F5F0",
  tileWhiteShadow: "#C8D0DC",
  tileGreen: "#2FB27A",
};

export const radius = {
  sm: 10,
  md: 16,
  lg: 22,
  xl: 30,
  full: 999,
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

// Soft, wide-blur, low-opacity shadows — the core of the "matte tactile" feel
export const shadows = {
  // Card / surface resting shadow
  card:
    Platform.OS === "ios"
      ? {
          shadowColor: "#000",
          shadowOpacity: 0.18,
          shadowRadius: 16,
          shadowOffset: { width: 0, height: 6 },
        }
      : { elevation: 3 },
  // Small element (buttons, icon chips)
  chip:
    Platform.OS === "ios"
      ? {
          shadowColor: "#000",
          shadowOpacity: 0.14,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: 4 },
        }
      : { elevation: 2 },
  // Primary action button — bit more pronounced
  primaryBtn:
    Platform.OS === "ios"
      ? {
          shadowColor: "#000",
          shadowOpacity: 0.28,
          shadowRadius: 14,
          shadowOffset: { width: 0, height: 8 },
        }
      : { elevation: 5 },
  // Tile resting shadow
  tile:
    Platform.OS === "ios"
      ? {
          shadowColor: "#000",
          shadowOpacity: 0.28,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 4 },
        }
      : { elevation: 3 },
};

export const fontFamily = {
  regular: "Nunito_400Regular",
  medium: "Nunito_500Medium",
  semibold: "Nunito_600SemiBold",
  bold: "Nunito_700Bold",
  extraBold: "Nunito_800ExtraBold",
  black: "Nunito_900Black",
};

export const typography = {
  displayLg: { fontSize: 56, fontFamily: fontFamily.black, letterSpacing: -1 },
  h1: { fontSize: 34, fontFamily: fontFamily.extraBold, letterSpacing: -0.5 },
  h2: { fontSize: 26, fontFamily: fontFamily.bold },
  h3: { fontSize: 20, fontFamily: fontFamily.bold },
  body: { fontSize: 16, fontFamily: fontFamily.medium },
  caption: { fontSize: 13, fontFamily: fontFamily.medium },
  label: {
    fontSize: 11,
    fontFamily: fontFamily.extraBold,
    letterSpacing: 2,
    textTransform: "uppercase" as const,
  },
};
