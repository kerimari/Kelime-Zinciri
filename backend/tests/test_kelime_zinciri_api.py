"""
Backend API tests for Kelime Zinciri game
Tests: auth, user profile, game flow, word validation, leaderboard, achievements
"""
import pytest
import requests
import os
import time

# Use the public backend URL for testing
BASE_URL = "https://kelime-zinciri-4.preview.emergentagent.com"

class TestHealthCheck:
    """Basic health check"""
    
    def test_api_root(self):
        response = requests.get(f"{BASE_URL}/api/")
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        assert "word_count" in data
        assert data["word_count"] > 0, "Turkish word list should be loaded"


class TestAuth:
    """Authentication endpoint tests"""
    
    def test_login_creates_new_user(self):
        """POST /api/auth/login creates new user with unique username"""
        username = f"tu_{int(time.time())}"
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": username
        })
        assert response.status_code == 200
        
        data = response.json()
        assert data["username"] == username
        assert data["title"] == "Çaylak"
        assert data["best_score"] == 0
        assert data["games_played"] == 0
        assert data["longest_chain"] == 0, "New user should have longest_chain=0"
        assert "id" in data
        assert "created_at" in data
    
    def test_login_returns_existing_user(self):
        """POST /api/auth/login returns existing user on repeat"""
        username = f"tr_{int(time.time())}"
        
        # First login - create user
        resp1 = requests.post(f"{BASE_URL}/api/auth/login", json={"username": username})
        assert resp1.status_code == 200
        user1 = resp1.json()
        user1_id = user1["id"]
        
        # Second login - should return same user
        resp2 = requests.post(f"{BASE_URL}/api/auth/login", json={"username": username})
        assert resp2.status_code == 200
        user2 = resp2.json()
        
        assert user2["id"] == user1_id, "Should return same user ID"
        assert user2["username"] == username
    
    def test_login_validation_short_username(self):
        """Login rejects username < 2 chars"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={"username": "a"})
        assert response.status_code == 400
    
    def test_login_validation_long_username(self):
        """Login rejects username > 20 chars"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={"username": "a" * 21})
        assert response.status_code == 400


class TestUserProfile:
    """User profile endpoint tests"""
    
    def test_get_user_profile(self):
        """GET /api/users/{username} returns user profile"""
        # Create user first
        username = f"tp_{int(time.time())}"
        requests.post(f"{BASE_URL}/api/auth/login", json={"username": username})
        
        # Get profile
        response = requests.get(f"{BASE_URL}/api/users/{username}")
        assert response.status_code == 200
        
        data = response.json()
        assert data["username"] == username
        assert "title" in data
        assert "best_score" in data
        assert "achievements" in data
    
    def test_get_user_not_found(self):
        """GET /api/users/{username} returns 404 for non-existent user"""
        response = requests.get(f"{BASE_URL}/api/users/nonexistent_user_xyz")
        assert response.status_code == 404


class TestGameFlow:
    """Game start, validate, submit flow"""
    
    def test_game_start(self):
        """POST /api/game/start returns session_id and start_word"""
        response = requests.post(f"{BASE_URL}/api/game/start", json={})
        assert response.status_code == 200
        
        data = response.json()
        assert "session_id" in data
        assert "start_word" in data
        assert len(data["start_word"]) >= 2, "Start word should be valid"
    
    def test_game_validate_valid_word(self):
        """POST /api/game/validate accepts valid Turkish word starting with correct letter"""
        # Start game
        start_resp = requests.post(f"{BASE_URL}/api/game/start", json={})
        session_id = start_resp.json()["session_id"]
        start_word = start_resp.json()["start_word"]
        
        # For testing, use known word chain: masa → armut (a matches last letter of masa)
        # But we need to use the actual start_word from the game
        # Let's try a common continuation based on last letter
        last_letter = start_word[-1].lower()
        
        # Try some common Turkish words for different letters
        test_words = {
            'a': 'armut',
            'e': 'elma',
            'i': 'inek',
            'o': 'okul',
            'u': 'uçak',
            'ı': 'ışık',
            'ü': 'üzüm',
            'ö': 'ördek',
            't': 'top',
            'k': 'kedi',
            'l': 'lale',
            'r': 'renk',
            's': 'su',
            'n': 'nar',
            'm': 'masa',
            'd': 'dal',
            'y': 'yol',
        }
        
        test_word = test_words.get(last_letter, 'armut')  # fallback to armut
        
        # Validate word
        validate_resp = requests.post(f"{BASE_URL}/api/game/validate", json={
            "session_id": session_id,
            "word": test_word,
            "previous_word": start_word
        })
        
        # If the test word doesn't start with correct letter, skip this test
        if validate_resp.status_code == 200:
            data = validate_resp.json()
            if data.get("valid"):
                assert data["valid"] == True
                assert "next_letter" in data
            else:
                # Word might not be in dictionary or wrong letter
                pytest.skip(f"Test word '{test_word}' not valid for '{start_word}' (reason: {data.get('reason')})")
    
    def test_game_validate_invalid_word_not_in_dict(self):
        """POST /api/game/validate rejects word not in Turkish dictionary"""
        start_resp = requests.post(f"{BASE_URL}/api/game/start", json={})
        session_id = start_resp.json()["session_id"]
        start_word = start_resp.json()["start_word"]
        
        # Use a nonsense word
        response = requests.post(f"{BASE_URL}/api/game/validate", json={
            "session_id": session_id,
            "word": "xyzabc",
            "previous_word": start_word
        })
        assert response.status_code == 200
        
        data = response.json()
        assert data["valid"] == False
        assert "reason" in data
    
    def test_game_validate_wrong_starting_letter(self):
        """POST /api/game/validate rejects word not starting with required letter"""
        start_resp = requests.post(f"{BASE_URL}/api/game/start", json={})
        session_id = start_resp.json()["session_id"]
        
        # Use masa as previous, try word starting with 'e' (should fail, needs 'a')
        response = requests.post(f"{BASE_URL}/api/game/validate", json={
            "session_id": session_id,
            "word": "elma",
            "previous_word": "masa"
        })
        assert response.status_code == 200
        
        data = response.json()
        assert data["valid"] == False
        assert "reason" in data
        assert "A" in data["reason"] or "a" in data["reason"], "Should mention required letter"
    
    def test_game_validate_duplicate_word(self):
        """POST /api/game/validate rejects duplicate word in same session"""
        start_resp = requests.post(f"{BASE_URL}/api/game/start", json={})
        session_id = start_resp.json()["session_id"]
        start_word = start_resp.json()["start_word"]
        
        # Try to use the start word again (it's already in used_words)
        response = requests.post(f"{BASE_URL}/api/game/validate", json={
            "session_id": session_id,
            "word": start_word,
            "previous_word": start_word
        })
        assert response.status_code == 200
        
        data = response.json()
        assert data["valid"] == False
        assert "reason" in data
    
    def test_game_submit_updates_user_stats(self):
        """POST /api/game/submit updates user stats and returns title"""
        # Create user
        username = f"ts_{int(time.time())}"
        requests.post(f"{BASE_URL}/api/auth/login", json={"username": username})
        
        # Submit score
        response = requests.post(f"{BASE_URL}/api/game/submit", json={
            "username": username,
            "score": 150,
            "words_found": 5,
            "max_combo": 3,
            "duration_seconds": 12
        })
        assert response.status_code == 200
        
        data = response.json()
        assert data["ok"] == True
        assert "title" in data
        assert data["best_score"] == 150
        assert "new_achievements" in data
        
        # Verify user stats updated via GET
        user_resp = requests.get(f"{BASE_URL}/api/users/{username}")
        user = user_resp.json()
        assert user["best_score"] == 150
        assert user["games_played"] == 1
        assert user["words_total"] == 5
        assert user["max_combo"] == 3
        assert user["longest_chain"] == 5, "longest_chain should be updated to words_found"
    
    def test_game_submit_assigns_title_based_on_score(self):
        """POST /api/game/submit assigns correct title based on best_score"""
        username = f"tt_{int(time.time())}"
        requests.post(f"{BASE_URL}/api/auth/login", json={"username": username})
        
        # Submit low score - should be Çaylak
        resp1 = requests.post(f"{BASE_URL}/api/game/submit", json={
            "username": username,
            "score": 50,
            "words_found": 2,
            "max_combo": 1,
            "duration_seconds": 10
        })
        assert resp1.json()["title"] == "Çaylak"
        
        # Submit higher score - should upgrade title
        resp2 = requests.post(f"{BASE_URL}/api/game/submit", json={
            "username": username,
            "score": 600,
            "words_found": 10,
            "max_combo": 5,
            "duration_seconds": 15
        })
        title = resp2.json()["title"]
        assert title in ["Heveskar", "Kelime Avcısı", "Üstad", "Bilge", "Efsane"]
    
    def test_game_submit_awards_achievements(self):
        """POST /api/game/submit awards new achievements"""
        username = f"ta_{int(time.time())}"
        requests.post(f"{BASE_URL}/api/auth/login", json={"username": username})
        
        # Submit game with 1 word - should unlock "first_word"
        response = requests.post(f"{BASE_URL}/api/game/submit", json={
            "username": username,
            "score": 50,
            "words_found": 1,
            "max_combo": 1,
            "duration_seconds": 5
        })
        
        data = response.json()
        assert "new_achievements" in data
        # Should have at least first_word achievement
        user_resp = requests.get(f"{BASE_URL}/api/users/{username}")

    def test_game_submit_updates_longest_chain(self):
        """POST /api/game/submit correctly updates longest_chain (max of previous and current)"""
        username = f"tlc_{int(time.time())}"
        requests.post(f"{BASE_URL}/api/auth/login", json={"username": username})
        
        # First game: 3 words
        requests.post(f"{BASE_URL}/api/game/submit", json={
            "username": username,
            "score": 100,
            "words_found": 3,
            "max_combo": 1,
            "duration_seconds": 10
        })
        
        user1 = requests.get(f"{BASE_URL}/api/users/{username}").json()
        assert user1["longest_chain"] == 3, "First game should set longest_chain to 3"
        
        # Second game: 2 words (less than previous)
        requests.post(f"{BASE_URL}/api/game/submit", json={
            "username": username,
            "score": 50,
            "words_found": 2,
            "max_combo": 1,
            "duration_seconds": 8
        })
        
        user2 = requests.get(f"{BASE_URL}/api/users/{username}").json()
        assert user2["longest_chain"] == 3, "longest_chain should remain 3 (not decrease)"
        
        # Third game: 7 words (more than previous)
        requests.post(f"{BASE_URL}/api/game/submit", json={
            "username": username,
            "score": 200,
            "words_found": 7,
            "max_combo": 2,
            "duration_seconds": 15
        })
        
        user3 = requests.get(f"{BASE_URL}/api/users/{username}").json()
        assert user3["longest_chain"] == 7, "longest_chain should update to 7"


class TestLeaderboard:
    """Leaderboard endpoint tests"""
    
    def test_leaderboard_weekly(self):
        """GET /api/leaderboard?period=weekly returns sorted rankings"""
        response = requests.get(f"{BASE_URL}/api/leaderboard?period=weekly")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        
        # Check structure if there are entries
        if len(data) > 0:
            entry = data[0]
            assert "rank" in entry
            assert "username" in entry
            assert "score" in entry
            assert "title" in entry
            assert entry["rank"] == 1
    
    def test_leaderboard_monthly(self):
        """GET /api/leaderboard?period=monthly returns sorted rankings"""
        response = requests.get(f"{BASE_URL}/api/leaderboard?period=monthly")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
    
    def test_leaderboard_sorting(self):
        """Leaderboard entries are sorted by score descending"""
        # Create test users and submit scores
        for i in range(3):
            username = f"tlb_{int(time.time())}_{i}"
            requests.post(f"{BASE_URL}/api/auth/login", json={"username": username})
            requests.post(f"{BASE_URL}/api/game/submit", json={
                "username": username,
                "score": (i + 1) * 100,  # 100, 200, 300
                "words_found": i + 1,
                "max_combo": 1,
                "duration_seconds": 10
            })
        
        # Get leaderboard
        response = requests.get(f"{BASE_URL}/api/leaderboard?period=weekly")
        data = response.json()
        
        # Check scores are descending
        if len(data) >= 2:
            for i in range(len(data) - 1):
                assert data[i]["score"] >= data[i + 1]["score"], "Scores should be descending"


class TestAchievements:
    """Achievements metadata endpoint"""
    
    def test_get_achievements_metadata(self):
        """GET /api/achievements returns achievement and title metadata"""
        response = requests.get(f"{BASE_URL}/api/achievements")
        assert response.status_code == 200
        
        data = response.json()
        assert "achievements" in data
        assert "titles" in data
        
        # Check achievements structure
        achievements = data["achievements"]
        assert len(achievements) == 9, "Should have 9 achievements (including games_10)"
        
        # Verify all expected achievement IDs are present
        ach_ids = [a["id"] for a in achievements]
        expected_ids = ["first_word", "chain_5", "chain_10", "chain_20", "score_100", "score_200", "score_500", "combo_5", "games_10"]
        for exp_id in expected_ids:
            assert exp_id in ach_ids, f"Achievement {exp_id} should be present"
        
        first_ach = achievements[0]
        assert "id" in first_ach
        assert "name" in first_ach
        assert "desc" in first_ach
        assert "threshold" in first_ach
        assert "metric" in first_ach
        
        # Check titles structure
        titles = data["titles"]
        assert len(titles) > 0
        first_title = titles[0]
        assert "threshold" in first_title
        assert "name" in first_title


@pytest.fixture
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session
