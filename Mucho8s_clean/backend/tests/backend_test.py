"""Backend tests for MuchoMoney8s (FastAPI + MongoDB)."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://elo-matchup.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"
ADMIN_PASSWORD = "SYSMAFKKNGOD2001"
ADMIN_NICKNAME = "Admin"
HDR = {"X-Admin-Password": ADMIN_PASSWORD}


@pytest.fixture(scope="module")
def state():
    r = requests.get(f"{API}/state", timeout=30)
    assert r.status_code == 200
    return r.json()


# --------- GET /api/state ---------
class TestState:
    def test_state_shape(self, state):
        assert "players" in state and "matches" in state and "version" in state
        assert isinstance(state["version"], int)
        assert len(state["players"]) >= 20
        assert isinstance(state["matches"], list)

    def test_no_mongo_id(self, state):
        for p in state["players"]:
            assert "_id" not in p
        for m in state["matches"]:
            assert "_id" not in m


# --------- Admin login ---------
class TestAdminLogin:
    def test_login_ok(self):
        r = requests.post(f"{API}/admin/login", json={"nickname": ADMIN_NICKNAME, "password": ADMIN_PASSWORD})
        assert r.status_code == 200
        assert r.json().get("ok") is True

    def test_login_wrong_password(self):
        r = requests.post(f"{API}/admin/login", json={"nickname": ADMIN_NICKNAME, "password": "wrong"})
        assert r.status_code == 401

    def test_login_wrong_nickname(self):
        r = requests.post(f"{API}/admin/login", json={"nickname": "Boss", "password": ADMIN_PASSWORD})
        assert r.status_code == 401


# --------- Auth guard on writes ---------
class TestAuthGuard:
    def test_post_players_no_hdr(self):
        r = requests.post(f"{API}/players", json={"name": "TEST_x"})
        assert r.status_code == 401

    def test_post_matches_wrong_hdr(self):
        r = requests.post(f"{API}/matches", json={"teamA": [], "teamB": [], "winner": "A"}, headers={"X-Admin-Password": "no"})
        assert r.status_code == 401

    def test_delete_player_no_hdr(self):
        r = requests.delete(f"{API}/players/some-id")
        assert r.status_code == 401

    def test_put_elo_no_hdr(self):
        r = requests.put(f"{API}/players/some-id/elo", json={"currentElo": 1200})
        assert r.status_code == 401

    def test_reset_stats_no_hdr(self):
        r = requests.post(f"{API}/reset-stats")
        assert r.status_code == 401

    def test_reset_demo_no_hdr(self):
        r = requests.post(f"{API}/reset-demo")
        assert r.status_code == 401

    def test_put_match_no_hdr(self):
        r = requests.put(f"{API}/matches/x", json={"teamA": [], "teamB": [], "winner": "A"})
        assert r.status_code == 401

    def test_delete_match_no_hdr(self):
        r = requests.delete(f"{API}/matches/x")
        assert r.status_code == 401


# --------- Players CRUD ---------
class TestPlayers:
    def test_add_delete_player(self):
        r = requests.post(f"{API}/players", json={"name": "TEST_Player", "startElo": 1000}, headers=HDR)
        assert r.status_code == 200
        s = requests.get(f"{API}/state").json()
        p = next((x for x in s["players"] if x["name"] == "TEST_Player"), None)
        assert p is not None
        assert p["currentElo"] == 1000 and p["peakElo"] == 1000
        # set elo (floor 500 check)
        r2 = requests.put(f"{API}/players/{p['id']}/elo", json={"currentElo": 100}, headers=HDR)
        assert r2.status_code == 200
        s2 = requests.get(f"{API}/state").json()
        p2 = next(x for x in s2["players"] if x["id"] == p["id"])
        assert p2["currentElo"] == 500  # floor
        # raise elo -> peak updated
        requests.put(f"{API}/players/{p['id']}/elo", json={"currentElo": 1500}, headers=HDR)
        s3 = requests.get(f"{API}/state").json()
        p3 = next(x for x in s3["players"] if x["id"] == p["id"])
        assert p3["currentElo"] == 1500 and p3["peakElo"] >= 1500
        # delete
        rd = requests.delete(f"{API}/players/{p['id']}", headers=HDR)
        assert rd.status_code == 200
        s4 = requests.get(f"{API}/state").json()
        assert not any(x["id"] == p["id"] for x in s4["players"])


# --------- Matches Elo ---------
class TestMatches:
    def test_record_edit_delete_flow(self):
        s0 = requests.get(f"{API}/state").json()
        v0 = s0["version"]
        ids = [p["id"] for p in s0["players"][:8]]
        teamA, teamB = ids[:4], ids[4:]
        mvp = teamA[0]

        # snapshot pre-elo
        pre = {p["id"]: p["currentElo"] for p in s0["players"] if p["id"] in ids}
        pre_wins = {p["id"]: p["wins"] for p in s0["players"] if p["id"] in ids}

        body = {"teamA": teamA, "teamB": teamB, "winner": "A", "mvpId": mvp,
                "mode": "Hardpoint", "game": "CW"}
        r = requests.post(f"{API}/matches", json=body, headers=HDR)
        assert r.status_code == 200

        s1 = requests.get(f"{API}/state").json()
        assert s1["version"] > v0
        # find the new match (has game=CW & mvpId=mvp on teamA order)
        by_id = {p["id"]: p for p in s1["players"]}
        # winners +25, losers -25 (approx, mvp +10)
        for pid in teamA:
            if pid == mvp:
                assert by_id[pid]["currentElo"] == pre[pid] + 35
            else:
                assert by_id[pid]["currentElo"] == pre[pid] + 25
            assert by_id[pid]["wins"] == pre_wins[pid] + 1
        for pid in teamB:
            assert by_id[pid]["currentElo"] == max(500, pre[pid] - 25)

        # newest match should be first (sorted desc by date)
        newest = s1["matches"][0]
        assert newest["game"] == "CW"
        assert newest["winner"] == "A"
        mid = newest["id"]

        # EDIT: flip winner to B, MVP to teamB[0]
        new_mvp = teamB[0]
        body2 = {"teamA": teamA, "teamB": teamB, "winner": "B", "mvpId": new_mvp,
                 "mode": "Hardpoint", "game": "CW"}
        r2 = requests.put(f"{API}/matches/{mid}", json=body2, headers=HDR)
        assert r2.status_code == 200

        s2 = requests.get(f"{API}/state").json()
        by_id2 = {p["id"]: p for p in s2["players"]}
        # teamB now winners (may include upset bonus of +15 as peakElo was raised for original winners)
        for pid in teamB:
            base = 35 if pid == new_mvp else 25
            gained = by_id2[pid]["currentElo"] - pre[pid]
            assert gained in (base, base + 15), f"team B winner gained {gained}, expected {base} or {base+15}"
        for pid in teamA:
            assert by_id2[pid]["currentElo"] == max(500, pre[pid] - 25)

        # DELETE - stats revert to pre
        rd = requests.delete(f"{API}/matches/{mid}", headers=HDR)
        assert rd.status_code == 200
        s3 = requests.get(f"{API}/state").json()
        by_id3 = {p["id"]: p for p in s3["players"]}
        for pid in ids:
            assert by_id3[pid]["currentElo"] == pre[pid]
            assert by_id3[pid]["wins"] == pre_wins[pid]


# --------- reset-demo ---------
class TestReset:
    def test_reset_demo(self):
        r = requests.post(f"{API}/reset-demo", headers=HDR)
        assert r.status_code == 200
        s = requests.get(f"{API}/state").json()
        assert len(s["players"]) == 20
        assert len(s["matches"]) == 10
