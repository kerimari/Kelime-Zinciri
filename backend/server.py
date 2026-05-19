from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import random
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Literal
import uuid
from datetime import datetime, timezone, timedelta

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# --- Load Turkish word set ---
WORDS_FILE = ROOT_DIR / 'turkish_words.txt'
WORD_SET: set[str] = set()
WORD_BY_LETTER: dict[str, list[str]] = {}

def _normalize_tr(s: str) -> str:
    # Lowercase Turkish-aware: I -> ı, İ -> i
    s = s.replace('I', 'ı').replace('İ', 'i')
    return s.lower().strip()

MAX_WORD_LEN = 7   # daha sıkı - nadir/arkaik uzun kelimeleri ele (günlük kullanımdakiler)
MIN_WORD_LEN = 3   # 2 harflilerden (ab, ay, vs) kaçın

def _load_words():
    global WORD_SET, WORD_BY_LETTER
    with open(WORDS_FILE, 'r', encoding='utf-8') as f:
        for line in f:
            w = _normalize_tr(line)
            if not w:
                continue
            # Aşırı uzun / çok kısa kelimeleri hariç tut
            if len(w) > MAX_WORD_LEN or len(w) < MIN_WORD_LEN:
                continue
            WORD_SET.add(w)
            first = w[0]
            WORD_BY_LETTER.setdefault(first, []).append(w)

_load_words()

# --- Title logic ---
TITLES = [
    (0, "Çaylak"),
    (100, "Heveskar"),
    (500, "Kelime Avcısı"),
    (1500, "Üstad"),
    (3500, "Bilge"),
    (7000, "Efsane"),
]

def get_title(score: int) -> str:
    current = TITLES[0][1]
    for thr, name in TITLES:
        if score >= thr:
            current = name
    return current

ACHIEVEMENTS = [
    # Başlangıç
    {"id": "first_word", "name": "İlk Adım", "desc": "İlk oyununu tamamla", "threshold": 1, "metric": "games_played"},
    # Zincir başarıları
    {"id": "chain_5", "name": "Zincir Ustası", "desc": "Tek oyunda 5 kelimelik zincir kur", "threshold": 5, "metric": "longest_chain"},
    {"id": "chain_7", "name": "Yedi Güzel", "desc": "Tek oyunda 7 kelimelik zincir kur", "threshold": 7, "metric": "longest_chain"},
    {"id": "chain_10", "name": "Kelime Canavarı", "desc": "Tek oyunda 10 kelimelik zincir kur", "threshold": 10, "metric": "longest_chain"},
    {"id": "chain_15", "name": "Zincir Şampiyonu", "desc": "Tek oyunda 15 kelimelik zincir kur", "threshold": 15, "metric": "longest_chain"},
    {"id": "chain_20", "name": "Efsane Zincir", "desc": "Tek oyunda 20 kelimelik zincir kur", "threshold": 20, "metric": "longest_chain"},
    {"id": "chain_25", "name": "Çeyrek Asır", "desc": "Tek oyunda 25 kelimelik zincir kur", "threshold": 25, "metric": "longest_chain"},
    {"id": "chain_30", "name": "Ölümsüz Zincir", "desc": "Tek oyunda 30 kelimelik zincir kur", "threshold": 30, "metric": "longest_chain"},
    {"id": "chain_40", "name": "Zirve Avcısı", "desc": "Tek oyunda 40 kelimelik zincir kur", "threshold": 40, "metric": "longest_chain"},
    {"id": "chain_50", "name": "Tanrısal Zincir", "desc": "Tek oyunda 50 kelimelik zincir kur", "threshold": 50, "metric": "longest_chain"},
    # Puan başarıları (tek oyun)
    {"id": "score_100", "name": "Yüzlük Kulüp", "desc": "Tek oyunda 100+ puan topla", "threshold": 100, "metric": "best_score"},
    {"id": "score_200", "name": "İki Yüzlük", "desc": "Tek oyunda 200+ puan topla", "threshold": 200, "metric": "best_score"},
    {"id": "score_300", "name": "Üç Yüzlük", "desc": "Tek oyunda 300+ puan topla", "threshold": 300, "metric": "best_score"},
    {"id": "score_500", "name": "Beş Yüzlük", "desc": "Tek oyunda 500+ puan topla", "threshold": 500, "metric": "best_score"},
    {"id": "score_750", "name": "Yedi Yüz Elli", "desc": "Tek oyunda 750+ puan topla", "threshold": 750, "metric": "best_score"},
    {"id": "score_1000", "name": "Binlik Zirve", "desc": "Tek oyunda 1000+ puan topla", "threshold": 1000, "metric": "best_score"},
    {"id": "score_2000", "name": "Muhteşem", "desc": "Tek oyunda 2000+ puan topla", "threshold": 2000, "metric": "best_score"},
    {"id": "score_3000", "name": "Görkemli", "desc": "Tek oyunda 3000+ puan topla", "threshold": 3000, "metric": "best_score"},
    {"id": "score_5000", "name": "Efsane Skor", "desc": "Tek oyunda 5000+ puan topla", "threshold": 5000, "metric": "best_score"},
    {"id": "score_10000", "name": "On Bin Kralı", "desc": "Tek oyunda 10000+ puan topla", "threshold": 10000, "metric": "best_score"},
    # Kombo
    {"id": "combo_3", "name": "Hızlı Başlangıç", "desc": "3x kombo yap", "threshold": 3, "metric": "max_combo"},
    {"id": "combo_5", "name": "Kombo Ustası", "desc": "5x kombo yap", "threshold": 5, "metric": "max_combo"},
    {"id": "combo_6", "name": "Altıgen", "desc": "6x kombo yap", "threshold": 6, "metric": "max_combo"},
    {"id": "combo_8", "name": "Yıldırım", "desc": "8x kombo yap", "threshold": 8, "metric": "max_combo"},
    {"id": "combo_10", "name": "Işık Hızı", "desc": "10x kombo yap", "threshold": 10, "metric": "max_combo"},
    {"id": "combo_12", "name": "Şimşek Hızında", "desc": "12x kombo yap", "threshold": 12, "metric": "max_combo"},
    {"id": "combo_15", "name": "Süpernova", "desc": "15x kombo yap", "threshold": 15, "metric": "max_combo"},
    {"id": "combo_20", "name": "Kara Delik", "desc": "20x kombo yap", "threshold": 20, "metric": "max_combo"},
    # Sadakat (toplam oyun)
    {"id": "games_5", "name": "Merhaba", "desc": "5 oyun oyna", "threshold": 5, "metric": "games_played"},
    {"id": "games_10", "name": "Sadık Oyuncu", "desc": "10 oyun oyna", "threshold": 10, "metric": "games_played"},
    {"id": "games_25", "name": "Düzenli", "desc": "25 oyun oyna", "threshold": 25, "metric": "games_played"},
    {"id": "games_50", "name": "Veteran", "desc": "50 oyun oyna", "threshold": 50, "metric": "games_played"},
    {"id": "games_100", "name": "Bağımlı", "desc": "100 oyun oyna", "threshold": 100, "metric": "games_played"},
    {"id": "games_250", "name": "Azimli", "desc": "250 oyun oyna", "threshold": 250, "metric": "games_played"},
    {"id": "games_500", "name": "Efsanevi Oyuncu", "desc": "500 oyun oyna", "threshold": 500, "metric": "games_played"},
    # Toplam kelime
    {"id": "words_50", "name": "Sözcük Filizi", "desc": "Toplam 50 kelime bul", "threshold": 50, "metric": "words_total"},
    {"id": "words_100", "name": "Kelime Toplayıcı", "desc": "Toplam 100 kelime bul", "threshold": 100, "metric": "words_total"},
    {"id": "words_250", "name": "Lügat Dostu", "desc": "Toplam 250 kelime bul", "threshold": 250, "metric": "words_total"},
    {"id": "words_500", "name": "Kelime Hazinesi", "desc": "Toplam 500 kelime bul", "threshold": 500, "metric": "words_total"},
    {"id": "words_1000", "name": "Sözlük Efendisi", "desc": "Toplam 1000 kelime bul", "threshold": 1000, "metric": "words_total"},
    {"id": "words_2500", "name": "Dil Virtüözü", "desc": "Toplam 2500 kelime bul", "threshold": 2500, "metric": "words_total"},
    {"id": "words_5000", "name": "Kelime Titanı", "desc": "Toplam 5000 kelime bul", "threshold": 5000, "metric": "words_total"},
    # Toplam puan
    {"id": "total_1000", "name": "İlk Bin", "desc": "Toplam 1000 puana ulaş", "threshold": 1000, "metric": "total_score"},
    {"id": "total_5000", "name": "Beş Bin Milyoner", "desc": "Toplam 5000 puana ulaş", "threshold": 5000, "metric": "total_score"},
    {"id": "total_20000", "name": "Yirmi Bin", "desc": "Toplam 20000 puana ulaş", "threshold": 20000, "metric": "total_score"},
    {"id": "total_50000", "name": "Elli Bin Kralı", "desc": "Toplam 50000 puana ulaş", "threshold": 50000, "metric": "total_score"},
    {"id": "total_100000", "name": "Yüz Bin İmparatoru", "desc": "Toplam 100000 puana ulaş", "threshold": 100000, "metric": "total_score"},
    {"id": "total_500000", "name": "Yarım Milyon", "desc": "Toplam 500000 puana ulaş", "threshold": 500000, "metric": "total_score"},
]

# --- Models ---
class LoginRequest(BaseModel):
    username: str

class UserOut(BaseModel):
    id: str
    username: str
    title: str
    best_score: int = 0
    total_score: int = 0
    games_played: int = 0
    words_total: int = 0
    max_combo: int = 0
    longest_chain: int = 0
    achievements: List[str] = []
    created_at: str

class StartGameResponse(BaseModel):
    session_id: str
    start_word: str

class ValidateRequest(BaseModel):
    session_id: str
    word: str
    previous_word: str

class ValidateResponse(BaseModel):
    valid: bool
    reason: Optional[str] = None
    next_letter: Optional[str] = None

class SubmitScoreRequest(BaseModel):
    username: str
    score: int
    words_found: int
    max_combo: int
    duration_seconds: int

class SubmitScoreResponse(BaseModel):
    ok: bool
    title: str
    best_score: int
    new_achievements: List[str]

class LeaderboardEntry(BaseModel):
    rank: int
    username: str
    score: int
    title: str

class StatusCheck(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_name: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class StatusCheckCreate(BaseModel):
    client_name: str


app = FastAPI()
api_router = APIRouter(prefix="/api")


def _last_letter_tr(word: str) -> str:
    w = _normalize_tr(word)
    # Skip letters that have no words starting with them (none in our list, but safe)
    return w[-1]

def _pick_start_word() -> str:
    # Prefer a word that ends in a commonly-startable letter
    tries = 0
    while tries < 50:
        w = random.choice(list(WORD_SET))
        if 3 <= len(w) <= 7 and WORD_BY_LETTER.get(_last_letter_tr(w)):
            return w
        tries += 1
    return random.choice(list(WORD_SET))


@api_router.get("/")
async def root():
    return {"message": "Kelime Zinciri API", "word_count": len(WORD_SET)}


@api_router.post("/auth/login", response_model=UserOut)
async def login(req: LoginRequest):
    uname = req.username.strip()
    if len(uname) < 2 or len(uname) > 20:
        raise HTTPException(400, "Kullanıcı adı 2-20 karakter olmalı")
    if not all(c.isalnum() or c in "_-" for c in uname):
        raise HTTPException(400, "Geçersiz karakter. Sadece harf, rakam, _ ve -")

    existing = await db.users.find_one({"username_lower": uname.lower()}, {"_id": 0})
    if existing:
        return UserOut(**existing)

    now_iso = datetime.now(timezone.utc).isoformat()
    user = {
        "id": str(uuid.uuid4()),
        "username": uname,
        "username_lower": uname.lower(),
        "title": get_title(0),
        "best_score": 0,
        "total_score": 0,
        "games_played": 0,
        "words_total": 0,
        "max_combo": 0,
        "longest_chain": 0,
        "achievements": [],
        "created_at": now_iso,
    }
    await db.users.insert_one(user)
    user.pop("username_lower", None)
    return UserOut(**user)


@api_router.get("/users/{username}", response_model=UserOut)
async def get_user(username: str):
    user = await db.users.find_one({"username_lower": username.lower()}, {"_id": 0, "username_lower": 0})
    if not user:
        raise HTTPException(404, "Kullanıcı bulunamadı")
    return UserOut(**user)


@api_router.post("/game/start", response_model=StartGameResponse)
async def start_game():
    sid = str(uuid.uuid4())
    start_word = _pick_start_word()
    await db.sessions.insert_one({
        "session_id": sid,
        "used_words": [start_word],
        "start_word": start_word,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return StartGameResponse(session_id=sid, start_word=start_word)


@api_router.post("/game/validate", response_model=ValidateResponse)
async def validate_word(req: ValidateRequest):
    word = _normalize_tr(req.word)
    prev = _normalize_tr(req.previous_word)

    if len(word) < 2:
        return ValidateResponse(valid=False, reason="Kelime çok kısa")

    if word not in WORD_SET:
        return ValidateResponse(valid=False, reason="Sözlükte yok")

    expected_first = _last_letter_tr(prev)
    if word[0] != expected_first:
        return ValidateResponse(valid=False, reason=f"'{expected_first.upper()}' ile başlamalı")

    sess = await db.sessions.find_one({"session_id": req.session_id}, {"_id": 0})
    if not sess:
        return ValidateResponse(valid=False, reason="Oturum yok")

    if word in sess.get("used_words", []):
        return ValidateResponse(valid=False, reason="Daha önce kullanıldı")

    await db.sessions.update_one(
        {"session_id": req.session_id},
        {"$push": {"used_words": word}},
    )
    return ValidateResponse(valid=True, next_letter=_last_letter_tr(word))


def _check_achievements(user: dict) -> List[str]:
    unlocked = set(user.get("achievements", []))
    new_ones = []
    for ach in ACHIEVEMENTS:
        if ach["id"] in unlocked:
            continue
        val = user.get(ach["metric"], 0) or 0
        if val >= ach["threshold"]:
            new_ones.append(ach["id"])
    return new_ones


@api_router.post("/game/submit", response_model=SubmitScoreResponse)
async def submit_score(req: SubmitScoreRequest):
    user = await db.users.find_one({"username_lower": req.username.lower()}, {"_id": 0})
    if not user:
        raise HTTPException(404, "Kullanıcı bulunamadı")

    new_best = max(user.get("best_score", 0), req.score)
    new_total = user.get("total_score", 0) + req.score
    new_words = user.get("words_total", 0) + req.words_found
    new_max_combo = max(user.get("max_combo", 0), req.max_combo)
    new_longest_chain = max(user.get("longest_chain", 0), req.words_found)
    new_games = user.get("games_played", 0) + 1
    new_title = get_title(new_best)

    user["best_score"] = new_best
    user["total_score"] = new_total
    user["words_total"] = new_words
    user["max_combo"] = new_max_combo
    user["longest_chain"] = new_longest_chain
    user["games_played"] = new_games
    user["title"] = new_title

    new_ach_ids = _check_achievements(user)
    achievements = list(set(user.get("achievements", [])) | set(new_ach_ids))

    await db.users.update_one(
        {"username_lower": req.username.lower()},
        {"$set": {
            "best_score": new_best,
            "total_score": new_total,
            "words_total": new_words,
            "max_combo": new_max_combo,
            "longest_chain": new_longest_chain,
            "games_played": new_games,
            "title": new_title,
            "achievements": achievements,
        }},
    )

    # Save game record with timestamp for leaderboard windows
    await db.games.insert_one({
        "id": str(uuid.uuid4()),
        "username": user["username"],
        "username_lower": user["username_lower"],
        "score": req.score,
        "words_found": req.words_found,
        "max_combo": req.max_combo,
        "duration_seconds": req.duration_seconds,
        "title": new_title,
        "played_at": datetime.now(timezone.utc),
    })

    return SubmitScoreResponse(
        ok=True,
        title=new_title,
        best_score=new_best,
        new_achievements=new_ach_ids,
    )


@api_router.get("/leaderboard", response_model=List[LeaderboardEntry])
async def leaderboard(period: Literal["weekly", "monthly", "alltime"] = "weekly", limit: int = 50):
    now = datetime.now(timezone.utc)
    match = {}
    if period == "weekly":
        match = {"played_at": {"$gte": now - timedelta(days=7)}}
    elif period == "monthly":
        match = {"played_at": {"$gte": now - timedelta(days=30)}}

    pipeline = [
        {"$match": match},
        {"$sort": {"score": -1}},
        {"$group": {
            "_id": "$username_lower",
            "username": {"$first": "$username"},
            "score": {"$max": "$score"},
            "title": {"$first": "$title"},
        }},
        {"$sort": {"score": -1}},
        {"$limit": limit},
    ]
    rows = await db.games.aggregate(pipeline).to_list(limit)
    out = []
    for i, r in enumerate(rows):
        out.append(LeaderboardEntry(
            rank=i + 1,
            username=r.get("username", ""),
            score=int(r.get("score", 0)),
            title=r.get("title", "Çaylak"),
        ))
    return out


@api_router.get("/achievements")
async def list_achievements():
    return {"achievements": ACHIEVEMENTS, "titles": [{"threshold": t, "name": n} for t, n in TITLES]}


# legacy status
@api_router.post("/status", response_model=StatusCheck)
async def create_status_check(input: StatusCheckCreate):
    status_dict = input.dict()
    status_obj = StatusCheck(**status_dict)
    doc = status_obj.dict()
    await db.status_checks.insert_one(doc)
    return status_obj


@api_router.get("/status", response_model=List[StatusCheck])
async def get_status_checks():
    rows = await db.status_checks.find({}, {"_id": 0}).to_list(1000)
    return [StatusCheck(**r) for r in rows]


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
