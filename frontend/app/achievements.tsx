import { useCallback, useState } from "react";
import {
  View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator, Animated,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { loadStats, LocalStats, emptyStats, getAchievementDefs, AchievementDef } from "../src/api";
import { colors, radius, spacing, fontFamily, shadows } from "../src/theme";
import GameBackground from "../src/components/GameBackground";
import SoftCard from "../src/components/SoftCard";
import IconChip from "../src/components/IconChip";

export default function AchievementsScreen() {
  const router = useRouter();
  const [stats, setStats] = useState<LocalStats>(emptyStats());
  const [list, setList] = useState<AchievementDef[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, defs] = await Promise.all([loadStats(), getAchievementDefs()]);
      setStats(s);
      setList(defs);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const unlocked = new Set(stats.achievements);
  const total = list.length;
  const done = list.filter((a) => unlocked.has(a.id)).length;

  return (
    <GameBackground>
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <View style={styles.header}>
          <BackBtn onPress={() => router.back()} testID="achievements-back" />
          <Text style={styles.title}>Başarımlar</Text>
          <View style={styles.countPill} testID="achievements-count">
            <Text style={styles.countText}>{done}/{total}</Text>
          </View>
        </View>

        {loading ? (
          <View style={styles.loadingWrap}><ActivityIndicator color={colors.green} /></View>
        ) : (
          <ScrollView contentContainerStyle={styles.scroll} testID="achievements-screen">
            {list.map((a) => {
              const isDone = unlocked.has(a.id);
              return (
                <SoftCard
                  key={a.id}
                  variant="flat"
                  style={[styles.card, isDone && styles.cardDone]}
                  testID={`ach-${a.id}`}
                >
                  <View style={styles.cardInner}>
                    <IconChip
                      icon={isDone ? "checkmark" : "lock-closed"}
                      color={isDone ? colors.green : "rgba(255,255,255,0.25)"}
                      filled={isDone}
                      size={52}
                      iconSize={22}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.name, isDone && styles.nameDone]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>{a.name}</Text>
                      <Text style={styles.desc} numberOfLines={2}>{a.desc}</Text>
                    </View>
                  </View>
                </SoftCard>
              );
            })}
          </ScrollView>
        )}
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
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: spacing.lg, paddingTop: spacing.sm,
  },
  iconBtn: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: colors.surfaceCard, borderWidth: 1, borderColor: colors.borderSoft,
    alignItems: "center", justifyContent: "center", ...(shadows.chip as any),
  },
  title: { color: "#FFFFFF", fontSize: 18, fontFamily: fontFamily.extraBold },
  countPill: {
    backgroundColor: colors.surfaceCard, borderWidth: 1, borderColor: colors.borderSoft,
    borderRadius: radius.full, paddingHorizontal: 16, paddingVertical: 8,
    ...(shadows.chip as any),
  },
  countText: { color: "#FFFFFF", fontFamily: fontFamily.black, fontSize: 13 },
  loadingWrap: { flex: 1, alignItems: "center", justifyContent: "center" },
  scroll: { padding: spacing.lg, gap: 12, paddingBottom: spacing.xxl },
  card: { padding: 0 },
  cardDone: { backgroundColor: "rgba(47,178,122,0.14)", borderColor: "rgba(47,178,122,0.30)" },
  cardInner: { flexDirection: "row", alignItems: "center", gap: 14, padding: 14 },
  name: { color: "rgba(255,255,255,0.55)", fontFamily: fontFamily.extraBold, fontSize: 15 },
  nameDone: { color: "#FFFFFF" },
  desc: { color: colors.textMuted, fontSize: 12, marginTop: 2, fontFamily: fontFamily.medium },
});
