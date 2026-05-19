#!/usr/bin/env python3
"""
PRODUCTION SMOKE TEST — Kelime Zinciri backend
Tests only the 4 endpoints used by the production client:
  GET  /api/
  GET  /api/achievements
  POST /api/game/start
  POST /api/game/validate
Plus CORS preflight and latency.
"""
import os
import re
import time
import json
import uuid
import statistics
import requests
from pathlib import Path

ENV_PATH = Path("/app/frontend/.env")
BACKEND_URL = None
for line in ENV_PATH.read_text().splitlines():
    if line.startswith("EXPO_PUBLIC_BACKEND_URL="):
        BACKEND_URL = line.split("=", 1)[1].strip().strip('"').strip("'")
        break
assert BACKEND_URL, "EXPO_PUBLIC_BACKEND_URL not found"
BASE = f"{BACKEND_URL}/api"

print(f"Backend base URL: {BASE}")
print("=" * 70)

results = {"pass": 0, "fail": 0, "anomalies": []}

def record(name, ok, detail=""):
    status = "PASS" if ok else "FAIL"
    print(f"[{status}] {name}" + (f" — {detail}" if detail else ""))
    if ok:
        results["pass"] += 1
    else:
        results["fail"] += 1
        results["anomalies"].append(f"{name}: {detail}")

all_status_codes = []

def request_with_tracking(method, url, **kw):
    r = requests.request(method, url, timeout=15, **kw)
    all_status_codes.append((method, url, r.status_code))
    return r

# ---------- (A) ----------
print("\n--- (A) GET /api/ health ---")
r = request_with_tracking("GET", f"{BASE}/")
record("GET /api/ returns 200", r.status_code == 200, f"status={r.status_code}")
try:
    body = r.json()
    wc = body.get("word_count")
    record("word_count == 6197", wc == 6197, f"got {wc}")
except Exception as e:
    record("GET /api/ JSON parse", False, str(e))

# ---------- (B) ----------
print("\n--- (B) GET /api/achievements ---")
r = request_with_tracking("GET", f"{BASE}/achievements")
record("GET /api/achievements 200", r.status_code == 200, f"status={r.status_code}")
ach_body = r.json()
ach_list = ach_body.get("achievements") if isinstance(ach_body, dict) else ach_body
record("achievements length == 48",
       isinstance(ach_list, list) and len(ach_list) == 48,
       f"got {len(ach_list) if isinstance(ach_list, list) else type(ach_list).__name__}")

required_ids = ["first_word", "chain_5", "score_100", "combo_3", "total_500000"]
by_id = {a["id"]: a for a in ach_list} if isinstance(ach_list, list) else {}
for rid in required_ids:
    a = by_id.get(rid)
    if not a:
        record(f"achievement {rid} present", False, "missing")
        continue
    has_all = (
        "id" in a and "name" in a and "desc" in a
        and isinstance(a.get("threshold"), int)
        and isinstance(a.get("metric"), str)
    )
    record(f"achievement {rid} schema",
           has_all,
           f"id={a.get('id')} name={a.get('name')} thr={a.get('threshold')} metric={a.get('metric')}")

# ---------- (C) ----------
print("\n--- (C) POST /api/game/start body tolerance ---")
TR_WORD_RE = re.compile(r"^[a-zçğıöşü]+$")

def validate_start_response(label, r):
    if r.status_code != 200:
        record(f"start({label}) 200", False, f"status={r.status_code} body={r.text[:200]}")
        return None
    record(f"start({label}) 200", True)
    try:
        b = r.json()
    except Exception as e:
        record(f"start({label}) JSON", False, str(e))
        return None
    sid = b.get("session_id")
    sw = b.get("start_word")
    record(f"start({label}) non-empty session_id", bool(sid) and isinstance(sid, str), f"sid={sid}")
    record(f"start({label}) sw len 3-7",
           isinstance(sw, str) and 3 <= len(sw) <= 7,
           f"sw='{sw}'")
    record(f"start({label}) lc Turkish",
           isinstance(sw, str) and bool(TR_WORD_RE.match(sw)), f"sw='{sw}'")
    record(f"start({label}) no 'ğ' end",
           isinstance(sw, str) and not sw.endswith("ğ"), f"sw='{sw}'")
    return b

r = request_with_tracking("POST", f"{BASE}/game/start", json={})
validate_start_response("empty-json", r)
r = request_with_tracking("POST", f"{BASE}/game/start")
validate_start_response("no-body", r)
r = request_with_tracking("POST", f"{BASE}/game/start", json={"mode": "daily", "foo": "bar"})
validate_start_response("extra-keys", r)

# ---------- (D) ----------
print("\n--- (D) 20 game/start samples ---")
samples = []
for i in range(20):
    r = request_with_tracking("POST", f"{BASE}/game/start", json={})
    if r.status_code != 200:
        record(f"start sample #{i+1}", False, f"status={r.status_code}")
        continue
    samples.append(r.json().get("start_word"))
distinct = sorted(set(samples))
record("20 starts collected", len(samples) == 20, f"got {len(samples)}")
print(f"Distinct start_words ({len(distinct)}): {distinct}")
all_valid = all(isinstance(w, str) and 3 <= len(w) <= 7 and TR_WORD_RE.match(w) and not w.endswith("ğ") for w in samples)
record("All 20 start_words 3-7 lc TR no ğ end", all_valid)
archaic_blacklist = {"mevhibe","fersude","piştov","teshil","bedhah","avisto",
                     "kavait","anartri","eldivan","tariz","sahife","bedii",
                     "lağıv","körebe"}
overlap = set(samples) & archaic_blacklist
record("No archaic words in 20 samples", not overlap, f"intersection={overlap}")

# ---------- (E) ----------
print("\n--- (E) /api/game/validate scenarios ---")
r = request_with_tracking("POST", f"{BASE}/game/start", json={})
sess = r.json()
sid = sess["session_id"]
start_word = sess["start_word"]
print(f"Session sid={sid[:8]}... start_word='{start_word}' last_letter='{start_word[-1]}'")

WORDS_FILE = Path("/app/backend/turkish_words.txt")
def _normalize_tr(s):
    s = s.replace('I','ı').replace('İ','i')
    return s.lower().strip()
WORDS = set()
for w in WORDS_FILE.read_text(encoding="utf-8").splitlines():
    w = _normalize_tr(w)
    if 3 <= len(w) <= 7:
        WORDS.add(w)

last = start_word[-1]
candidates = [w for w in WORDS if w.startswith(last) and w != start_word]
assert candidates, f"no continuation for letter '{last}'"
chain_word = sorted(candidates, key=lambda w: (len(w), w))[0]
print(f"Chain word selected: '{chain_word}'")

# E1 valid chain
r = request_with_tracking("POST", f"{BASE}/game/validate",
                         json={"session_id": sid, "word": chain_word, "previous_word": start_word})
record("E1 valid chain 200", r.status_code == 200, f"status={r.status_code}")
b = r.json()
record("E1 valid=true", b.get("valid") is True, f"body={b}")
record("E1 has next_letter", isinstance(b.get("next_letter"), str), f"nl={b.get('next_letter')}")

# E2 wrong starting letter
chain_last = chain_word[-1]
bad_letter_word = next((w for w in WORDS if not w.startswith(chain_last)
                        and w not in (start_word, chain_word)), None)
r = request_with_tracking("POST", f"{BASE}/game/validate",
                         json={"session_id": sid, "word": bad_letter_word, "previous_word": chain_word})
record("E2 wrong-letter 200", r.status_code == 200)
b = r.json()
record("E2 valid=false", b.get("valid") is False, f"body={b}")
record("E2 reason letter-mismatch",
       isinstance(b.get("reason"), str) and "başlamalı" in b.get("reason", ""),
       f"reason={b.get('reason')}")

# E3 word not in dictionary
fake_word = "xqzzqx"
r = request_with_tracking("POST", f"{BASE}/game/validate",
                         json={"session_id": sid, "word": fake_word, "previous_word": chain_word})
record("E3 not-in-dict 200", r.status_code == 200)
b = r.json()
record("E3 valid=false 'Sözlükte yok'",
       b.get("valid") is False and b.get("reason") == "Sözlükte yok", f"body={b}")

# E4 duplicate
r = request_with_tracking("POST", f"{BASE}/game/validate",
                         json={"session_id": sid, "word": chain_word, "previous_word": start_word})
record("E4 duplicate 200", r.status_code == 200)
b = r.json()
record("E4 duplicate valid=false", b.get("valid") is False, f"body={b}")
record("E4 reason mentions duplicate",
       isinstance(b.get("reason"), str) and ("Daha önce" in b["reason"] or "kullanıldı" in b["reason"]),
       f"reason={b.get('reason')}")

# E5 bad sid
random_sid = str(uuid.uuid4())
some_word = next((w for w in WORDS if w.startswith(start_word[-1]) and w != start_word and w != chain_word), None)
r = request_with_tracking("POST", f"{BASE}/game/validate",
                         json={"session_id": random_sid, "word": some_word, "previous_word": start_word})
record("E5 bad-sid no 500", r.status_code < 500, f"status={r.status_code}")
if r.status_code == 200:
    b = r.json()
    record("E5 valid=false with reason",
           b.get("valid") is False and bool(b.get("reason")),
           f"body={b}")
elif r.status_code == 400:
    record("E5 clear 400", True)
else:
    record("E5 unexpected status", False, f"status={r.status_code}")

# E6 empty word
r = request_with_tracking("POST", f"{BASE}/game/validate",
                         json={"session_id": sid, "word": "", "previous_word": chain_word})
record("E6 empty-word no 500", r.status_code < 500, f"status={r.status_code}")
if r.status_code == 200:
    b = r.json()
    record("E6 empty-word valid=false", b.get("valid") is False, f"body={b}")

# ---------- (F) CORS preflight ----------
print("\n--- (F) CORS preflight OPTIONS /api/game/start ---")
r = request_with_tracking(
    "OPTIONS",
    f"{BASE}/game/start",
    headers={
        "Origin": "https://example-client.com",
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "content-type",
    },
)
record("OPTIONS preflight 200/204", r.status_code in (200, 204), f"status={r.status_code}")
acao = r.headers.get("Access-Control-Allow-Origin", "")
acam = r.headers.get("Access-Control-Allow-Methods", "")
record("ACAO contains '*' or origin",
       acao == "*" or "example-client.com" in acao, f"ACAO='{acao}'")
record("ACAM includes POST",
       "POST" in acam.upper() or acam == "*", f"ACAM='{acam}'")

# ---------- (G) Latency ----------
print("\n--- (G) Latency benchmark ---")
def measure(method, url, **kw):
    samples_ms = []
    for _ in range(10):
        t0 = time.perf_counter()
        r = requests.request(method, url, timeout=15, **kw)
        dt = (time.perf_counter() - t0) * 1000.0
        all_status_codes.append((method, url, r.status_code))
        samples_ms.append(None if r.status_code >= 500 else dt)
    return samples_ms

start_samples = measure("POST", f"{BASE}/game/start", json={})

r = requests.post(f"{BASE}/game/start", json={})
lat_sid = r.json()["session_id"]
lat_start = r.json()["start_word"]

def pick_chain(prev_word, used):
    last = prev_word[-1]
    for w in WORDS:
        if w.startswith(last) and w not in used:
            return w
    return None

validate_samples_ms = []
used = {lat_start}
prev = lat_start
for _ in range(10):
    cw = pick_chain(prev, used)
    if not cw:
        validate_samples_ms.append(None)
        continue
    t0 = time.perf_counter()
    r = requests.post(f"{BASE}/game/validate",
                      json={"session_id": lat_sid, "word": cw, "previous_word": prev},
                      timeout=15)
    dt = (time.perf_counter() - t0) * 1000.0
    all_status_codes.append(("POST", f"{BASE}/game/validate", r.status_code))
    if r.status_code >= 500:
        validate_samples_ms.append(None)
    else:
        validate_samples_ms.append(dt)
        if r.json().get("valid"):
            used.add(cw)
            prev = cw

def stats(samples):
    clean = [s for s in samples if s is not None]
    if not clean:
        return None, None
    med = statistics.median(clean)
    s = sorted(clean)
    idx = max(0, int(round(0.95 * (len(s) - 1))))
    p95 = s[idx]
    return med, p95

m1, p1 = stats(start_samples)
m2, p2 = stats(validate_samples_ms)
print(f"\n/api/game/start   samples_ms: {[round(x,1) if x else None for x in start_samples]}")
print(f"  median={round(m1,1) if m1 else 'n/a'}ms  p95={round(p1,1) if p1 else 'n/a'}ms")
print(f"/api/game/validate samples_ms: {[round(x,1) if x else None for x in validate_samples_ms]}")
print(f"  median={round(m2,1) if m2 else 'n/a'}ms  p95={round(p2,1) if p2 else 'n/a'}ms")
record("/api/game/start median < 800ms", m1 is not None and m1 < 800, f"median={round(m1,1) if m1 else 'n/a'}ms")
record("/api/game/validate median < 800ms", m2 is not None and m2 < 800, f"median={round(m2,1) if m2 else 'n/a'}ms")

# ---------- (H) 500-class scan ----------
print("\n--- (H) 500-class scan ---")
fivex = [(m, u, s) for (m, u, s) in all_status_codes if s >= 500]
record("Zero 500-class responses across all calls", len(fivex) == 0,
       f"got {len(fivex)} 500s: {fivex[:5]}")

# ---------- Final summary ----------
print("\n" + "=" * 70)
print(f"TOTAL: {results['pass']} PASS, {results['fail']} FAIL")
print(f"Total HTTP calls tracked: {len(all_status_codes)}")
print("Latency table:")
print(f"  /api/game/start    median={round(m1,1) if m1 else 'n/a'}ms p95={round(p1,1) if p1 else 'n/a'}ms")
print(f"  /api/game/validate median={round(m2,1) if m2 else 'n/a'}ms p95={round(p2,1) if p2 else 'n/a'}ms")
print(f"Distinct start_words (D): {distinct}")
if results["anomalies"]:
    print("\nAnomalies:")
    for a in results["anomalies"]:
        print(f"  - {a}")
print("=" * 70)
verdict = "PRODUCTION READY" if results["fail"] == 0 else f"NOT READY ({results['fail']} failures)"
print(f"VERDICT: {verdict}")
