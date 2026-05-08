from fastapi import FastAPI, APIRouter
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from motor.motor_asyncio import AsyncIOMotorDatabase
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import Any, Dict, List, Optional
import uuid
from datetime import datetime, timezone


ROOT_DIR: Path = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
client: Optional[AsyncIOMotorClient] = None
db: Optional[AsyncIOMotorDatabase] = None


def _require_env_var(name: str) -> str:
    value: Optional[str] = os.environ.get(name)
    if not value:
        raise ValueError(f"Missing required env var: {name}")
    return value


def init_db() -> None:
    global client, db
    mongo_url: str = _require_env_var("MONGO_URL")
    db_name: str = _require_env_var("DB_NAME")
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]


def get_db() -> AsyncIOMotorDatabase:
    if db is None:
        raise RuntimeError("Database is not initialized")
    return db

# Create the main app without a prefix
app: FastAPI = FastAPI()

# Create a router with the /api prefix
api_router: APIRouter = APIRouter(prefix="/api")


# Define Models
class StatusCheck(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_name: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class StatusCheckCreate(BaseModel):
    client_name: str


# Add your routes to the router instead of directly to app
@api_router.get("/")
async def root() -> Dict[str, str]:
    return {"message": "Hello World"}


@api_router.post("/status", response_model=StatusCheck)
async def create_status_check(status_input: StatusCheckCreate) -> StatusCheck:
    status_dict: Dict[str, Any] = status_input.model_dump()
    status_obj: StatusCheck = StatusCheck.model_validate(status_dict)
    _ = await get_db().status_checks.insert_one(status_obj.model_dump())
    return status_obj


@api_router.get("/status", response_model=List[StatusCheck])
async def get_status_checks() -> List[StatusCheck]:
    status_checks: List[Dict[str, Any]] = await get_db().status_checks.find().to_list(1000)
    return [StatusCheck.model_validate(status_check) for status_check in status_checks]


# Include the router in the main app
app.include_router(api_router)

cors_origins: List[str] = os.environ.get('CORS_ORIGINS', '*').split(',')
allow_credentials: bool = cors_origins != ['*']

app.add_middleware(
    CORSMiddleware,
    allow_credentials=allow_credentials,
    allow_origins=cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger: logging.Logger = logging.getLogger(__name__)


@app.on_event("startup")
async def startup_db_client() -> None:
    init_db()


@app.on_event("shutdown")
async def shutdown_db_client() -> None:
    if client is not None:
        client.close()
