import { View, Text, StyleSheet, Pressable, ScrollView, Animated } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { getAchievementDefs, AchievementDef } from "../src/api";
import { colors, radius, spacing, fontFamily, shadows } from "../src/theme";
import GameBackground from "../src/components/GameBackground";
import SoftCard from "../src/components/SoftCard";
import SoftButton from "../src/components/SoftButton";
import IconChip from "../src/components/IconChip";

export default function GameOverScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    score?: string; words?: string; maxCombo?: string;
    title?: string; bestScore?: string; newAch?: string;
  }>();

  const score = Number(params.score || "0");
  const words = Number(params.words || "0");
  const maxCombo = Number(params.maxCombo || "1");
  const title = params.title || "";
  const bestScore = Number(params.bestScore || "0");
  let newAchIds: string[] = [];
  try { newAchIds = JSON.parse(params.newAch || "[]"); } catch {}
  const isNewRecord = score >= bestScore && score > 0;

  const [achMap, setAchMap] = useState<Record<string, AchievementDef>>({});
  useEffect(() => {
    if (newAchIds.length === 0) return;
    (async () => {
      const defs = await getAchievementDefs();
      const map: Record<string, AchievementDef> = {};
      for (const a of defs) map[a.id] = a;
      setAchMap(map);
    })();
  }, [newAchIds.length]);

  return (
    <GameBackground>
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <ScrollView contentContainerStyle={styles.scroll} testID="game-over-screen">
          <View style={styles.topIcon}>
            <IconChip icon="trophy" color={colors.yellow} size={68} iconSize={32} filled />
          </View>

          <Text style={styles.label}>OYUN BİTTİ</Text>
          {isNewRecord && (<Text style={styles.record} testID="game-over-record">YENİ REKOR</Text>)}

          <Text style={styles.scoreBig} testID="game-over-score">{score}</Text>
          <Text style={styles.scoreSub}>PUAN</Text>

          <SoftCard variant="elevated" style={styles.card}>
            <Row icon="link" color={colors.green} label="Zincir uzunluğu" value={String(words)} />
            <Divider />
            <Row icon="flash" color={colors.orange} label="Max kombo" value={`x${maxCombo}`} />
            <Divider />
            <Row icon="trophy" color={colors.yellow} label="En iyi skor" value={String(Math.max(bestScore, score))} />
            {title ? (<><Divider /><Row icon="ribbon" color={colors.green} label="Unvan" value={title} /></>) : null}
          </SoftCard>

          {newAchIds.length > 0 && (
            <SoftCard variant="flat" style={styles.achCard} testID="game-over-achievements">
              <View style={styles.achHeader}>
                <IconChip icon="ribbon" color={colors.green} size={28} iconSize={14} filled />
                <Text style={styles.achTitle}>YENİ BAŞARIMLAR</Text>
              </View>
              {newAchIds.map((id) => {
                const meta = achMap[id];
                return (
                  <View key={id} style={styles.achRow}>
                    <View style={styles.achBullet}><Text style={styles.achBulletText}>★</Text></View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.achName} numberOfLines={1}>
                        {meta ? meta.name : id.replace(/_/g, " ")}
                      </Text>
                      {meta ? (<Text style={styles.achDesc} numberOfLines={2}>{meta.desc}</Text>) : null}
                    </View>
                  </View>
                );
              })}
            </SoftCard>
          )}

          <View style={styles.btnWrap}>
            <SoftButton testID="game-over-again-button" label="TEKRAR OYNA" icon="refresh" variant="primary" onPress={() => router.replace("/game")} />
          </View>
          <View style={{ marginTop: spacing.sm, width: "100%" }}>
            <SoftButton testID="game-over-home-button" label="ANA MENÜ" variant="neutral" onPress={() => router.replace("/home")} />
          </View>
        </ScrollView>
      </SafeAreaView>
    </GameBackground>
  );
}

function Row({ icon, color, label, value }: { icon: any; color: string; label: string; value: string }) {
  return (
    <View style={styles.row}>
      <View style={styles.rowLeft}>
        <IconChip icon={icon} color={color} size={36} iconSize={16} />
        <Text style={styles.rowLabel}>{label}</Text>
      </View>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}
function Divider() { return <View style={styles.divider} />; }

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { padding: spacing.lg, alignItems: "center", paddingBottom: spacing.xxl },
  topIcon: { marginTop: spacing.md, ...(shadows.chip as any) },
  label: { color: colors.textMuted, letterSpacing: 3, fontFamily: fontFamily.extraBold, fontSize: 12, marginTop: spacing.md },
  record: { color: colors.yellow, fontFamily: fontFamily.black, marginTop: 6, letterSpacing: 2, fontSize: 14 },
  scoreBig: { color: "#FFFFFF", fontSize: 84, fontFamily: fontFamily.black, letterSpacing: -3, marginTop: spacing.sm },
  scoreSub: { color: colors.textSecondary, letterSpacing: 3, fontSize: 12, fontFamily: fontFamily.extraBold },
  card: { width: "100%", marginTop: spacing.xl, paddingHorizontal: spacing.md },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: spacing.md },
  rowLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  rowLabel: { color: colors.textSecondary, fontSize: 14, fontFamily: fontFamily.semibold },
  rowValue: { color: "#FFFFFF", fontSize: 17, fontFamily: fontFamily.extraBold },
  divider: { height: 1, backgroundColor: "rgba(255,255,255,0.06)" },
  achCard: { width: "100%", marginTop: spacing.md, paddingHorizontal: spacing.md, paddingVertical: spacing.md, backgroundColor: "rgba(47,178,122,0.10)", borderColor: "rgba(47,178,122,0.32)" },
  achHeader: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
  achTitle: { color: colors.green, fontSize: 11, letterSpacing: 2, fontFamily: fontFamily.extraBold },
  achRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8 },
  achBullet: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(47,178,122,0.22)", borderWidth: 1, borderColor: "rgba(47,178,122,0.4)" },
  achBulletText: { color: colors.yellow, fontSize: 14, fontFamily: fontFamily.black },
  achName: { color: "#FFFFFF", fontSize: 14, fontFamily: fontFamily.extraBold },
  achDesc: { color: colors.textMuted, fontSize: 11, marginTop: 2, fontFamily: fontFamily.medium },
  btnWrap: { width: "100%", marginTop: spacing.xl },
});
