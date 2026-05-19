import React, { useEffect, useRef } from "react";
import Svg, { Circle } from "react-native-svg";
import { View, Text, StyleSheet, Animated, Easing, Platform } from "react-native";
import { colors } from "../theme";

type Props = {
  /** 0..1 progress filled */
  progress: number;
  /** Seconds remaining to display */
  seconds: number;
  size?: number;
  strokeWidth?: number;
  /** Incremented each time +3s boost is applied — triggers brief pop */
  boostSignal?: number;
};

/**
 * Circular countdown timer with color transitions and a subtle heartbeat
 * pulse when time is critical (<5s), plus a "+3s" boost pop animation.
 *
 * Color rules:
 *   seconds > 15 → green
 *   seconds 5–15 → yellow
 *   seconds < 5  → red (and heartbeat pulse)
 */
export default function CircularTimer({
  progress,
  seconds,
  size = 68,
  strokeWidth = 5,
  boostSignal = 0,
}: Props) {
  const r = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(1, progress));
  const dashoffset = circumference * (1 - clamped);

  const color =
    seconds > 15 ? colors.green : seconds > 5 ? colors.yellow : colors.red;
  const glowColor =
    seconds > 15 ? colors.greenGlow : seconds > 5 ? colors.yellowGlow : colors.redGlow;

  // Heartbeat pulse when <=5s: two quick scale beats, then a short rest
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (seconds <= 5 && seconds > 0) {
      const beat = Animated.sequence([
        Animated.timing(pulse, { toValue: 1.14, duration: 140, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1.0, duration: 160, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1.08, duration: 120, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1.0, duration: 180, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.delay(380),
      ]);
      const loop = Animated.loop(beat);
      loop.start();
      return () => {
        loop.stop();
        pulse.setValue(1);
      };
    }
  }, [seconds <= 5 && seconds > 0]);

  // Boost pop: brief scale bump + "+3s" label fade-in/out
  const boostScale = useRef(new Animated.Value(1)).current;
  const boostOpacity = useRef(new Animated.Value(0)).current;
  const boostY = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!boostSignal) return;
    boostScale.setValue(0.9);
    Animated.sequence([
      Animated.timing(boostScale, {
        toValue: 1.18,
        duration: 160,
        easing: Easing.out(Easing.back(2)),
        useNativeDriver: true,
      }),
      Animated.timing(boostScale, {
        toValue: 1,
        duration: 180,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();
    // Floating "+3s" just above the ring
    boostY.setValue(0);
    boostOpacity.setValue(1);
    Animated.parallel([
      Animated.timing(boostY, {
        toValue: -22,
        duration: 700,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.delay(250),
        Animated.timing(boostOpacity, { toValue: 0, duration: 420, useNativeDriver: true }),
      ]),
    ]).start();
  }, [boostSignal]);

  return (
    <View style={[styles.wrap, { width: size, height: size }]} testID="circular-timer">
      <Animated.View
        style={{
          width: size,
          height: size,
          transform: [{ scale: Animated.multiply(pulse, boostScale) }],
          ...(Platform.OS === "ios"
            ? {
                shadowColor: color,
                shadowOpacity: 0.45,
                shadowRadius: 10,
                shadowOffset: { width: 0, height: 0 },
              }
            : {}),
        }}
      >
        <Svg width={size} height={size}>
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke="rgba(255,255,255,0.15)"
            strokeWidth={strokeWidth}
            fill="rgba(0,0,0,0.25)"
          />
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={`${circumference}`}
            strokeDashoffset={dashoffset}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        </Svg>
        <View style={styles.center} pointerEvents="none">
          <Text
            allowFontScaling={false}
            style={[
              styles.text,
              {
                color,
                fontSize: Math.round(size * 0.32),
                textShadowColor: glowColor,
                textShadowRadius: 6,
                textShadowOffset: { width: 0, height: 0 },
              },
            ]}
          >
            {Math.ceil(seconds)}
          </Text>
        </View>
      </Animated.View>

      <Animated.Text
        allowFontScaling={false}
        style={[
          styles.boostText,
          {
            opacity: boostOpacity,
            transform: [{ translateY: boostY }],
          },
        ]}
      >
        +3s
      </Animated.Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", justifyContent: "center" },
  center: {
    position: "absolute",
    top: 0, left: 0, right: 0, bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  text: { fontWeight: "900" },
  boostText: {
    position: "absolute",
    top: -10,
    color: colors.green,
    fontSize: 14,
    fontWeight: "900",
    letterSpacing: 0.5,
    textShadowColor: "rgba(52, 199, 89, 0.7)",
    textShadowRadius: 8,
    textShadowOffset: { width: 0, height: 0 },
  },
});
