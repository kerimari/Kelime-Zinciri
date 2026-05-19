import { useCallback, useState } from "react";
import {
  View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator, Animated,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { loadStats, LocalStats, emptyStats, titleForScore } from "../src/api";
import { colors, radius, spacing, fontFamily, shadows } from "../src/theme";
import GameBackground from "../src/components/GameBackground";
import SoftCard from "../src/components/SoftCard";
import IconChip from "../src/components/IconChip";

export default function StatsScreen() {
  const router = useRouter();
  const [stats, setStats] = useState<LocalStats>(emptyStats());
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setStats(await loadStats());
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (loading) {
    return (
      <GameBackground>
        <SafeAreaView style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={colors.green} />
        </SafeAreaView>
      </GameBackground>
    );
  }

  const title = titleForScore(stats.best_score);
  const avgScore = stats.games_played > 0 ? Math.round(stats.total_score / stats.games_played) : 0;

  return (
    <GameBackground>
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <View style={styles.header}>
          <BackBtn onPress={() => router.back()} testID="stats-back" />
          <Text style={styles.headerTitle}>İstatistikler</Text>
          <View style={{ width: 42 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scroll} testID="stats-screen">
          <SoftCard variant="elevated" style={styles.bigCard}>
            <IconChip icon="trophy" color={colors.yellow} size={60} iconSize={26} filled />
            <Text style={styles.bigLabel}>EN YÜKSEK SKOR</Text>
            <Text style={styles.bigValue} testID="stats-best-score">{stats.best_score}</Text>
            <View style={styles.titlePill}><Text style={styles.titleText}>{title}</Text></View>
          </SoftCard>

          <View style={styles.row}>
            <SoftCard variant="flat" style={styles.halfCard}>
              <IconChip icon="link" color={colors.green} size={44} iconSize={20} filled />
              <Text style={styles.halfValue}>{stats.longest_chain || 0}</Text>
              <Text style={styles.halfLabel}>En Uzun Zincir</Text>
            </SoftCard>
            <SoftCard variant="flat" style={styles.halfCard}>
              <IconChip icon="flash" color={colors.orange} size={44} iconSize={20} filled />
              <Text style={styles.halfValue}>x{stats.max_combo || 1}</Text>
              <Text style={styles.halfLabel}>Max Kombo</Text>
            </SoftCard>
          </View>

          <View style={styles.row}>
            <SoftCard variant="flat" style={styles.halfCard}>
              <IconChip icon="game-controller" color={colors.blue} size={44} iconSize={20} filled />
              <Text style={styles.halfValue}>{stats.games_played}</Text>
              <Text style={styles.halfLabel}>Oyun</Text>
            </SoftCard>
            <SoftCard variant="flat" style={styles.halfCard}>
              <IconChip icon="book" color="#9B7BFF" size={44} iconSize={20} filled />
              <Text style={styles.halfValue}>{stats.words_total}</Text>
              <Text style={styles.halfLabel}>Toplam Kelime</Text>
            </SoftCard>
          </View>

          <SoftCard variant="flat" style={styles.summaryCard}>
            <View style={styles.sumRow}>
              <Text style={styles.sumLabel}>Toplam Puan</Text>
              <Text style={styles.sumValue}>{stats.total_score}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.sumRow}>
              <Text style={styles.sumLabel}>Oyun Başına Ortalama</Text>
              <Text style={styles.sumValue}>{avgScore}</Text>
            </View>
          </SoftCard>
        </ScrollView>
      </SafeAreaView>
    </GameBackground>
  );
}

function BackBtn({ onPress, testID }: { onPress: () => void; testID?: string }) {
  const scale = new Animated.Value(1);
  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => Animated.spring(scale, { toValue: 0.92, useNativeDriver: true, speed: 40, bounciness: 0 }).start()}
      onPressOut={() => Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30, bounciness: 6 }).start()}
      testID={testID}
    >
      <Animated.View style={[styles.iconBtn, { transform: [{ scale }] }]}>
        <Ionicons name="arrow-back" size={20} color="rgba(255,255,255,0.9)" />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  iconBtn: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: colors.surfaceCard, borderWidth: 1, borderColor: colors.borderSoft,
    alignItems: "center", justifyContent: "center", ...(shadows.chip as any),
  },
  headerTitle: { color: "#FFFFFF", fontSize: 18, fontFamily: fontFamily.extraBold },
  scroll: { padding: spacing.lg, gap: 14, paddingBottom: spacing.xxl },
  bigCard: { alignItems: "center", paddingVertical: spacing.xl, gap: 8 },
  bigLabel: { color: colors.textMuted, fontSize: 11, fontFamily: fontFamily.extraBold, letterSpacing: 2 },
  bigValue: { color: "#FFFFFF", fontSize: 56, fontFamily: fontFamily.black, letterSpacing: -1.5 },
  titlePill: {
    marginTop: 4,
    backgroundColor: "rgba(47,178,122,0.18)",
    borderWidth: 1, borderColor: "rgba(47,178,122,0.35)",
    borderRadius: radius.full, paddingHorizontal: 14, paddingVertical: 6,
  },
  titleText: { color: colors.green, fontSize: 12, fontFamily: fontFamily.extraBold, letterSpacing: 1 },
  row: { flexDirection: "row", gap: 14 },
  halfCard: { flex: 1, alignItems: "center", paddingVertical: spacing.lg, gap: 8 },
  halfValue: { color: "#FFFFFF", fontSize: 22, fontFamily: fontFamily.black },
  halfLabel: { color: colors.textMuted, fontSize: 11, fontFamily: fontFamily.semibold, letterSpacing: 0.3 },
  summaryCard: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  sumRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: spacing.md },
  sumLabel: { color: colors.textSecondary, fontSize: 14, fontFamily: fontFamily.semibold },
  sumValue: { color: "#FFFFFF", fontSize: 18, fontFamily: fontFamily.black },
  divider: { height: 1, backgroundColor: "rgba(255,255,255,0.06)" },
});
