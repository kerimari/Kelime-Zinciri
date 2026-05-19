import { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Animated,
  Easing,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import {
  recordGameResult,
  getAchievementDefs,
  titleForScore,
} from "../src/api";
import { pickStartWord, validateWord } from "../src/dictionary";
import { colors, radius, spacing, fontFamily, shadows } from "../src/theme";
import { TileRow } from "../src/components/LetterTile";
import GameBackground from "../src/components/GameBackground";
import CircularTimer from "../src/components/CircularTimer";

const GAME_DURATION = 30000;
const TIME_BONUS = 3000;
const COMBO_WINDOW = 3000;
const MAX_TIME = 45000;
const TICK_MS = 50;

export default function GameScreen() {
  const router = useRouter();
  const [prevWord, setPrevWord] = useState<string>("");
  const [chain, setChain] = useState<string[]>([]);
  const [usedWordsList, setUsedWordsList] = useState<string[]>([]);
  const [input, setInput] = useState("");
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(1);
  const [maxCombo, setMaxCombo] = useState(1);
  const [wordsFound, setWordsFound] = useState(0);
  const [timeMs, setTimeMs] = useState(GAME_DURATION);
  const [status, setStatus] = useState<"loading" | "playing" | "ended" | "error">("loading");
  const [feedback, setFeedback] = useState<{ type: "ok" | "bad"; text: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [boostTick, setBoostTick] = useState(0);
  const [startError, setStartError] = useState<string>("");
  const [startAttempt, setStartAttempt] = useState(0);

  const lastInputAtRef = useRef<number>(Date.now());
  const timerRef = useRef<any>(null);
  const inputRef = useRef<TextInput | null>(null);

  // Session-level achievement metrics (not React state to avoid render churn).
  const startTimeRef = useRef<number>(Date.now());
  const longestWordRef = useRef<number>(0);
  const sevenCountRef = useRef<number>(0);
  const threeCountRef = useRef<number>(0);
  const hadInvalidRef = useRef<boolean>(false);
  const firstLettersRef = useRef<Set<string>>(new Set());

  const shakeX = useRef(new Animated.Value(0)).current;
  const scoreBump = useRef(new Animated.Value(1)).current;
  const chainBump = useRef(new Animated.Value(1)).current;
  const inputGlow = useRef(new Animated.Value(0)).current;
  const comboTint = useRef(new Animated.Value(0)).current;
  const submitBtnScale = useRef(new Animated.Value(1)).current;

  const floatY = useRef(new Animated.Value(0)).current;
  const floatOpacity = useRef(new Animated.Value(0)).current;
  const floatScale = useRef(new Animated.Value(1)).current;
  const [floatText, setFloatText] = useState<string>("");
  const [floatCombo, setFloatCombo] = useState<number>(1);

  useEffect(() => {
    setStatus("loading");
    setStartError("");
    try {
      const word = pickStartWord();
      if (!word) throw new Error("Sözlük yüklenemedi");
      setPrevWord(word);
      setStatus("playing");
      setUsedWordsList([word]);
      lastInputAtRef.current = Date.now();
      setTimeMs(GAME_DURATION);
      setScore(0);
      setCombo(1);
      setMaxCombo(1);
      setWordsFound(0);
      setChain([]);
      setInput("");
      setFeedback(null);
      // Reset session-level achievement trackers
      startTimeRef.current = Date.now();
      longestWordRef.current = 0;
      sevenCountRef.current = 0;
      threeCountRef.current = 0;
      hadInvalidRef.current = false;
      firstLettersRef.current = new Set();
      setTimeout(() => inputRef.current?.focus(), 250);
    } catch (e: any) {
      const msg = e?.message ? String(e.message) : String(e);
      console.warn("[game] start failed", msg);
      setStartError(msg || "Oyun başlatılamadı");
      setStatus("error");
    }
  }, [startAttempt]);

  useEffect(() => {
    if (status !== "playing") return;
    timerRef.current = setInterval(() => {
      setTimeMs((t) => {
        const next = t - TICK_MS;
        if (next <= 0) { clearInterval(timerRef.current); return 0; }
        return next;
      });
    }, TICK_MS);
    return () => clearInterval(timerRef.current);
  }, [status]);

  useEffect(() => {
    if (status === "playing" && timeMs <= 0) endGame();
  }, [timeMs, status]);

  const progress = useMemo(() => Math.max(0, Math.min(1, timeMs / GAME_DURATION)), [timeMs]);

  const endGame = async () => {
    if (status === "ended") return;
    setStatus("ended");
    if (timerRef.current) clearInterval(timerRef.current);
    setSubmitting(true);
    try {
      // Save the result locally and resolve any newly-unlocked achievements
      // using the cached achievement defs from /api/achievements.
      const defs = await getAchievementDefs();
      const elapsedMs = Date.now() - startTimeRef.current;
      const avgSec = wordsFound > 0 ? (elapsedMs / 1000) / wordsFound : 99;
      const { stats, newAchievements } = await recordGameResult({
        score,
        words: wordsFound,
        maxCombo,
        longestChain: wordsFound,
        achievements: defs,
        longestWord: longestWordRef.current,
        sevenLetterCount: sevenCountRef.current,
        threeLetterCount: threeCountRef.current,
        hadInvalidAttempt: hadInvalidRef.current,
        avgWordSeconds: avgSec,
        firstLettersUsed: Array.from(firstLettersRef.current),
      });
      router.replace({
        pathname: "/game-over",
        params: {
          score: String(score),
          words: String(wordsFound),
          maxCombo: String(maxCombo),
          title: titleForScore(stats.best_score),
          bestScore: String(stats.best_score),
          newAch: JSON.stringify(newAchievements),
        },
      });
    } catch {
      router.replace({
        pathname: "/game-over",
        params: { score: String(score), words: String(wordsFound), maxCombo: String(maxCombo) },
      });
    } finally {
      setSubmitting(false);
    }
  };

  const shake = () => {
    shakeX.setValue(0);
    Animated.sequence([
      Animated.timing(shakeX, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeX, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeX, { toValue: -6, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeX, { toValue: 6, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeX, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  };

  const bumpScore = () => {
    Animated.sequence([
      Animated.timing(scoreBump, { toValue: 1.3, duration: 120, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(scoreBump, { toValue: 1, duration: 180, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    ]).start();
  };

  const bumpChain = () => {
    Animated.sequence([
      Animated.timing(chainBump, { toValue: 1.25, duration: 120, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(chainBump, { toValue: 1, duration: 200, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    ]).start();
  };

  const flashInput = () => {
    inputGlow.setValue(1);
    Animated.timing(inputGlow, {
      toValue: 0,
      duration: 600,
      easing: Easing.out(Easing.quad),
      useNativeDriver: false,
    }).start();
  };

  const showFloat = (points: number, comboLevel: number) => {
    setFloatText(`+${points}`);
    setFloatCombo(comboLevel);
    floatY.setValue(0);
    floatOpacity.setValue(1);
    floatScale.setValue(comboLevel >= 2 ? 1.35 : 1.0);
    Animated.parallel([
      Animated.timing(floatY, { toValue: -46, duration: 900, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(floatScale, { toValue: 1.0, duration: 220, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.sequence([
        Animated.delay(450),
        Animated.timing(floatOpacity, { toValue: 0, duration: 450, useNativeDriver: true }),
      ]),
    ]).start();
  };

  const updateComboTint = (newCombo: number) => {
    const target = Math.min(1, Math.max(0, (newCombo - 1) / 5));
    Animated.timing(comboTint, {
      toValue: target,
      duration: 350,
      easing: Easing.out(Easing.quad),
      useNativeDriver: false,
    }).start();
  };

  const handleSubmit = () => {
    if (status !== "playing") return;
    const word = input.trim().toLocaleLowerCase("tr-TR");
    if (!word) return;
    setInput("");

    // Validate fully locally against the bundled dictionary — no network call.
    const result = validateWord({
      word,
      previousWord: prevWord,
      usedWords: usedWordsList,
    });

    if (!result.valid) {
      hadInvalidRef.current = true;
      setFeedback({ type: "bad", text: result.reason || "Geçersiz" });
      shake();
      setCombo(1);
      updateComboTint(1);
      setTimeout(() => setFeedback(null), 900);
      return;
    }

    const now = Date.now();
    const elapsed = now - lastInputAtRef.current;
    lastInputAtRef.current = now;

    const newCombo = elapsed <= COMBO_WINDOW ? combo + 1 : 1;
    setCombo(newCombo);
    setMaxCombo((m) => Math.max(m, newCombo));

    // Track session-level achievement metrics
    if (word.length > longestWordRef.current) longestWordRef.current = word.length;
    if (word.length === 7) sevenCountRef.current += 1;
    if (word.length === 3) threeCountRef.current += 1;
    firstLettersRef.current.add(word[0]);

    const base = 10 + word.length * 5;
    const gain = base * newCombo;
    setScore((s) => s + gain);
    setWordsFound((w) => w + 1);
    setTimeMs((t) => Math.min(MAX_TIME, t + TIME_BONUS));
    setBoostTick((b) => b + 1);
    setChain((c) => [...c, prevWord]);
    setUsedWordsList((u) => [...u, word]);
    setPrevWord(word);
    setFeedback(null);
    bumpScore();
    bumpChain();
    flashInput();
    updateComboTint(newCombo);
    showFloat(gain, newCombo);
  };

  const onSubmitIn = () => {
    Animated.timing(submitBtnScale, { toValue: 0.94, duration: 80, useNativeDriver: true }).start();
  };
  const onSubmitOut = () => {
    Animated.spring(submitBtnScale, { toValue: 1, tension: 220, friction: 12, useNativeDriver: true }).start();
  };

  if (status === "loading") {
    return (
      <GameBackground>
        <SafeAreaView style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={colors.green} size="large" />
          <Text style={{ color: colors.textSecondary, marginTop: 12, fontFamily: fontFamily.medium }}>Kelime hazırlanıyor...</Text>
        </SafeAreaView>
      </GameBackground>
    );
  }

  if (status === "error") {
    return (
      <GameBackground>
        <SafeAreaView style={styles.errorScreen} edges={["top", "bottom"]} testID="game-error-screen">
          <View style={styles.errorBadge}>
            <Ionicons name="cloud-offline" size={48} color={colors.danger} />
          </View>
          <Text style={styles.errorTitle}>Oyun başlatılamadı</Text>
          <Text style={styles.errorBody}>{startError || "Sunucuya ulaşılamıyor."}</Text>
          <Text style={styles.errorHint}>İnternet bağlantınızı kontrol edip tekrar deneyin.</Text>
          <View style={styles.errorBtnRow}>
            <Pressable
              testID="game-retry-button"
              onPress={() => setStartAttempt((n) => n + 1)}
              style={[styles.errorBtn, styles.errorBtnPrimary]}
            >
              <Ionicons name="refresh" size={18} color="#FFFFFF" />
              <Text style={styles.errorBtnTextPrimary}>TEKRAR DENE</Text>
            </Pressable>
            <Pressable
              testID="game-back-home-button"
              onPress={() => router.replace("/home")}
              style={[styles.errorBtn, styles.errorBtnGhost]}
            >
              <Text style={styles.errorBtnTextGhost}>ANA MENÜ</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </GameBackground>
    );
  }

  const secondsLeft = Math.max(0, timeMs / 1000);
  const hasInput = input.trim().length > 0;

  const comboTintColor = comboTint.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: ["rgba(230, 138, 60, 0)", "rgba(230, 138, 60, 0.08)", "rgba(230, 138, 60, 0.16)"],
  });
  const tileShadowOpacity = comboTint.interpolate({ inputRange: [0, 1], outputRange: [0, 0.6] });

  return (
    <GameBackground>
      <Animated.View
        pointerEvents="none"
        style={[styles.comboTint, { backgroundColor: comboTintColor as any }]}
      />

      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={{ flex: 1 }}
        >
          <View style={styles.container} testID="game-screen">
            {/* Top bar */}
            <View style={styles.topBar}>
              <Pressable onPress={endGame} style={styles.iconBtn} testID="game-exit-button">
                <Ionicons name="arrow-back" size={20} color="rgba(255,255,255,0.85)" />
              </Pressable>

              <View testID="timer-wrap">
                <CircularTimer
                  progress={progress}
                  seconds={secondsLeft}
                  size={56}
                  strokeWidth={4}
                  boostSignal={boostTick}
                />
              </View>

              <Animated.View
                style={[styles.scorePill, { transform: [{ scale: scoreBump }] }]}
                testID="game-score-pill"
              >
                <Ionicons name="star" size={14} color={colors.yellow} />
                <Text style={styles.scoreText} testID="game-score">{score}</Text>
              </Animated.View>
            </View>

            <ScrollView
              contentContainerStyle={styles.middle}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <View style={styles.targetWrap} testID="game-prev-word">
                <Animated.View
                  style={{
                    ...(Platform.OS === "ios"
                      ? {
                          shadowColor: colors.orange,
                          shadowOpacity: tileShadowOpacity as any,
                          shadowRadius: 18,
                          shadowOffset: { width: 0, height: 0 },
                        }
                      : {}),
                  }}
                >
                  <TileRow word={prevWord} size="lg" variant="white" greenLastLetter gap={8} />
                </Animated.View>

                {floatText ? (
                  <Animated.View
                    pointerEvents="none"
                    style={[
                      styles.floatWrap,
                      { opacity: floatOpacity, transform: [{ translateY: floatY }, { scale: floatScale }] },
                    ]}
                  >
                    <Text style={styles.floatPoints} allowFontScaling={false}>{floatText}</Text>
                    {floatCombo >= 2 ? (
                      <Text style={styles.floatCombo} allowFontScaling={false}>{"  ⚡x"}{floatCombo}</Text>
                    ) : null}
                  </Animated.View>
                ) : null}
              </View>

              <Text style={styles.dotsHint}>. . .</Text>

              <Animated.View style={[styles.inputRow, { transform: [{ translateX: shakeX }] }]}>
                <Animated.View
                  style={[
                    styles.inputWrap,
                    {
                      borderColor: inputGlow.interpolate({
                        inputRange: [0, 1],
                        outputRange: ["rgba(0,0,0,0.06)", colors.green],
                      }) as any,
                      ...(Platform.OS === "ios"
                        ? {
                            shadowColor: colors.green,
                            shadowOpacity: inputGlow as any,
                            shadowRadius: 16,
                            shadowOffset: { width: 0, height: 0 },
                          }
                        : {}),
                    },
                  ]}
                >
                  <TextInput
                    ref={inputRef}
                    testID="game-word-input"
                    style={styles.input}
                    value={input}
                    onChangeText={(t) => setInput(t.toLocaleUpperCase("tr-TR"))}
                    onSubmitEditing={handleSubmit}
                    placeholder="Kelime yaz..."
                    placeholderTextColor="rgba(30,50,80,0.35)"
                    autoCapitalize="characters"
                    autoCorrect={false}
                    autoComplete="off"
                    spellCheck={false}
                    returnKeyType="send"
                    editable={status === "playing"}
                    blurOnSubmit={false}
                    maxLength={7}
                  />
                </Animated.View>
                <Animated.View style={{ transform: [{ scale: submitBtnScale }] }}>
                  <Pressable
                    testID="game-submit-button"
                    onPress={handleSubmit}
                    onPressIn={onSubmitIn}
                    onPressOut={onSubmitOut}
                    style={styles.submitBtnWrap}
                  >
                    <LinearGradient
                      colors={hasInput ? ["#40C88C", colors.greenDark] : ["rgba(255,255,255,0.10)", "rgba(255,255,255,0.04)"]}
                      style={styles.submitBtn}
                    >
                      <LinearGradient
                        colors={["rgba(255,255,255,0.22)", "rgba(255,255,255,0)"]}
                        style={[StyleSheet.absoluteFillObject, { height: "55%", borderRadius: 26 }]}
                        pointerEvents="none"
                      />
                      <Ionicons name="checkmark" size={22} color="#FFFFFF" />
                    </LinearGradient>
                  </Pressable>
                </Animated.View>
              </Animated.View>

              <View style={styles.feedbackWrap}>
                {feedback && feedback.type === "bad" && (
                  <Text style={[styles.feedback, styles.feedbackBad]} testID="game-feedback">
                    {feedback.text}
                  </Text>
                )}
              </View>

              {chain.length > 0 && (
                <View style={styles.chainWrap} testID="chain-history">
                  <View style={styles.chainTiles}>
                    {chain.slice(-4).map((w, idx, arr) => (
                      <View key={`${w}-${idx}`} style={styles.chainItem}>
                        <TileRow word={w} size="xs" variant="muted" greenLastLetter gap={2} />
                        {idx < arr.length - 1 && (
                          <Ionicons name="chevron-forward" size={14} color={colors.textMuted} style={{ marginHorizontal: 4 }} />
                        )}
                      </View>
                    ))}
                  </View>
                  {chain.length > 4 && (
                    <Text style={styles.chainMore}>+{chain.length - 4} kelime</Text>
                  )}
                </View>
              )}
            </ScrollView>

            <View style={styles.bottomBar}>
              <Animated.View style={[styles.chainCounter, { transform: [{ scale: chainBump }] }]} testID="chain-counter">
                <Text style={styles.chainCounterLabel}>ZİNCİR</Text>
                <Text style={styles.chainCounterValue}>{wordsFound}</Text>
              </Animated.View>
            </View>

            {submitting && (
              <View style={styles.overlay}>
                <ActivityIndicator color={colors.green} size="large" />
              </View>
            )}
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </GameBackground>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: { flex: 1 },
  comboTint: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  iconBtn: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: colors.surfaceCard,
    borderWidth: 1, borderColor: colors.borderSoft,
    alignItems: "center", justifyContent: "center",
    ...(shadows.chip as any),
  },
  scorePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.surfaceCard,
    borderWidth: 1, borderColor: colors.borderSoft,
    borderRadius: radius.full,
    paddingHorizontal: 14,
    paddingVertical: 8,
    minWidth: 64,
    justifyContent: "center",
    ...(shadows.chip as any),
  },
  scoreText: { color: "#FFFFFF", fontSize: 15, fontFamily: fontFamily.black },
  middle: { alignItems: "center", paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },
  targetWrap: { marginTop: spacing.lg, alignItems: "center", justifyContent: "center", position: "relative" },
  floatWrap: {
    position: "absolute",
    bottom: -4,
    flexDirection: "row",
    alignItems: "baseline",
    backgroundColor: "rgba(0, 0, 0, 0.35)",
    borderRadius: radius.full,
    paddingHorizontal: 14,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: "rgba(47, 178, 122, 0.35)",
  },
  floatPoints: {
    color: colors.green, fontSize: 20, fontFamily: fontFamily.black, letterSpacing: 0.5,
  },
  floatCombo: {
    color: colors.orange, fontSize: 18, fontFamily: fontFamily.black, letterSpacing: 1,
  },
  dotsHint: { color: colors.textMuted, marginTop: 14, fontSize: 24, letterSpacing: 6 },
  inputRow: {
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    width: "100%",
    position: "relative",
  },
  inputWrap: {
    flex: 1,
    backgroundColor: "#F7F5F0",
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
    paddingHorizontal: 18,
    ...(shadows.chip as any),
  },
  input: {
    paddingVertical: 14,
    color: colors.textOnLight,
    fontSize: 18,
    fontFamily: fontFamily.extraBold,
  },
  submitBtnWrap: { ...(shadows.primaryBtn as any) },
  submitBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  feedbackWrap: { height: 26, marginTop: 10, alignItems: "center", justifyContent: "center" },
  feedback: { fontSize: 15, fontFamily: fontFamily.extraBold, letterSpacing: 1 },
  feedbackBad: { color: colors.danger },
  chainWrap: { marginTop: spacing.lg, alignItems: "center" },
  chainTiles: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", justifyContent: "center" },
  chainItem: { flexDirection: "row", alignItems: "center", marginVertical: 4 },
  chainMore: { color: colors.textMuted, fontSize: 12, marginTop: 6, fontFamily: fontFamily.medium },
  bottomBar: { paddingVertical: spacing.md, alignItems: "center" },
  chainCounter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.surfaceCard,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: radius.full,
    paddingHorizontal: 20,
    paddingVertical: 10,
    ...(shadows.chip as any),
  },
  chainCounterLabel: { color: colors.textSecondary, fontSize: 11, letterSpacing: 2, fontFamily: fontFamily.extraBold },
  chainCounterValue: { color: "#FFFFFF", fontSize: 16, fontFamily: fontFamily.black },
  overlay: {
    position: "absolute",
    top: 0, left: 0, right: 0, bottom: 0,
    alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(6, 25, 40, 0.75)",
  },
  errorScreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
  },
  errorBadge: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: "rgba(225,90,107,0.12)",
    borderWidth: 1,
    borderColor: "rgba(225,90,107,0.30)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.sm,
  },
  errorTitle: { color: "#FFFFFF", fontSize: 22, fontFamily: fontFamily.extraBold, letterSpacing: -0.3 },
  errorBody: { color: colors.textSecondary, fontSize: 14, textAlign: "center", fontFamily: fontFamily.medium, paddingHorizontal: 8 },
  errorHint: { color: colors.textMuted, fontSize: 12, textAlign: "center", fontFamily: fontFamily.medium },
  errorBtnRow: { width: "100%", marginTop: spacing.lg, gap: 10 },
  errorBtn: { paddingVertical: 14, paddingHorizontal: 24, borderRadius: radius.full, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8 },
  errorBtnPrimary: { backgroundColor: colors.green, ...(shadows.primaryBtn as any) },
  errorBtnGhost: { backgroundColor: "rgba(255,255,255,0.06)", borderWidth: 1, borderColor: colors.border },
  errorBtnTextPrimary: { color: "#FFFFFF", fontFamily: fontFamily.extraBold, fontSize: 14, letterSpacing: 1.5 },
  errorBtnTextGhost: { color: colors.textSecondary, fontFamily: fontFamily.extraBold, fontSize: 13, letterSpacing: 1.2 },
});
