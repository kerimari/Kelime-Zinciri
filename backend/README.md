# Kelime Zinciri - Backend Reference

This directory contains the legacy backend infrastructure, word databases, and automated testing suites for **Kelime Zinciri**.

## Current Status
Following the recent architecture update, the production mobile app now runs entirely client side (standalone). This backend server is currently detached from live frontend operations. 

## Key Contents
- **`turkish_words_full.txt` / `turkish_words.txt`:** Core vocabulary assets used for validation rules.
- **Testing (`tests/`):** Automated script pipelines used during development to verify game logic and dictionary integrity.

*For production deployment configs and active mobile client source code, please refer to the `frontend/` directory.*