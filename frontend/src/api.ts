import AsyncStorage from "@react-native-async-storage/async-storage";

// ─── BACKEND ORIGIN RESOLUTION ────────────────────────────────────────────────
// We had reports of iOS Expo Go users getting "404 page not found" — that exact
// body is what the ngrok/tunnel Go server returns when the path doesn't match.
// To make the app maximally resilient we:
//   1. Hard-code the Cloudflare-fronted prod backend as the primary origin.
//   2. Honor EXPO_PUBLIC_BACKEND_URL only as an explicit override (and reject
//      values that look like a Metro/ngrok tunnel).
//   3. Always sanitize (strip trailing slash, strip any trailing "/api").
const HARDCODED_BACKEND = "https://kelime-zinciri-4.preview.emergentagent.com";

function sanitizeOrigin(raw: string | undefined | null): string | null {
  if (!raw) return null;
  let s = String(raw).trim();
  if (!s) return null;
  while (s.endsWith("/")) s = s.slice(0, -1);
  if (s.toLowerCase().endsWith("/api")) s = s.slice(0, -4);
  if (!/^https?:\/\//i.test(s)) return null;
  if (/ngrok|exp\.host|metro/i.test(s)) return null;
  return s;
}

function resolveOrigin(): string {
  const fromEnv = sanitizeOrigin(process.env.EXPO_PUBLIC_BACKEND_URL as any);
  return fromEnv || HARDCODED_BACKEND;
}

const ORIGIN = resolveOrigin();

function buildUrl(path: string): string {
  let p = path || "";
  if (!p.startsWith("/")) p = "/" + p;
  if (p.startsWith("/api/")) p = p.slice(4);
  return `${ORIGIN}/api${p}`;
}

async function withTimeout<T>(p: Promise<T>, ms = 15000): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("İstek zaman aşımına uğradı")), ms);
    p.then((v) => { clearTimeout(t); resolve(v); }).catch((e) => { clearTimeout(t); reject(e); });
  });
}

async function readErrBody(res: Response): Promise<string> {
  try {
    const ct = res.headers.get("content-type") || "";
    if (ct.includes("application/json")) {
      const j: any = await res.json();
      if (j && typeof j === "object") {
        if (typeof j.detail === "string") return j.detail;
        if (typeof j.message === "string") return j.message;
        return JSON.stringify(j).slice(0, 120);
      }
    }
    const txt = await res.text();
    if (!txt) return `HTTP ${res.status}`;
    if (/^404 page not found/i.test(txt.trim())) {
      return `Sunucuya ulaşılamadı (HTTP 404). URL: ${res.url}`;
    }
    if (txt.length > 200) return `HTTP ${res.status}`;
    return txt;
  } catch {
    return `HTTP ${res.status}`;
  }
}

async function doFetch(input: string, init?: RequestInit): Promise<Response> {
  try {
    return await withTimeout(fetch(input, init));
  } catch (e: any) {
    const msg = e?.message ? String(e.message) : String(e);
    console.warn("[api] network error", input, msg);
    throw new Error(`Bağlantı hatası: ${msg}`);
  }
}

export async function apiPost<T>(path: string, body: any): Promise<T> {
  const url = buildUrl(path);
  if (__DEV__) console.log("[api] POST", url);
  const res = await doFetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const msg = await readErrBody(res);
    console.warn("[api] POST non-OK", url, res.status, msg);
    throw new Error(msg);
  }
  return res.json();
}

export async function apiGet<T>(path: string): Promise<T> {
  const url = buildUrl(path);
  if (__DEV__) console.log("[api] GET", url);
  const res = await doFetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) {
    const msg = await readErrBody(res);
    console.warn("[api] GET non-OK", url, res.status, msg);
    throw new Error(msg);
  }
  return res.json();
}

export const apiOrigin = ORIGIN;

// ─── LOCAL PLAYER STATE (no backend account required) ────────────────────────
// The app is single-player and offline-friendly. All stats and unlocked
// achievements are kept on the device via AsyncStorage. No login required.
export type LocalStats = {
  best_score: number;
  total_score: number;
  games_played: number;
  words_total: number;
  max_combo: number;
  longest_chain: number;
  achievements: string[]; // ids of unlocked achievements
  last_played_at?: string;

  // Extended metrics (v2) — unlock more diverse achievements without changing
  // the gameplay loop. All cumulative across all sessions.
  longest_word: number;        // longest single word the player has ever played
  seven_letter_count: number;  // total 7-letter words played
  three_letter_count: number;  // total 3-letter words played
  perfect_games: number;       // games completed without a single invalid attempt
  fast_games: number;          // games where avg-word-time was < 2s
  unique_first_letters: number;// distinct first letters used across all games (max 29)
  best_score_no_invalid: number; // best score within a perfect game
  combo_unlocks_total: number; // cumulative combo windows (combo>=3 entries)
};

const STATS_KEY = "kz_local_stats_v1";

export function emptyStats(): LocalStats {
  return {
    best_score: 0,
    total_score: 0,
    games_played: 0,
    words_total: 0,
    max_combo: 0,
    longest_chain: 0,
    achievements: [],
    longest_word: 0,
    seven_letter_count: 0,
    three_letter_count: 0,
    perfect_games: 0,
    fast_games: 0,
    unique_first_letters: 0,
    best_score_no_invalid: 0,
    combo_unlocks_total: 0,
  };
}

export async function loadStats(): Promise<LocalStats> {
  try {
    const s = await AsyncStorage.getItem(STATS_KEY);
    if (!s) return emptyStats();
    const parsed = JSON.parse(s);
    return { ...emptyStats(), ...parsed };
  } catch {
    return emptyStats();
  }
}

export async function saveStats(stats: LocalStats): Promise<void> {
  try {
    await AsyncStorage.setItem(STATS_KEY, JSON.stringify(stats));
  } catch (e) {
    console.warn("saveStats error", e);
  }
}

export async function resetStats(): Promise<void> {
  try {
    await AsyncStorage.removeItem(STATS_KEY);
  } catch {}
}

export type AchievementDef = {
  id: string;
  name: string;
  desc: string;
  threshold: number;
  metric: keyof LocalStats | "longest_chain" | "max_combo" | "best_score" | "total_score" | "games_played" | "words_total";
};

/**
 * Mirror the backend ACHIEVEMENTS list shape. Pulled from /api/achievements
 * once at startup (and cached). This file holds the resolution logic.
 */
export function evaluateUnlocks(
  prev: LocalStats,
  next: LocalStats,
  defs: AchievementDef[]
): string[] {
  const newly: string[] = [];
  const already = new Set(prev.achievements);
  for (const d of defs) {
    if (already.has(d.id)) continue;
    const val = (next as any)[d.metric];
    if (typeof val === "number" && val >= d.threshold) {
      newly.push(d.id);
    }
  }
  return newly;
}

/**
 * Compose a new stats object from the just-finished game session and persist it.
 * Returns the merged stats and the list of newly-unlocked achievement ids.
 */
export async function recordGameResult(input: {
  score: number;
  words: number;
  maxCombo: number;
  longestChain: number;
  achievements: AchievementDef[];
  // Optional session-level details that unlock the diverse achievements.
  longestWord?: number;            // longest word length in this session
  sevenLetterCount?: number;       // 7-letter words in this session
  threeLetterCount?: number;       // 3-letter words in this session
  hadInvalidAttempt?: boolean;     // any invalid try this session
  avgWordSeconds?: number;         // avg seconds between accepted words
  firstLettersUsed?: string[];     // distinct first-letters used in this session
}): Promise<{ stats: LocalStats; newAchievements: string[] }> {
  const prev = await loadStats();

  const isPerfect = !input.hadInvalidAttempt && input.words > 0;
  const isFast = (input.avgWordSeconds ?? 99) < 2 && input.words >= 5;

  // Merge unique first-letters used across all games into a stored bitmap-like
  // count (we keep just the count; the bitmap itself is regenerated per game).
  const prevLetters: string[] = (prev as any).unique_first_letters_set || [];
  const allLetters = new Set<string>([...prevLetters, ...(input.firstLettersUsed || [])]);

  const next: LocalStats = {
    best_score: Math.max(prev.best_score, input.score),
    total_score: prev.total_score + input.score,
    games_played: prev.games_played + 1,
    words_total: prev.words_total + input.words,
    max_combo: Math.max(prev.max_combo, input.maxCombo),
    longest_chain: Math.max(prev.longest_chain, input.longestChain),
    achievements: prev.achievements.slice(),
    last_played_at: new Date().toISOString(),

    longest_word: Math.max(prev.longest_word, input.longestWord ?? 0),
    seven_letter_count: prev.seven_letter_count + (input.sevenLetterCount ?? 0),
    three_letter_count: prev.three_letter_count + (input.threeLetterCount ?? 0),
    perfect_games: prev.perfect_games + (isPerfect ? 1 : 0),
    fast_games: prev.fast_games + (isFast ? 1 : 0),
    unique_first_letters: allLetters.size,
    best_score_no_invalid: isPerfect
      ? Math.max(prev.best_score_no_invalid, input.score)
      : prev.best_score_no_invalid,
    combo_unlocks_total: prev.combo_unlocks_total + (input.maxCombo >= 3 ? 1 : 0),
  };
  // Stash the cumulative letter set alongside the visible stats so it can
  // grow across sessions.
  (next as any).unique_first_letters_set = Array.from(allLetters);

  const newly = evaluateUnlocks(prev, next, input.achievements);
  if (newly.length) {
    next.achievements = Array.from(new Set([...next.achievements, ...newly]));
  }
  await saveStats(next);
  return { stats: next, newAchievements: newly };
}

// Embedded fallback list — keeps achievements working even if /api/achievements
// is unreachable (offline, captive portal, etc.). Must stay in sync with
// /app/backend/server.py:ACHIEVEMENTS.
const FALLBACK_ACHIEVEMENTS: AchievementDef[] = [
  { id: "first_word", name: "İlk Adım", desc: "İlk oyununu tamamla", threshold: 1, metric: "games_played" },
  { id: "chain_5", name: "Zincir Ustası", desc: "Tek oyunda 5 kelimelik zincir kur", threshold: 5, metric: "longest_chain" },
  { id: "chain_7", name: "Yedi Güzel", desc: "Tek oyunda 7 kelimelik zincir kur", threshold: 7, metric: "longest_chain" },
  { id: "chain_10", name: "Kelime Canavarı", desc: "Tek oyunda 10 kelimelik zincir kur", threshold: 10, metric: "longest_chain" },
  { id: "chain_15", name: "Zincir Şampiyonu", desc: "Tek oyunda 15 kelimelik zincir kur", threshold: 15, metric: "longest_chain" },
  { id: "chain_20", name: "Efsane Zincir", desc: "Tek oyunda 20 kelimelik zincir kur", threshold: 20, metric: "longest_chain" },
  { id: "chain_25", name: "Çeyrek Asır", desc: "Tek oyunda 25 kelimelik zincir kur", threshold: 25, metric: "longest_chain" },
  { id: "chain_30", name: "Ölümsüz Zincir", desc: "Tek oyunda 30 kelimelik zincir kur", threshold: 30, metric: "longest_chain" },
  { id: "chain_40", name: "Zirve Avcısı", desc: "Tek oyunda 40 kelimelik zincir kur", threshold: 40, metric: "longest_chain" },
  { id: "chain_50", name: "Tanrısal Zincir", desc: "Tek oyunda 50 kelimelik zincir kur", threshold: 50, metric: "longest_chain" },
  { id: "score_100", name: "Yüzlük Kulüp", desc: "Tek oyunda 100+ puan topla", threshold: 100, metric: "best_score" },
  { id: "score_200", name: "İki Yüzlük", desc: "Tek oyunda 200+ puan topla", threshold: 200, metric: "best_score" },
  { id: "score_300", name: "Üç Yüzlük", desc: "Tek oyunda 300+ puan topla", threshold: 300, metric: "best_score" },
  { id: "score_500", name: "Beş Yüzlük", desc: "Tek oyunda 500+ puan topla", threshold: 500, metric: "best_score" },
  { id: "score_750", name: "Yedi Yüz Elli", desc: "Tek oyunda 750+ puan topla", threshold: 750, metric: "best_score" },
  { id: "score_1000", name: "Binlik Zirve", desc: "Tek oyunda 1000+ puan topla", threshold: 1000, metric: "best_score" },
  { id: "score_2000", name: "Muhteşem", desc: "Tek oyunda 2000+ puan topla", threshold: 2000, metric: "best_score" },
  { id: "score_3000", name: "Görkemli", desc: "Tek oyunda 3000+ puan topla", threshold: 3000, metric: "best_score" },
  { id: "score_5000", name: "Efsane Skor", desc: "Tek oyunda 5000+ puan topla", threshold: 5000, metric: "best_score" },
  { id: "score_10000", name: "On Bin Kralı", desc: "Tek oyunda 10000+ puan topla", threshold: 10000, metric: "best_score" },
  { id: "combo_3", name: "Hızlı Başlangıç", desc: "3x kombo yap", threshold: 3, metric: "max_combo" },
  { id: "combo_5", name: "Kombo Ustası", desc: "5x kombo yap", threshold: 5, metric: "max_combo" },
  { id: "combo_6", name: "Altıgen", desc: "6x kombo yap", threshold: 6, metric: "max_combo" },
  { id: "combo_8", name: "Yıldırım", desc: "8x kombo yap", threshold: 8, metric: "max_combo" },
  { id: "combo_10", name: "Işık Hızı", desc: "10x kombo yap", threshold: 10, metric: "max_combo" },
  { id: "combo_12", name: "Şimşek Hızında", desc: "12x kombo yap", threshold: 12, metric: "max_combo" },
  { id: "combo_15", name: "Süpernova", desc: "15x kombo yap", threshold: 15, metric: "max_combo" },
  { id: "combo_20", name: "Kara Delik", desc: "20x kombo yap", threshold: 20, metric: "max_combo" },
  { id: "games_5", name: "Merhaba", desc: "5 oyun oyna", threshold: 5, metric: "games_played" },
  { id: "games_10", name: "Sadık Oyuncu", desc: "10 oyun oyna", threshold: 10, metric: "games_played" },
  { id: "games_25", name: "Düzenli", desc: "25 oyun oyna", threshold: 25, metric: "games_played" },
  { id: "games_50", name: "Veteran", desc: "50 oyun oyna", threshold: 50, metric: "games_played" },
  { id: "games_100", name: "Bağımlı", desc: "100 oyun oyna", threshold: 100, metric: "games_played" },
  { id: "games_250", name: "Azimli", desc: "250 oyun oyna", threshold: 250, metric: "games_played" },
  { id: "games_500", name: "Efsanevi Oyuncu", desc: "500 oyun oyna", threshold: 500, metric: "games_played" },
  { id: "words_50", name: "Sözcük Filizi", desc: "Toplam 50 kelime bul", threshold: 50, metric: "words_total" },
  { id: "words_100", name: "Kelime Toplayıcı", desc: "Toplam 100 kelime bul", threshold: 100, metric: "words_total" },
  { id: "words_250", name: "Lügat Dostu", desc: "Toplam 250 kelime bul", threshold: 250, metric: "words_total" },
  { id: "words_500", name: "Kelime Hazinesi", desc: "Toplam 500 kelime bul", threshold: 500, metric: "words_total" },
  { id: "words_1000", name: "Sözlük Efendisi", desc: "Toplam 1000 kelime bul", threshold: 1000, metric: "words_total" },
  { id: "words_2500", name: "Dil Virtüözü", desc: "Toplam 2500 kelime bul", threshold: 2500, metric: "words_total" },
  { id: "words_5000", name: "Kelime Titanı", desc: "Toplam 5000 kelime bul", threshold: 5000, metric: "words_total" },
  { id: "total_1000", name: "İlk Bin", desc: "Toplam 1000 puana ulaş", threshold: 1000, metric: "total_score" },
  { id: "total_5000", name: "Beş Bin Milyoner", desc: "Toplam 5000 puana ulaş", threshold: 5000, metric: "total_score" },
  { id: "total_20000", name: "Yirmi Bin", desc: "Toplam 20000 puana ulaş", threshold: 20000, metric: "total_score" },
  { id: "total_50000", name: "Elli Bin Kralı", desc: "Toplam 50000 puana ulaş", threshold: 50000, metric: "total_score" },
  { id: "total_100000", name: "Yüz Bin İmparatoru", desc: "Toplam 100000 puana ulaş", threshold: 100000, metric: "total_score" },
  { id: "total_500000", name: "Yarım Milyon", desc: "Toplam 500000 puana ulaş", threshold: 500000, metric: "total_score" },

  // ── Yeni başarımlar (v2): kelime uzunluğu ─────────────────────────────────
  { id: "long_word_5", name: "Beş Harfli", desc: "5 harfli bir kelime oyna", threshold: 5, metric: "longest_word" },
  { id: "long_word_6", name: "Altı Harfli", desc: "6 harfli bir kelime oyna", threshold: 6, metric: "longest_word" },
  { id: "long_word_7", name: "Yedi Harfli Maestro", desc: "7 harfli bir kelime oyna", threshold: 7, metric: "longest_word" },

  // ── 7-harfli kelime sayısı (cumulative) ───────────────────────────────────
  { id: "seven_5", name: "Uzun Kelime Sevdalısı", desc: "Toplamda 5 adet 7 harfli kelime kullan", threshold: 5, metric: "seven_letter_count" },
  { id: "seven_20", name: "Uzun Kelime Avcısı", desc: "Toplamda 20 adet 7 harfli kelime kullan", threshold: 20, metric: "seven_letter_count" },
  { id: "seven_50", name: "Yedi Harf Profesörü", desc: "Toplamda 50 adet 7 harfli kelime kullan", threshold: 50, metric: "seven_letter_count" },

  // ── 3-harfli kelime sayısı (kısa kelime stratejisi) ───────────────────────
  { id: "three_25", name: "Kısa ve Öz", desc: "Toplamda 25 adet 3 harfli kelime kullan", threshold: 25, metric: "three_letter_count" },
  { id: "three_100", name: "Mini Kelime Ustası", desc: "Toplamda 100 adet 3 harfli kelime kullan", threshold: 100, metric: "three_letter_count" },

  // ── Mükemmel oyun (hatasız tamamlanan oyun) ────────────────────────────────
  { id: "perfect_1", name: "Kusursuz Başlangıç", desc: "İlk mükemmel oyununu (hatasız) tamamla", threshold: 1, metric: "perfect_games" },
  { id: "perfect_5", name: "Kusursuz Beşli", desc: "5 mükemmel (hatasız) oyun oyna", threshold: 5, metric: "perfect_games" },
  { id: "perfect_20", name: "Mükemmeliyetçi", desc: "20 mükemmel (hatasız) oyun oyna", threshold: 20, metric: "perfect_games" },
  { id: "perfect_score_500", name: "Saf Performans", desc: "Hatasız bir oyunda 500+ puan topla", threshold: 500, metric: "best_score_no_invalid" },
  { id: "perfect_score_1500", name: "Tertemiz Zafer", desc: "Hatasız bir oyunda 1500+ puan topla", threshold: 1500, metric: "best_score_no_invalid" },

  // ── Hızlı oyun (ortalama < 2 sn / kelime) ─────────────────────────────────
  { id: "fast_1", name: "Hızlı Refleks", desc: "İlk hızlı oyununu (ort. <2 sn) tamamla", threshold: 1, metric: "fast_games" },
  { id: "fast_10", name: "Şimşek Hızında Oyuncu", desc: "10 hızlı oyun oyna (ort. <2 sn)", threshold: 10, metric: "fast_games" },

  // ── Alfabe çeşitliliği ────────────────────────────────────────────────────
  { id: "letters_10", name: "Alfabe Gezgini", desc: "10 farklı harfle başlayan kelime kullan", threshold: 10, metric: "unique_first_letters" },
  { id: "letters_20", name: "Harf Kaşifi", desc: "20 farklı harfle başlayan kelime kullan", threshold: 20, metric: "unique_first_letters" },
  { id: "letters_29", name: "Tam Alfabe", desc: "Türk alfabesindeki 29 harfle başlayan kelimeleri kullan", threshold: 29, metric: "unique_first_letters" },

  // ── Kombo tutkunu (oyunlarda toplamda 3+ kombo yapma sayısı) ──────────────
  { id: "combo_unlock_5", name: "Kombo Tutkunu", desc: "Toplam 5 oyunda 3+ kombo yap", threshold: 5, metric: "combo_unlocks_total" },
  { id: "combo_unlock_25", name: "Kombo Bağımlısı", desc: "Toplam 25 oyunda 3+ kombo yap", threshold: 25, metric: "combo_unlocks_total" },
  { id: "combo_unlock_100", name: "Kombo Efendisi", desc: "Toplam 100 oyunda 3+ kombo yap", threshold: 100, metric: "combo_unlocks_total" },
];

// Cached achievement defs — uses the embedded FALLBACK_ACHIEVEMENTS list as
// the primary source so the achievement engine works 100% offline. We no
// longer hit /api/achievements from the client (network failures were causing
// production crashes in Play Store).
let _cachedAchievements: AchievementDef[] | null = null;
export async function getAchievementDefs(): Promise<AchievementDef[]> {
  if (_cachedAchievements && _cachedAchievements.length > 0) return _cachedAchievements;
  _cachedAchievements = FALLBACK_ACHIEVEMENTS;
  return _cachedAchievements;
}

// Title bands — replicated locally so we no longer rely on /api/users/{u}.title.
const TITLE_BANDS: Array<{ min: number; name: string }> = [
  { min: 0, name: "Çaylak" },
  { min: 500, name: "Öğrenci" },
  { min: 1500, name: "Kelime Avcısı" },
  { min: 4000, name: "Lügat Dostu" },
  { min: 10000, name: "Sözlük Ustası" },
  { min: 25000, name: "Kelime Efsanesi" },
];

export function titleForScore(bestScore: number): string {
  let t = TITLE_BANDS[0].name;
  for (const band of TITLE_BANDS) {
    if (bestScore >= band.min) t = band.name;
  }
  return t;
}
