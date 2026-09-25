from fastapi import FastAPI, APIRouter, Header, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import uuid
import random
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict
from datetime import datetime, timezone, timedelta

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

ADMIN_PASSWORD = os.environ.get('ADMIN_PASSWORD', 'SYSMAFKKNGOD2001')
ADMIN_NICKNAME = os.environ.get('ADMIN_NICKNAME', 'Admin')

app = FastAPI()
api_router = APIRouter(prefix="/api")

# ------------------------------------------------------------------ ELO / stats
BASE_ELO = 1000
MIN_ELO = 500
WIN_DELTA = 25
LOSS_DELTA = 25
MVP_BONUS = 10
UPSET_BONUS = 15
GAMES = ["BO7", "BO6", "MW3", "WW2", "VG", "CW", "BO2", "MW4"]
MODES = ["Hardpoint", "Search & Destroy", "Control", "Domination"]
NAMES = ["Reaper", "Ghxst", "Vortex", "N0Scope", "Havoc", "Blaze", "Cyclone", "Venom",
         "Sh4dow", "Frost", "Razor", "Titan", "Phantom", "Nitro", "Kraken", "Rogue",
         "Sniperz", "Blitz", "Echo", "Fury"]


def win_rate(p):
    return round((p["wins"] / p["totalMatches"]) * 1000) / 10 if p["totalMatches"] else 0


def player_rating(p):
    return 0.6 * p["peakElo"] + 0.25 * p["currentElo"] + 0.15 * (win_rate(p) * 15)


def next_streak(streak, won):
    if won:
        return streak + 1 if streak > 0 else 1
    return streak - 1 if streak < 0 else -1


def new_player(name, start_elo=1000):
    return {
        "id": str(uuid.uuid4()),
        "name": name.strip(),
        "currentElo": start_elo,
        "peakElo": start_elo,
        "totalMatches": 0,
        "wins": 0,
        "losses": 0,
        "avgPlacement": 0,
        "last10": [],
        "currentStreak": 0,
        "mvpCount": 0,
        "eloHistory": [{"match": 0, "elo": start_elo}],
        "createdAt": datetime.now(timezone.utc).isoformat(),
    }


def apply_effects(by_id, team_a, team_b, winner, mvp_id):
    winners = team_a if winner == "A" else team_b
    losers = team_b if winner == "A" else team_a
    s_win = sum(player_rating(by_id[i]) for i in winners if i in by_id)
    s_los = sum(player_rating(by_id[i]) for i in losers if i in by_id)
    upset = s_win < s_los
    changes = {}
    for pid in team_a + team_b:
        p = by_id.get(pid)
        if not p:
            continue
        won = pid in winners
        delta = WIN_DELTA if won else -LOSS_DELTA
        if pid == mvp_id:
            delta += MVP_BONUS
        if won and upset:
            delta += UPSET_BONUS
        new_elo = max(MIN_ELO, p["currentElo"] + delta)
        p["currentElo"] = new_elo
        p["peakElo"] = max(p["peakElo"], new_elo)
        p["totalMatches"] += 1
        if won:
            p["wins"] += 1
        else:
            p["losses"] += 1
        if pid == mvp_id:
            p["mvpCount"] += 1
        p["eloHistory"] = p["eloHistory"] + [{"match": p["totalMatches"], "elo": new_elo}]
        changes[pid] = delta
    return changes


def revert_effects(by_id, match):
    winners = match["teamA"] if match["winner"] == "A" else match["teamB"]
    for pid in match["teamA"] + match["teamB"]:
        p = by_id.get(pid)
        if not p:
            continue
        delta = (match.get("eloChanges") or {}).get(pid, 0)
        p["currentElo"] = max(MIN_ELO, p["currentElo"] - delta)
        p["totalMatches"] = max(0, p["totalMatches"] - 1)
        if pid in winners:
            p["wins"] = max(0, p["wins"] - 1)
        else:
            p["losses"] = max(0, p["losses"] - 1)
        if pid == match.get("mvpId"):
            p["mvpCount"] = max(0, p["mvpCount"] - 1)
        if len(p["eloHistory"]) > 1:
            p["eloHistory"] = p["eloHistory"][:-1]


def recompute_recent(by_id, match_list, ids):
    for pid in ids:
        p = by_id.get(pid)
        if not p:
            continue
        involved = [m for m in match_list if pid in m["teamA"] or pid in m["teamB"]]
        involved.sort(key=lambda m: m["date"], reverse=True)
        results = ["W" if pid in (m["teamA"] if m["winner"] == "A" else m["teamB"]) else "L" for m in involved]
        p["last10"] = results[:10]
        streak = 0
        for r in results:
            if streak == 0:
                streak = 1 if r == "W" else -1
            elif streak > 0 and r == "W":
                streak += 1
            elif streak < 0 and r == "L":
                streak -= 1
            else:
                break
        p["currentStreak"] = streak


# ------------------------------------------------------------------ demo seed
def build_demo():
    rnd = random.Random(42)
    players = []
    for name in NAMES:
        p = new_player(name)
        total = 20 + rnd.randint(0, 59)
        wr = 0.35 + rnd.random() * 0.4
        wins = round(total * wr)
        cur = 850 + rnd.randint(0, 699)
        peak = cur + rnd.randint(0, 149)
        p.update({
            "currentElo": cur,
            "peakElo": peak,
            "totalMatches": total,
            "wins": wins,
            "losses": total - wins,
            "avgPlacement": round(1 + rnd.random() * 3, 1),
            "mvpCount": int(rnd.random() * wins * 0.3),
            "last10": ["W" if rnd.random() < wr else "L" for _ in range(10)],
            "currentStreak": rnd.choice([-3, -2, -1, 1, 2, 3, 4]),
        })
        hist = []
        e = max(MIN_ELO, cur - 120)
        for j in range(12):
            e = round(e + (cur - e) * 0.25 + (rnd.random() - 0.5) * 40)
            hist.append({"match": j, "elo": max(MIN_ELO, e)})
        hist.append({"match": 12, "elo": cur})
        p["eloHistory"] = hist
        players.append(p)

    matches = []
    ids = [p["id"] for p in players]
    for i in range(10):
        pool = rnd.sample(ids, 8)
        team_a, team_b = pool[:4], pool[4:]
        winner = "A" if rnd.random() < 0.5 else "B"
        winners = team_a if winner == "A" else team_b
        mvp_id = rnd.choice(winners)
        elo_changes = {}
        for pid in pool:
            won = pid in winners
            d = WIN_DELTA if won else -LOSS_DELTA
            if pid == mvp_id:
                d += MVP_BONUS
            elo_changes[pid] = d
        matches.append({
            "id": str(uuid.uuid4()),
            "date": (datetime.now(timezone.utc) - timedelta(days=(10 - i), hours=rnd.randint(0, 20))).isoformat(),
            "teamA": team_a,
            "teamB": team_b,
            "winner": winner,
            "mvpId": mvp_id,
            "map": "",
            "mode": rnd.choice(MODES),
            "game": rnd.choice(GAMES),
            "eloChanges": elo_changes,
        })
    matches.sort(key=lambda m: m["date"], reverse=True)
    return players, matches


# ------------------------------------------------------------------ persistence
async def load_players():
    return await db.players.find({}, {"_id": 0}).to_list(1000)


async def load_matches():
    docs = await db.matches.find({}, {"_id": 0}).to_list(5000)
    docs.sort(key=lambda m: m["date"], reverse=True)
    return docs


async def bump_version():
    await db.meta.update_one({"_id": "state"}, {"$inc": {"version": 1}}, upsert=True)


async def save_players(players):
    await db.players.delete_many({})
    if players:
        await db.players.insert_many([{**p} for p in players])
    await bump_version()


async def save_matches(matches):
    await db.matches.delete_many({})
    if matches:
        await db.matches.insert_many([{**m} for m in matches])
    await bump_version()


async def get_version():
    meta = await db.meta.find_one({"_id": "state"})
    return meta.get("version", 0) if meta else 0


async def ensure_seed():
    count = await db.players.count_documents({})
    if count == 0:
        players, matches = build_demo()
        await save_players(players)
        await save_matches(matches)


# ------------------------------------------------------------------ models
class MatchIn(BaseModel):
    teamA: List[str]
    teamB: List[str]
    winner: str
    mvpId: Optional[str] = None
    map: Optional[str] = ""
    mode: Optional[str] = ""
    game: Optional[str] = ""
    date: Optional[str] = None


class PlayerIn(BaseModel):
    name: str
    startElo: int = 1000


class EloIn(BaseModel):
    currentElo: int


class ImportIn(BaseModel):
    players: List[dict]


class RestoreIn(BaseModel):
    players: List[dict]
    matches: List[dict] = []


class LoginIn(BaseModel):
    nickname: str
    password: str


def require_admin(x_admin_password: Optional[str] = Header(None)):
    if x_admin_password != ADMIN_PASSWORD:
        raise HTTPException(status_code=401, detail="Admin authentication required")
    return True


# ------------------------------------------------------------------ routes
@api_router.get("/")
async def root():
    return {"message": "MuchoMoney8s API"}


@api_router.post("/admin/login")
async def admin_login(body: LoginIn):
    if body.nickname.strip().lower() != ADMIN_NICKNAME.lower() or body.password != ADMIN_PASSWORD:
        raise HTTPException(status_code=401, detail="Access denied — invalid admin credentials")
    return {"ok": True, "nickname": ADMIN_NICKNAME}


@api_router.get("/state")
async def get_state():
    await ensure_seed()
    players = await load_players()
    matches = await load_matches()
    version = await get_version()
    return {"players": players, "matches": matches, "version": version}


@api_router.post("/matches")
async def record_match(body: MatchIn, x_admin_password: Optional[str] = Header(None)):
    require_admin(x_admin_password)
    players = await load_players()
    matches = await load_matches()
    by_id = {p["id"]: p for p in players}
    changes = apply_effects(by_id, body.teamA, body.teamB, body.winner, body.mvpId)
    # last10 + streak for record (prepend style, consistent with recompute afterwards)
    match = {
        "id": str(uuid.uuid4()),
        "date": body.date or datetime.now(timezone.utc).isoformat(),
        "teamA": body.teamA,
        "teamB": body.teamB,
        "winner": body.winner,
        "mvpId": body.mvpId,
        "map": body.map or "",
        "mode": body.mode or "",
        "game": body.game or "",
        "eloChanges": changes,
    }
    matches = [match] + matches
    recompute_recent(by_id, matches, set(body.teamA + body.teamB))
    await save_players(list(by_id.values()))
    await save_matches(matches)
    return {"ok": True}


@api_router.put("/matches/{match_id}")
async def edit_match(match_id: str, body: MatchIn, x_admin_password: Optional[str] = Header(None)):
    require_admin(x_admin_password)
    players = await load_players()
    matches = await load_matches()
    old = next((m for m in matches if m["id"] == match_id), None)
    if not old:
        raise HTTPException(status_code=404, detail="Match not found")
    by_id = {p["id"]: p for p in players}
    revert_effects(by_id, old)
    new_match = {**old, "teamA": body.teamA, "teamB": body.teamB, "winner": body.winner,
                 "mvpId": body.mvpId, "mode": body.mode if body.mode is not None else old.get("mode", ""),
                 "game": body.game if body.game is not None else old.get("game", "")}
    changes = apply_effects(by_id, body.teamA, body.teamB, body.winner, body.mvpId)
    new_match["eloChanges"] = changes
    matches = [new_match if m["id"] == match_id else m for m in matches]
    ids = set(old["teamA"] + old["teamB"] + body.teamA + body.teamB)
    recompute_recent(by_id, matches, ids)
    await save_players(list(by_id.values()))
    await save_matches(matches)
    return {"ok": True}


@api_router.delete("/matches/{match_id}")
async def delete_match(match_id: str, x_admin_password: Optional[str] = Header(None)):
    require_admin(x_admin_password)
    players = await load_players()
    matches = await load_matches()
    old = next((m for m in matches if m["id"] == match_id), None)
    if not old:
        raise HTTPException(status_code=404, detail="Match not found")
    by_id = {p["id"]: p for p in players}
    revert_effects(by_id, old)
    matches = [m for m in matches if m["id"] != match_id]
    recompute_recent(by_id, matches, set(old["teamA"] + old["teamB"]))
    await save_players(list(by_id.values()))
    await save_matches(matches)
    return {"ok": True}


@api_router.post("/players")
async def add_player(body: PlayerIn, x_admin_password: Optional[str] = Header(None)):
    require_admin(x_admin_password)
    players = await load_players()
    players.append(new_player(body.name, body.startElo))
    await save_players(players)
    return {"ok": True}


@api_router.delete("/players/{player_id}")
async def remove_player(player_id: str, x_admin_password: Optional[str] = Header(None)):
    require_admin(x_admin_password)
    players = await load_players()
    players = [p for p in players if p["id"] != player_id]
    await save_players(players)
    return {"ok": True}


@api_router.put("/players/{player_id}/elo")
async def set_elo(player_id: str, body: EloIn, x_admin_password: Optional[str] = Header(None)):
    require_admin(x_admin_password)
    players = await load_players()
    for p in players:
        if p["id"] == player_id:
            elo = max(MIN_ELO, round(body.currentElo))
            p["currentElo"] = elo
            p["peakElo"] = max(p["peakElo"], elo)
            p["eloHistory"] = p["eloHistory"] + [{"match": len(p["eloHistory"]), "elo": elo}]
    await save_players(players)
    return {"ok": True}


@api_router.post("/reset-stats")
async def reset_stats(x_admin_password: Optional[str] = Header(None)):
    require_admin(x_admin_password)
    players = await load_players()
    for p in players:
        p.update({"currentElo": 1000, "peakElo": 1000, "totalMatches": 0, "wins": 0, "losses": 0,
                  "avgPlacement": 0, "last10": [], "currentStreak": 0, "mvpCount": 0,
                  "eloHistory": [{"match": 0, "elo": 1000}]})
    await save_players(players)
    await save_matches([])
    return {"ok": True}


@api_router.post("/reset-demo")
async def reset_demo(x_admin_password: Optional[str] = Header(None)):
    require_admin(x_admin_password)
    players, matches = build_demo()
    await save_players(players)
    await save_matches(matches)
    return {"ok": True}


@api_router.post("/players/import")
async def import_players(body: ImportIn, x_admin_password: Optional[str] = Header(None)):
    require_admin(x_admin_password)
    cleaned = []
    for p in body.players:
        cur = int(p.get("currentElo") or 1000)
        cleaned.append({
            "id": p.get("id") or str(uuid.uuid4()),
            "name": str(p.get("name") or "Unknown"),
            "currentElo": cur,
            "peakElo": int(p.get("peakElo") or cur),
            "totalMatches": int(p.get("totalMatches") or 0),
            "wins": int(p.get("wins") or 0),
            "losses": int(p.get("losses") or 0),
            "avgPlacement": float(p.get("avgPlacement") or 0),
            "last10": p.get("last10") if isinstance(p.get("last10"), list) else [],
            "currentStreak": int(p.get("currentStreak") or 0),
            "mvpCount": int(p.get("mvpCount") or 0),
            "eloHistory": p.get("eloHistory") if isinstance(p.get("eloHistory"), list) else [{"match": 0, "elo": cur}],
            "createdAt": p.get("createdAt") or datetime.now(timezone.utc).isoformat(),
        })
    await save_players(cleaned)
    return {"ok": True}


@api_router.post("/restore")
async def restore_local(body: RestoreIn, x_admin_password: Optional[str] = Header(None)):
    require_admin(x_admin_password)
    cleaned_players = []
    for p in body.players:
        cur = int(p.get("currentElo") or 1000)
        cleaned_players.append({
            "id": p.get("id") or str(uuid.uuid4()),
            "name": str(p.get("name") or "Unknown"),
            "currentElo": cur,
            "peakElo": int(p.get("peakElo") or cur),
            "totalMatches": int(p.get("totalMatches") or 0),
            "wins": int(p.get("wins") or 0),
            "losses": int(p.get("losses") or 0),
            "avgPlacement": float(p.get("avgPlacement") or 0),
            "last10": p.get("last10") if isinstance(p.get("last10"), list) else [],
            "currentStreak": int(p.get("currentStreak") or 0),
            "mvpCount": int(p.get("mvpCount") or 0),
            "eloHistory": p.get("eloHistory") if isinstance(p.get("eloHistory"), list) else [{"match": 0, "elo": cur}],
            "createdAt": p.get("createdAt") or datetime.now(timezone.utc).isoformat(),
        })
    cleaned_matches = []
    for m in body.matches:
        if not isinstance(m.get("teamA"), list) or not isinstance(m.get("teamB"), list):
            continue
        cleaned_matches.append({
            "id": m.get("id") or str(uuid.uuid4()),
            "date": m.get("date") or datetime.now(timezone.utc).isoformat(),
            "teamA": m.get("teamA", []),
            "teamB": m.get("teamB", []),
            "winner": m.get("winner", "A"),
            "mvpId": m.get("mvpId"),
            "map": m.get("map") or "",
            "mode": m.get("mode") or "",
            "game": m.get("game") or "",
            "eloChanges": m.get("eloChanges") or {},
        })
    cleaned_matches.sort(key=lambda x: x["date"], reverse=True)
    await save_players(cleaned_players)
    await save_matches(cleaned_matches)
    return {"ok": True, "players": len(cleaned_players), "matches": len(cleaned_matches)}


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
