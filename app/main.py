# --- User Stats Helpers ---
def get_user_stats_collection():
    from app.story_engine import get_mongo_db
    db = get_mongo_db()
    return db["user_stats"]

def get_or_create_user_stats(username):
    stats_col = get_user_stats_collection()
    stats = stats_col.find_one({"username": username})
    if not stats:
        stats = {
            "username": username,
            "stories_generated": 0,
            "good_answers": 0,
            "bad_answers": 0,
            "unclear_answers": 0
        }
        stats_col.insert_one(stats)
    return stats

def increment_user_stat(username, field):
    stats_col = get_user_stats_collection()
    stats_col.update_one({"username": username}, {"$inc": {field: 1}}, upsert=True)
# ...existing imports...
# ...existing code...
# ...existing code...
# ...existing code...
# ...existing code...
# ...existing code...
# ...existing code...




# --- ENV and Imports ---
from pathlib import Path
from dotenv import load_dotenv
import logging
import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from passlib.context import CryptContext
from app.models import (
    GenerateStoryRequest,
    GeneratedStory,
    EvaluateAnswerRequest,
    EvaluateAnswerResponse,
    EvaluationResult,
)
from app.story_engine import StoryEngine

# --- Load .env early ---
_ROOT = Path(__file__).resolve().parents[1]
load_dotenv(_ROOT / ".env")
load_dotenv(_ROOT.parent / ".env")
load_dotenv()

# --- Logging ---
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# --- FastAPI App ---
app = FastAPI(title="AudioAlly Story Engine", version="0.2.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Endpoint to save a prompt string to a .txt file
# PDF upload endpoint (migrated from Node.js)
from fastapi import UploadFile, File
from fastapi.responses import JSONResponse
import gridfs
import pymongo
import shutil

from fastapi import Body
@app.post("/api/save-prompt")
async def save_prompt(prompt: str = Body(..., embed=True)):
    import os
    from datetime import datetime
    try:
        os.makedirs("generated_prompts", exist_ok=True)
        filename = datetime.utcnow().strftime("generated_%Y%m%d_%H%M%S.txt")
        filepath = os.path.join("generated_prompts", filename)
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(str(prompt))
        # Also update last_prompt.txt for quick access
        with open("last_prompt.txt", "w", encoding="utf-8") as f:
            f.write(str(prompt))
        return {"status": "success", "filename": filename}
    except Exception as file_exc:
        return {"status": "error", "detail": str(file_exc)}


# --- Password Hashing (argon2) ---
pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")

class UserCreate(BaseModel):
    username: str
    password: str

class UserLogin(BaseModel):
    username: str
    password: str

def get_password_hash(password):
    return pwd_context.hash(password)

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)



# --- Login/Register Endpoints ---
from fastapi import status
from fastapi.responses import JSONResponse
from pymongo import MongoClient

# Helper to get users collection
def get_users_collection():
    from app.story_engine import get_mongo_db
    db = get_mongo_db()
    return db["users"]

@app.post("/api/register")
async def register_user(user: UserCreate):
    # Debug: log password length
    logger.info(f"[DEBUG] Register attempt: username={user.username}, password_len={len(user.password)}, password_bytes={len(user.password.encode('utf-8'))}")
    # Argon2 does not have the 72-byte limit, so we remove that check
    users = get_users_collection()
    if users.find_one({"username": user.username}):
        return JSONResponse(status_code=status.HTTP_409_CONFLICT, content={"detail": "Username already exists"})
    hashed_password = get_password_hash(user.password)
    users.insert_one({"username": user.username, "password": hashed_password})
    return {"status": "success", "username": user.username}

@app.post("/api/login")
async def login_user(user: UserLogin):
    users = get_users_collection()
    db_user = users.find_one({"username": user.username})
    if not db_user or not verify_password(user.password, db_user["password"]):
        return JSONResponse(status_code=status.HTTP_401_UNAUTHORIZED, content={"detail": "Invalid username or password"})
    return {"status": "success", "username": user.username}

# --- Health Checkpoints ---
@app.get("/api/health")
async def health_check():
    checks = {}
    # Check environment variables
    checks["env_gemini_api_key"] = bool(os.getenv("GEMINI_API_KEY"))
    checks["env_mongodb_uri"] = bool(os.getenv("MONGODB_URI"))
    # Check password hashing
    try:
        test_hash = get_password_hash("test")
        checks["password_hashing"] = verify_password("test", test_hash)
    except Exception as e:
        checks["password_hashing"] = f"error: {e}"
    # Check MongoDB connection
    try:
        from app.story_engine import get_mongo_db
        db = get_mongo_db()
        db.command("ping")
        checks["mongodb"] = True
    except Exception as e:
        checks["mongodb"] = f"error: {e}"
    return {
        "status": "ok" if all(v is True for v in checks.values()) else "error",
        "checks": checks,
        "version": "0.2.0",
    }

# --- Story Engine and Endpoints ---
_engine: StoryEngine | None = None

def get_engine() -> StoryEngine:
    global _engine
    if _engine is None:
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise RuntimeError("GEMINI_API_KEY not set in .env")
        _engine = StoryEngine(gemini_api_key=api_key)
    return _engine

from fastapi import Depends
from fastapi import Request as FastAPIRequest

@app.post("/api/generate-story", response_model=GeneratedStory)
async def generate_story(request: GenerateStoryRequest, fastapi_request: FastAPIRequest = None):
    if not request.content and not request.topic and not request.document_id:
        raise HTTPException(status_code=400, detail="Provide content, topic, or document_id")
    logger.info("[HEALTH] /api/generate-story called")
    try:
        # Get username from session (if available)
        username = None
        if fastapi_request:
            data = await fastapi_request.json()
            username = data.get("username")
        logger.info("[HEALTH] Getting story engine...")
        engine = get_engine()
        logger.info("[HEALTH] Story engine ready: %s", engine)
        logger.info("[HEALTH] Generating story...")
        story = await engine.generate_story(request)
        # Increment stories_generated for user if username provided
        if username:
            increment_user_stat(username, "stories_generated")
        prompt = getattr(story, 'story_paragraph', str(story))
        logger.info(f"[HEALTH] Story generated: {prompt}")
        logger.warning("\n================ GENERATED PROMPT ================\n%s\n=================================================\n", str(prompt))
        # Save the generated prompt to a uniquely named .txt file in 'generated_prompts' folder
        import os
        from datetime import datetime
        try:
            abs_dir = os.path.abspath("generated_prompts")
            os.makedirs(abs_dir, exist_ok=True)
            filename = datetime.utcnow().strftime("generated_%Y%m%d_%H%M%S.txt")
            filepath = os.path.join(abs_dir, filename)
            logger.info(f"[DEBUG] Writing prompt to: {filepath}")
            with open(filepath, "w", encoding="utf-8") as f:
                f.write(str(prompt))
            last_prompt_path = os.path.abspath("last_prompt.txt")
            logger.info(f"[DEBUG] Writing last prompt to: {last_prompt_path}")
            with open(last_prompt_path, "w", encoding="utf-8") as f:
                f.write(str(prompt))
        except Exception as file_exc:
            logger.error(f"[ERROR] Failed to write prompt to file: {file_exc}")
            import traceback
            logger.error(traceback.format_exc())
        # Save the generated prompt to MongoDB 'test' collection, exactly like the node test command
        try:
            logger.info("[HEALTH] Connecting to MongoDB...")
            from app.story_engine import get_mongo_db
            db = get_mongo_db()
            logger.info("[HEALTH] Connected to MongoDB: %s", db)
            logger.info(f"[HEALTH] Inserting prompt into 'test' collection: {prompt}")
            result = db["test"].insert_one({
                "prompt": prompt,
                "createdAt": __import__('datetime').datetime.utcnow()
            })
            logger.info(f"[HEALTH] Inserted prompt with id: {result.inserted_id}")
        except Exception as db_exc:
            logger.warning(f"[HEALTH] Failed to save prompt to MongoDB: {db_exc}")
        logger.info("[HEALTH] Returning story response.")
        return story
    except ValueError as e:
        logger.error(f"[HEALTH] ValueError: {e}")
        raise HTTPException(status_code=422, detail=str(e))
    except NotImplementedError as e:
        logger.error(f"[HEALTH] NotImplementedError: {e}")
        raise HTTPException(status_code=501, detail=str(e))
    except Exception as e:
        logger.exception("[HEALTH] Story generation failed")
        raise HTTPException(status_code=500, detail=f"Generation failed: {e}")

@app.post("/api/evaluate-answer", response_model=EvaluateAnswerResponse)
async def evaluate_answer(request: EvaluateAnswerRequest, fastapi_request: FastAPIRequest = None):
    if not request.child_answer_text.strip():
        return EvaluateAnswerResponse(
            result=EvaluationResult.UNCLEAR,
            encouragement="I didn't hear anything — try tapping the microphone and speaking up!",
            explanation=None,
        )
    try:
        username = None
        if fastapi_request:
            data = await fastapi_request.json()
            username = data.get("username")
        eval_response = await get_engine().evaluate_answer(request)
        # Increment answer stats for user if username provided
        if username:
            if hasattr(eval_response, "result"):
                result = str(eval_response.result).lower()
                if "good" in result:
                    increment_user_stat(username, "good_answers")
                elif "bad" in result:
                    increment_user_stat(username, "bad_answers")
                else:
                    increment_user_stat(username, "unclear_answers")
        return eval_response
    except Exception as e:
        logger.exception("Evaluation failed")
        # NEVER let a technical failure punish the child
        return EvaluateAnswerResponse(
            result=EvaluationResult.UNCLEAR,
            encouragement="Hmm, I had trouble hearing that. Can you try one more time?",
            explanation=None,
        )

# --- User Stats API ---
@app.get("/api/user-stats/{username}")
async def get_user_stats(username: str):
    stats = get_or_create_user_stats(username)
    # Remove MongoDB _id for clean output
    stats.pop("_id", None)
    return stats
