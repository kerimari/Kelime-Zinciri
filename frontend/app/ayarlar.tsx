import { useCallback, useEffect, useState } from "react";
import {
  View, Text, StyleSheet, Pressable, ScrollView, Switch, Animated, Alert,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { resetStats } from "../src/api";
import { colors, radius, spacing, fontFamily, shadows } from "../src/theme";
import GameBackground from "../src/components/GameBackground";
import SoftCard from "../src/components/SoftCard";
import IconChip from "../src/components/IconChip";

const KEY_SOUND = "kz_sound";
const KEY_HAPTICS = "kz_haptics";

export default function SettingsScreen() {
  const router = useRouter();
  const [sound, setSound] = useState(true);
  const [haptics, setHaptics] = useState(true);

  useEffect(() => {
    (async () => {
      const s = await AsyncStorage.getItem(KEY_SOUND);
      const h = await AsyncStorage.getItem(KEY_HAPTICS);
      if (s !== null) setSound(s === "1");
      if (h !== null) setHaptics(h === "1");
    })();
  }, []);

  const toggleSound = useCallback(async (v: boolean) => {
    setSound(v);
    await AsyncStorage.setItem(KEY_SOUND, v ? "1" : "0");
  }, []);
  const toggleHaptics = useCallback(async (v: boolean) => {
    setHaptics(v);
    await AsyncStorage.setItem(KEY_HAPTICS, v ? "1" : "0");
  }, []);

  const handleReset = () => {
    Alert.alert(
      "İstatistikleri sıfırla",
      "Tüm skorlarınız, başarımlarınız ve oyun geçmişiniz silinecek. Devam etmek istiyor musunuz?",
      [
        { text: "İptal", style: "cancel" },
        {
          text: "Sıfırla", style: "destructive",
          onPress: async () => {
            await resetStats();
            Alert.alert("Sıfırlandı", "İstatistikleriniz silindi.");
          },
        },
      ]
    );
  };

  return (
    <GameBackground>
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <View style={styles.header}>
          <BackBtn onPress={() => router.back()} testID="settings-back" />
          <Text style={styles.headerTitle}>Ayarlar</Text>
          <View style={{ width: 42 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scroll} testID="settings-screen">
          <Text style={styles.sectionLabel}>TERCİHLER</Text>
          <SoftCard variant="flat" style={styles.card}>
            <Row
              icon="volume-high" color={colors.green} label="Ses efektleri"
              right={
                <Switch testID="settings-toggle-sound" value={sound} onValueChange={toggleSound}
                  trackColor={{ true: colors.green, false: "rgba(255,255,255,0.12)" }} thumbColor="#FFFFFF" />
              }
            />
            <Divider />
            <Row
              icon="phone-portrait" color={colors.blue} label="Titreşim"
              right={
                <Switch testID="settings-toggle-haptics" value={haptics} onValueChange={toggleHaptics}
                  trackColor={{ true: colors.green, false: "rgba(255,255,255,0.12)" }} thumbColor="#FFFFFF" />
              }
            />
          </SoftCard>

          <Text style={styles.sectionLabel}>GENEL</Text>
          <SoftCard variant="flat" style={styles.card}>
            <LinkRow icon="stats-chart" color={colors.blue} label="İstatistikler" onPress={() => router.push("/stats")} testID="settings-stats-link" />
            <Divider />
            <LinkRow icon="ribbon" color={colors.green} label="Başarımlar" onPress={() => router.push("/achievements")} testID="settings-achievements-link" />
          </SoftCard>

          <Pressable style={styles.resetBtn} onPress={handleReset} testID="settings-reset-button">
            <Ionicons name="refresh-outline" size={18} color={colors.danger} />
            <Text style={styles.resetText}>İstatistikleri Sıfırla</Text>
          </Pressable>

          <Text style={styles.version}>Kelime Zinciri · v1.0</Text>
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

function Row({ icon, color, label, right }: { icon: any; color: string; label: string; right: React.ReactNode }) {
  return (
    <View style={styles.row}>
      <View style={styles.rowLeft}>
        <IconChip icon={icon} color={color} size={36} iconSize={16} />
        <Text style={styles.rowLabel}>{label}</Text>
      </View>
      {right}
    </View>
  );
}
function LinkRow({ icon, color, label, onPress, testID }: any) {
  return (
    <Pressable style={styles.row} onPress={onPress} testID={testID}>
      <View style={styles.rowLeft}>
        <IconChip icon={icon} color={color} size={36} iconSize={16} />
        <Text style={styles.rowLabel}>{label}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    </Pressable>
  );
}
function Divider() { return <View style={styles.divider} />; }

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  iconBtn: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: colors.surfaceCard, borderWidth: 1, borderColor: colors.borderSoft,
    alignItems: "center", justifyContent: "center", ...(shadows.chip as any),
  },
  headerTitle: { color: "#FFFFFF", fontSize: 18, fontFamily: fontFamily.extraBold },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xxl, gap: 12 },
  sectionLabel: {
    color: colors.textMuted, fontSize: 11, letterSpacing: 2,
    fontFamily: fontFamily.extraBold, marginTop: 12, marginBottom: 4, paddingHorizontal: 4,
  },
  card: { paddingHorizontal: spacing.md, paddingVertical: 4 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 12 },
  rowLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  rowLabel: { color: "#FFFFFF", fontSize: 14, fontFamily: fontFamily.semibold },
  divider: { height: 1, backgroundColor: "rgba(255,255,255,0.06)" },
  resetBtn: {
    marginTop: spacing.lg,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: "rgba(225,90,107,0.10)",
    borderWidth: 1, borderColor: "rgba(225,90,107,0.28)",
    borderRadius: radius.full, paddingVertical: 14,
    ...(shadows.chip as any),
  },
  resetText: { color: colors.danger, fontFamily: fontFamily.extraBold, letterSpacing: 1 },
  version: { color: colors.textMuted, textAlign: "center", marginTop: spacing.md, fontSize: 11, letterSpacing: 1, fontFamily: fontFamily.medium },
});
