import React, { useRef } from "react";
import {
  Pressable,
  Animated,
  Text,
  View,
  StyleSheet,
  ViewStyle,
  StyleProp,
  TextStyle,
  PressableProps,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { colors, radius, fontFamily, shadows } from "../theme";

type Variant = "primary" | "secondary" | "neutral" | "danger";

const VARIANT_COLORS: Record<Variant, { top: string; bottom: string; text: string; highlight: string; shadow: string }> = {
  primary: {
    top: "#40C88C",
    bottom: colors.greenDark,
    text: "#FFFFFF",
    highlight: "rgba(255,255,255,0.22)",
    shadow: "rgba(30, 122, 82, 0.45)",
  },
  secondary: {
    top: "#F0A35A",
    bottom: "#B26423",
    text: "#FFFFFF",
    highlight: "rgba(255,255,255,0.22)",
    shadow: "rgba(178, 100, 35, 0.4)",
  },
  neutral: {
    top: "rgba(255,255,255,0.10)",
    bottom: "rgba(255,255,255,0.04)",
    text: "#FFFFFF",
    highlight: "rgba(255,255,255,0.12)",
    shadow: "rgba(0,0,0,0.25)",
  },
  danger: {
    top: "#EC7288",
    bottom: "#B83E55",
    text: "#FFFFFF",
    highlight: "rgba(255,255,255,0.22)",
    shadow: "rgba(184, 62, 85, 0.4)",
  },
};

type Props = {
  label: string;
  onPress?: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
  variant?: Variant;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  labelStyle?: StyleProp<TextStyle>;
  testID?: string;
  size?: "lg" | "md" | "sm";
  iconSize?: number;
} & Omit<PressableProps, "children">;

/**
 * SoftButton — matte, tactile press button.
 * Press feedback: compresses slightly (scale 0.96) via native driver only (no
 * mixed JS/native to avoid "animated node moved to native" errors).
 */
export default function SoftButton({
  label,
  onPress,
  icon,
  variant = "primary",
  disabled,
  style,
  labelStyle,
  testID,
  size = "lg",
  iconSize,
  ...rest
}: Props) {
  const v = VARIANT_COLORS[variant];
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scale, {
      toValue: 0.96,
      useNativeDriver: true,
      speed: 40,
      bounciness: 0,
    }).start();
  };
  const handlePressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 30,
      bounciness: 6,
    }).start();
  };

  const height = size === "lg" ? 58 : size === "md" ? 48 : 40;
  const padH = size === "lg" ? 24 : size === "md" ? 18 : 14;
  const fontSize = size === "lg" ? 16 : size === "md" ? 14 : 13;
  const iSize = iconSize ?? (size === "lg" ? 20 : 18);

  return (
    <Animated.View
      style={[
        {
          transform: [{ scale }],
          opacity: disabled ? 0.55 : 1,
          ...(shadows.primaryBtn as any),
        },
        style,
      ]}
    >
      <Pressable
        disabled={disabled}
        testID={testID}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={{
          borderRadius: radius.full,
          overflow: "hidden",
          height,
          justifyContent: "center",
        }}
        {...rest}
      >
        <LinearGradient
          colors={[v.top, v.bottom]}
          locations={[0, 1]}
          style={StyleSheet.absoluteFillObject}
        />
        {/* Top highlight */}
        <LinearGradient
          colors={[v.highlight, "rgba(255,255,255,0)"]}
          locations={[0, 1]}
          style={[StyleSheet.absoluteFillObject, { height: "52%" }]}
          pointerEvents="none"
        />
        {/* Thin inner border for definition */}
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFillObject,
            {
              borderRadius: radius.full,
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.08)",
            },
          ]}
        />
        <View style={[styles.inner, { paddingHorizontal: padH }]}>
          {icon ? <Ionicons name={icon} size={iSize} color={v.text} style={{ marginRight: 10 }} /> : null}
          <Text
            allowFontScaling={false}
            numberOfLines={1}
            style={[
              {
                color: v.text,
                fontSize,
                fontFamily: fontFamily.extraBold,
                letterSpacing: 1.2,
              },
              labelStyle,
            ]}
          >
            {label}
          </Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  inner: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
});
