# Kelime Zinciri - PRD

## Overview
Türkçe kelime zinciri oyunu. Web app ile birebir eşleştirilmiş mobil Expo app.

## Tech Stack
- Frontend: Expo Router (SDK 54), React Native, TypeScript, react-native-svg (15.12.1)
- Backend: FastAPI + MongoDB (motor)
- Kelime veritabanı: 48,715 Türkçe kelime (TDK)

## Visual Design (Web App ile Aynı)
- Arka plan: tam koyu yeşil gradient (#0B1F1A → #12372C) + SVG hills silueti
- Kelime tile'ları: beyaz, navy harf, 3D alt gölge
- Son harf yeşil (#34C759), kombo/vurgu yeşil
- OYNA (yeşil) · GÜNLÜK CHALLENGE (turuncu)
- Dairesel timer (SVG progress ring)

## Screens
- **login**: Ortada modal kart (yeşil avatar + "Hoş Geldin!" + input + dark/green Başla butonu).
- **home**: Tile başlık (eğim yok) + "Merhaba, X" + OYNA + GÜNLÜK CHALLENGE + alt: Skorlar/Başarımlar/Ayarlar pill'leri.
- **game**: Dairesel yeşil timer + yıldız+puan pill + beyaz tile kelime (son harf yeşil) + `Kelime yaz...` input + onay butonu + zincir geçmişi + ZİNCİR sayacı.
- **game-over**, **leaderboard** (haftalık/aylık), **achievements** (9 kart, 0/9), **stats** (büyük skor + En Uzun Zincir/Oyun Sayısı + Günlük Challenge orange bölüm), **ayarlar** (ses/titreşim + liderlik/istatistik/başarımlar linkleri + çıkış).

## Expo Go Fix
- `react-native-svg` ve `@react-native-async-storage/async-storage` expo SDK 54 ile uyumlu sürümlere indirildi.
- `apiPost/apiGet` artık 15 sn timeout'a sahip; hata detayı kullanıcıya gösteriliyor (sessiz fail yerine).

## API
`POST /api/auth/login` · `GET /api/users/{username}` · `POST /api/game/start` · `POST /api/game/validate` · `POST /api/game/submit` · `GET /api/leaderboard` · `GET /api/achievements`

## Status
Arayüz web app ile birebir eşleştirildi. 20/20 backend testi geçti. Expo Go uyumluluğu için paket sürümleri düzeltildi.
