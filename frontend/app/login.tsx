import { useEffect } from "react";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import GameBackground from "../src/components/GameBackground";
import { colors } from "../src/theme";

// Kept as a route shell for backward-compatible deep links — the app no longer
// has user accounts, so we redirect any /login traffic to home.
export default function LoginScreen() {
  const router = useRouter();
  useEffect(() => {
    try { router.replace("/home"); } catch { router.push("/home"); }
  }, []);
  return (
    <GameBackground>
      <View style={styles.container}>
        <ActivityIndicator color={colors.green} />
      </View>
    </GameBackground>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center" },
});
