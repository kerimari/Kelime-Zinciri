import React from "react";
import { View, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { colors } from "../theme";

/**
 * Clean teal → blue gradient background. No hills, no waves.
 * A very subtle top-edge highlight overlay keeps it feeling premium without
 * adding visual noise. Components above should provide their own surface language.
 */
export default function GameBackground({ children }: { children?: React.ReactNode }) {
  return (
    <View style={styles.root}>
      <LinearGradient
        colors={[colors.bgTop, colors.bgMid, colors.bgBottom]}
        locations={[0, 0.55, 1]}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.8, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />
      {/* Subtle top-edge light wash to add depth */}
      <LinearGradient
        colors={["rgba(255,255,255,0.06)", "rgba(255,255,255,0)"]}
        locations={[0, 1]}
        style={styles.topWash}
        pointerEvents="none"
      />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bgTop },
  topWash: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 180,
  },
});
