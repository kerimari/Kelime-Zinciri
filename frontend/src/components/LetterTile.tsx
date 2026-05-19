import React from "react";
import { View, Text, StyleSheet, ViewStyle, StyleProp, Dimensions, Platform } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { colors, fontFamily, shadows } from "../theme";

export type TileVariant = "white" | "green" | "muted" | "ghost";

type Palette = {
  topColor: string;
  bottomColor: string;
  textColor: string;
  // Very subtle highlight stripe on the top 30% of tile
  highlightColor: string;
};

const PALETTE: Record<TileVariant, Palette> = {
  white: {
    topColor: colors.tileTop,
    bottomColor: colors.tileBottom,
    textColor: colors.tileNavyText,
    highlightColor: "rgba(255,255,255,0.55)",
  },
  green: {
    topColor: colors.tileGreenTop,
    bottomColor: colors.tileGreenBottom,
    textColor: "#FFFFFF",
    highlightColor: "rgba(255,255,255,0.28)",
  },
  muted: {
    topColor: "rgba(255,255,255,0.16)",
    bottomColor: "rgba(255,255,255,0.08)",
    textColor: "rgba(255,255,255,0.82)",
    highlightColor: "rgba(255,255,255,0.08)",
  },
  ghost: {
    topColor: "transparent",
    bottomColor: "transparent",
    textColor: "rgba(255,255,255,0.28)",
    highlightColor: "transparent",
  },
};

type Size = "xs" | "sm" | "md" | "lg" | "xl";

type TileProps = {
  letter: string;
  size?: Size | number;
  variant?: TileVariant;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

const SIZE_PRESETS: Record<Size, number> = {
  xs: 22,
  sm: 30,
  md: 44,
  lg: 58,
  xl: 74,
};

function makeStyle(box: number) {
  // Turkish uppercase dotted İ has a cap-dot that sits ABOVE the normal cap
  // height of a glyph. With overflow:hidden on the tile, an oversized font will
  // clip the dot on iOS. We intentionally:
  //  - reduce font to 0.38 of box (smaller glyph body)
  //  - add generous lineHeight (1.4x) so the accent fits inside the text line-box
  //  - pad the top of the text area so the glyph sits lower in the tile.
  return {
    box,
    font: Math.round(box * 0.38),
    radius: Math.max(6, Math.round(box * 0.22)),
    paddingTop: Math.max(3, Math.round(box * 0.1)),
  };
}

export function LetterTile({ letter, size = "md", variant = "white", style, testID }: TileProps) {
  const boxSize = typeof size === "number" ? size : SIZE_PRESETS[size];
  const s = makeStyle(boxSize);
  const p = PALETTE[variant];
  const isGhost = variant === "ghost";

  // A tile needs:
  // 1. Overall rounded container with soft drop shadow (tactile / physical)
  // 2. Subtle vertical gradient fill (top slightly lighter than bottom)
  // 3. A very soft top highlight strip to simulate ambient top light
  // 4. A hair-thin dark border to anchor the edge on light backgrounds

  if (isGhost) {
    return (
      <View
        testID={testID}
        style={[
          {
            width: s.box,
            height: s.box,
            borderRadius: s.radius,
            borderWidth: 1.5,
            borderStyle: "dashed",
            borderColor: "rgba(255,255,255,0.18)",
            alignItems: "center",
            justifyContent: "center",
          },
          style,
        ]}
      >
        <Text
          allowFontScaling={false}
          style={{
            color: p.textColor,
            fontSize: s.font,
            fontFamily: fontFamily.extraBold,
            textAlign: "center",
          }}
        >
          {letter ? letter.toLocaleUpperCase("tr-TR") : ""}
        </Text>
      </View>
    );
  }

  const isMuted = variant === "muted";

  return (
    <View
      testID={testID}
      style={[
        {
          width: s.box,
          height: s.box,
          borderRadius: s.radius,
          overflow: "hidden",
          backgroundColor: p.bottomColor,
        },
        !isMuted ? shadows.tile : null,
        style,
      ]}
    >
      {/* Main surface: subtle vertical gradient (top lighter, bottom slightly darker) */}
      <LinearGradient
        colors={[p.topColor, p.bottomColor]}
        locations={[0, 1]}
        style={StyleSheet.absoluteFillObject}
      />
      {/* Top highlight strip — simulates ambient overhead light on a matte surface */}
      <LinearGradient
        colors={[p.highlightColor, "rgba(255,255,255,0)"]}
        locations={[0, 1]}
        style={[StyleSheet.absoluteFillObject, { height: "55%" }]}
        pointerEvents="none"
      />
      {/* Hair-thin inner border for edge definition on light tiles */}
      <View
        style={[
          StyleSheet.absoluteFillObject,
          {
            borderRadius: s.radius,
            borderWidth: variant === "white" ? StyleSheet.hairlineWidth : 0,
            borderColor: colors.tileBorder,
          },
        ]}
        pointerEvents="none"
      />
      {/* Letter — extra vertical padding + tall lineHeight to fit Turkish dotted-İ cap */}
      <View style={[styles.letterWrap, { paddingTop: s.paddingTop }]}>
        <Text
          numberOfLines={1}
          allowFontScaling={false}
          style={{
            color: p.textColor,
            fontSize: s.font,
            fontFamily: fontFamily.black,
            textAlign: "center",
            lineHeight: Math.round(s.font * 1.4),
            ...(Platform.OS === "android"
              ? { includeFontPadding: false, textAlignVertical: "center" as const }
              : {}),
          }}
        >
          {letter ? letter.toLocaleUpperCase("tr-TR") : ""}
        </Text>
      </View>
    </View>
  );
}

type RowProps = {
  word: string;
  size?: Size | number;
  variant?: TileVariant;
  greenLastLetter?: boolean;
  gap?: number;
  maxWidth?: number;
  minTileSize?: number;
};

export function TileRow({
  word,
  size = "md",
  variant = "white",
  greenLastLetter,
  gap = 6,
  maxWidth,
  minTileSize = 20,
}: RowProps) {
  const letters = Array.from(word || "");
  const len = letters.length || 1;

  const screenW = Dimensions.get("window").width;
  const maxW = maxWidth ?? Math.min(screenW - 32, 520);
  const preferred = typeof size === "number" ? size : SIZE_PRESETS[size];

  const dynamicGap = len > 8 ? Math.max(2, Math.floor(gap / 2)) : gap;
  const fitBox = Math.floor((maxW - dynamicGap * (len - 1)) / len);
  const actualBox = Math.max(minTileSize, Math.min(preferred, fitBox));

  return (
    <View style={[styles.row, { gap: dynamicGap }]}>
      {letters.map((ch, idx) => {
        const isLast = idx === len - 1;
        const v = greenLastLetter && isLast ? "green" : variant;
        return <LetterTile key={`${ch}-${idx}`} letter={ch} size={actualBox} variant={v} />;
      })}
    </View>
  );
}

export function computeTileBox(word: string, size: Size | number = "md", gap = 6, maxWidth?: number) {
  const len = (word || "").length || 1;
  const screenW = Dimensions.get("window").width;
  const maxW = maxWidth ?? Math.min(screenW - 32, 520);
  const preferred = typeof size === "number" ? size : SIZE_PRESETS[size];
  const dynamicGap = len > 8 ? Math.max(2, Math.floor(gap / 2)) : gap;
  const fitBox = Math.floor((maxW - dynamicGap * (len - 1)) / len);
  const actualBox = Math.max(20, Math.min(preferred, fitBox));
  return { box: actualBox, gap: dynamicGap };
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  letterWrap: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
});
