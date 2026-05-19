import React from "react";
import { View, StyleSheet, ViewStyle, StyleProp } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { shadows } from "../theme";

type Props = {
  icon: keyof typeof Ionicons.glyphMap;
  /** Main icon/tint color (used for a very subtle tinted gradient inside the chip) */
  color: string;
  size?: number;
  iconSize?: number;
  /** Filled tint vs translucent. When filled, chip uses the color as its saturated background. */
  filled?: boolean;
  style?: StyleProp<ViewStyle>;
};

/**
 * Rounded icon capsule with soft matte surface.
 * Used for row-start icons in lists, cards, etc. — keeps icons from floating in space.
 */
export default function IconChip({ icon, color, size = 44, iconSize, filled = false, style }: Props) {
  const iSize = iconSize ?? Math.round(size * 0.5);

  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: Math.round(size * 0.32),
          overflow: "hidden",
        },
        filled ? (shadows.chip as any) : null,
        style,
      ]}
    >
      {filled ? (
        <LinearGradient
          colors={[lighten(color, 0.12), color]}
          locations={[0, 1]}
          style={StyleSheet.absoluteFillObject}
        />
      ) : (
        <LinearGradient
          colors={[hexWithAlpha(color, 0.28), hexWithAlpha(color, 0.12)]}
          locations={[0, 1]}
          style={StyleSheet.absoluteFillObject}
        />
      )}
      {/* top highlight */}
      <LinearGradient
        colors={["rgba(255,255,255,0.18)", "rgba(255,255,255,0)"]}
        locations={[0, 1]}
        style={[StyleSheet.absoluteFillObject, { height: "55%" }]}
        pointerEvents="none"
      />
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFillObject,
          {
            borderRadius: Math.round(size * 0.32),
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.10)",
          },
        ]}
      />
      <View style={styles.center}>
        <Ionicons name={icon} size={iSize} color={filled ? "#FFFFFF" : color} />
      </View>
    </View>
  );
}

function hexWithAlpha(color: string, alpha: number) {
  if (color.startsWith("rgba")) return color;
  if (color.startsWith("rgb")) {
    return color.replace("rgb", "rgba").replace(")", `, ${alpha})`);
  }
  // Assume #RRGGBB
  const hex = color.replace("#", "");
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function lighten(color: string, amount: number) {
  const hex = color.replace("#", "");
  if (hex.length !== 6) return color;
  const r = Math.min(255, Math.round(parseInt(hex.substring(0, 2), 16) + 255 * amount));
  const g = Math.min(255, Math.round(parseInt(hex.substring(2, 4), 16) + 255 * amount));
  const b = Math.min(255, Math.round(parseInt(hex.substring(4, 6), 16) + 255 * amount));
  return `rgb(${r}, ${g}, ${b})`;
}

const styles = StyleSheet.create({
  center: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
});
