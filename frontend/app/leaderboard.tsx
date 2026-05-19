import { useEffect } from "react";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import GameBackground from "../src/components/GameBackground";
import { colors } from "../src/theme";

// Leaderboard removed in the account-free iteration. Bounce any traffic that
// hits this route (old in-app links / deep links) back to home.
export default function LeaderboardRedirect() {
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
