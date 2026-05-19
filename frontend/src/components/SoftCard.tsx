import React from "react";
import { View, StyleSheet, ViewStyle, StyleProp } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { colors, radius, shadows } from "../theme";

type Props = {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** "flat" for list items, "elevated" for standout cards. Both use the same matte language. */
  variant?: "flat" | "elevated";
  padding?: number;
  testID?: string;
};

/**
 * Matte card surface with soft top highlight and a wide-blur low-opacity shadow.
 * - Thin 1px border in near-black for edge definition on dark bg
 * - Very subtle top edge highlight (simulates overhead light)
 * - No strong background fill; relies on layering
 */
export default function SoftCard({ children, style, variant = "flat", padding, testID }: Props) {
  const isElevated = variant === "elevated";
  return (
    <View
      testID={testID}
      style={[
        {
          borderRadius: radius.lg,
          overflow: "hidden",
          backgroundColor: isElevated ? colors.surfaceCardElevated : colors.surfaceCard,
          borderWidth: 1,
          borderColor: colors.borderSoft,
        },
        isElevated ? (shadows.card as any) : (shadows.chip as any),
        padding != null ? { padding } : null,
        style,
      ]}
    >
      {/* Top edge highlight — very subtle */}
      <LinearGradient
        colors={["rgba(255,255,255,0.06)", "rgba(255,255,255,0)"]}
        locations={[0, 1]}
        style={[StyleSheet.absoluteFillObject, { height: 60 }]}
        pointerEvents="none"
      />
      {children}
    </View>
  );
}
