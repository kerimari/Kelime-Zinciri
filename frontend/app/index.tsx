import { useEffect } from "react";
import { View, StyleSheet, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { colors } from "../src/theme";
import GameBackground from "../src/components/GameBackground";

// Account-free entrypoint: the app boots straight into the home screen.
export default function Index() {
  const router = useRouter();
  useEffect(() => {
    const t = setTimeout(() => {
      try { router.replace("/home"); } catch { router.push("/home"); }
    }, 30);
    return () => clearTimeout(t);
  }, []);
  return (
    <GameBackground>
      <View style={styles.container} testID="splash-screen">
        <ActivityIndicator color={colors.green} />
      </View>
    </GameBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center" },
});
