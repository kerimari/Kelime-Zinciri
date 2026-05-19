import { useCallback, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Animated,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { loadStats, LocalStats, emptyStats, titleForScore } from "../src/api";
import { colors, radius, spacing, fontFamily, shadows } from "../src/theme";
import { TileRow } from "../src/components/LetterTile";
import GameBackground from "../src/components/GameBackground";
import SoftButton from "../src/components/SoftButton";
import SoftCard from "../src/components/SoftCard";
import IconChip from "../src/components/IconChip";

export default function HomeScreen() {
  const router = useRouter();
  const [stats, setStats] = useState<LocalStats>(emptyStats());

  const refresh = useCallback(async () => {
    const s = await loadStats();
    setStats(s);
  }, []);

  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  const title = titleForScore(stats.best_score);

  return (
    <GameBackground>
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <ScrollView contentContainerStyle={styles.scroll} testID="home-screen">
          <View style={styles.titleWrap}>
            <View style={{ marginBottom: 10 }}>
              <TileRow word="kelime" size="lg" variant="white" gap={6} />
            </View>
            <TileRow word="zinciri" size="lg" variant="white" gap={6} />
          </View>

          {/* Best-score showcase card */}
          <SoftCard variant="elevated" style={styles.bestCard}>
            <View style={styles.bestRow}>
              <IconChip icon="trophy" color={colors.yellow} size={48} iconSize={22} filled />
              <View style={{ flex: 1 }}>
                <Text style={styles.bestLabel}>EN YÜKSEK SKOR</Text>
                <Text style={styles.bestValue} testID="home-best-score">{stats.best_score}</Text>
              </View>
              <View style={styles.titlePill}>
                <Text style={styles.titleText} numberOfLines={1}>{title}</Text>
              </View>
            </View>
            <View style={styles.miniRow}>
              <MiniStat icon="game-controller" label="Oyun" value={stats.games_played} color={colors.blue} />
              <MiniStat icon="flash" label="Max Kombo" value={`x${stats.max_combo || 1}`} color={colors.orange} />
              <MiniStat icon="link" label="En Uzun" value={stats.longest_chain} color={colors.green} />
            </View>
          </SoftCard>

          <View style={styles.buttonsWrap}>
            <SoftButton
              testID="giant-start-button"
              label="OYNA"
              icon="play"
              variant="primary"
              onPress={() => router.push("/game")}
            />
            <SoftButton
              testID="daily-challenge-button"
              label="GÜNLÜK CHALLENGE"
              icon="calendar"
              variant="secondary"
              onPress={() => router.push({ pathname: "/game", params: { mode: "daily" } })}
            />
          </View>

          <View style={styles.pillsRow}>
            <Pill icon="ribbon" color={colors.green} label="Başarımlar" onPress={() => router.push("/achievements")} testID="home-achievements-button" />
            <Pill icon="stats-chart" color={colors.blue} label="İstatistikler" onPress={() => router.push("/stats")} testID="home-stats-button" />
            <Pill icon="settings" color={colors.textSecondary} label="Ayarlar" onPress={() => router.push("/ayarlar")} testID="home-settings-button" />
          </View>
        </ScrollView>
      </SafeAreaView>
    </GameBackground>
  );
}

function MiniStat({ icon, label, value, color }: { icon: any; label: string; value: number | string; color: string }) {
  return (
    <View style={styles.miniStat}>
      <IconChip icon={icon} color={color} size={28} iconSize={13} />
      <View style={{ flex: 1 }}>
        <Text style={styles.miniValue}>{value}</Text>
        <Text style={styles.miniLabel} numberOfLines={1}>{label}</Text>
      </View>
    </View>
  );
}

function Pill({ icon, color, label, onPress, testID }: { icon: any; color: string; label: string; onPress: () => void; testID?: string }) {
  const scale = useRef(new Animated.Value(1)).current;
  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => Animated.spring(scale, { toValue: 0.95, useNativeDriver: true, speed: 40, bounciness: 0 }).start()}
      onPressOut={() => Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30, bounciness: 6 }).start()}
      testID={testID}
      style={{ flex: 1 }}
    >
      <Animated.View style={[styles.pill, { transform: [{ scale }] }]}>
        <IconChip icon={icon} color={color} size={32} iconSize={14} />
        <Text
          style={styles.pillText}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.75}
          allowFontScaling={false}
        >
          {label}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { flexGrow: 1, paddingHorizontal: spacing.lg, paddingBottom: spacing.lg, paddingTop: spacing.md },
  titleWrap: { alignItems: "center", marginTop: spacing.lg },
  bestCard: { marginTop: spacing.xl, paddingHorizontal: spacing.md, paddingVertical: spacing.md, gap: spacing.md },
  bestRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  bestLabel: { color: colors.textMuted, fontSize: 11, letterSpacing: 2, fontFamily: fontFamily.extraBold },
  bestValue: { color: "#FFFFFF", fontSize: 32, fontFamily: fontFamily.black, letterSpacing: -0.5, marginTop: 2 },
  titlePill: {
    backgroundColor: "rgba(47,178,122,0.18)",
    borderWidth: 1, borderColor: "rgba(47,178,122,0.35)",
    borderRadius: radius.full,
    paddingHorizontal: 10, paddingVertical: 6,
    maxWidth: 110,
  },
  titleText: { color: colors.green, fontSize: 11, fontFamily: fontFamily.extraBold, letterSpacing: 0.5 },
  miniRow: { flexDirection: "row", gap: 10, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.06)" },
  miniStat: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  miniValue: { color: "#FFFFFF", fontSize: 16, fontFamily: fontFamily.black },
  miniLabel: { color: colors.textMuted, fontSize: 10, fontFamily: fontFamily.semibold, letterSpacing: 0.3 },
  buttonsWrap: { marginTop: spacing.xl, gap: 14, paddingHorizontal: 4 },
  pillsRow: {
    marginTop: "auto",
    paddingTop: spacing.xl,
    flexDirection: "row",
    gap: 8,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.surfaceCard,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: radius.lg,
    paddingHorizontal: 8,
    paddingVertical: 10,
    ...(shadows.chip as any),
  },
  pillText: { color: "#FFFFFF", fontFamily: fontFamily.bold, fontSize: 11, letterSpacing: 0.2, flexShrink: 1 },
});
