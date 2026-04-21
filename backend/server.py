from fastapi import FastAPI, APIRouter, HTTPException, Request, UploadFile, File, Form
from fastapi.responses import StreamingResponse, JSONResponse
from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
UPLOADS_DIR = ROOT_DIR / "uploads"
UPLOADS_DIR.mkdir(exist_ok=True)
load_dotenv(ROOT_DIR / '.env')

from starlette.middleware.cors import CORSMiddleware
from starlette.staticfiles import StaticFiles
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError
from bson import ObjectId
from bson.errors import InvalidId
import os
import logging
import uuid
import json
import re
import bcrypt
import jwt as pyjwt
import asyncio
from pywebpush import webpush, WebPushException
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone, timedelta

JWT_SECRET = os.environ.get('JWT_SECRET', 'replace-with-a-long-random-production-secret')
JWT_ALGORITHM = "HS256"
TEMP_DISABLE_STUDENT_LOGIN = os.environ.get('TEMP_DISABLE_STUDENT_LOGIN', 'true').lower() in {'1', 'true', 'yes', 'on'}
PAYMENT_SESSION_WINDOW_SECONDS = 4 * 60
MAX_PAYMENT_ATTEMPTS = 3
ADMIN_EMAIL = "sujalsinghrathore52@gmail.com"
ADMIN_PASSWORD = "Sujal@2004"
RECOVERY_ADMIN_EMAIL = ADMIN_EMAIL
RECOVERY_ADMIN_PASSWORD = ADMIN_PASSWORD

VAPID_PRIVATE_KEY = os.environ.get('VAPID_PRIVATE_KEY', '')
VAPID_PUBLIC_KEY = os.environ.get('VAPID_PUBLIC_KEY', '')
VAPID_CLAIMS_EMAIL = os.environ.get('VAPID_CLAIMS_EMAIL', 'mailto:admin@campusbite.com')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()
app.mount("/uploads", StaticFiles(directory=str(UPLOADS_DIR)), name="uploads")
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ── Notification Pub/Sub ──
notification_subscribers: Dict[str, List[asyncio.Queue]] = {}

async def publish_notification(student_id: str, event_data: dict):
    if student_id in notification_subscribers:
        for queue in notification_subscribers[student_id]:
            await queue.put(event_data)

def subscribe(student_id: str) -> asyncio.Queue:
    queue = asyncio.Queue()
    if student_id not in notification_subscribers:
        notification_subscribers[student_id] = []
    notification_subscribers[student_id].append(queue)
    return queue

def unsubscribe(student_id: str, queue: asyncio.Queue):
    if student_id in notification_subscribers:
        notification_subscribers[student_id] = [q for q in notification_subscribers[student_id] if q is not queue]
        if not notification_subscribers[student_id]:
            del notification_subscribers[student_id]

# ── Web Push Notifications ──

async def send_push_notification(student_id: str, payload: dict):
    """Send push notifications to all registered subscriptions for a student."""
    if not VAPID_PRIVATE_KEY or not VAPID_PUBLIC_KEY:
        logger.warning("VAPID keys not configured, skipping push notification")
        return

    subscriptions = await db.push_subscriptions.find(
        {"student_id": student_id}
    ).to_list(50)

    if not subscriptions:
        return

    payload_str = json.dumps(payload)
    stale_ids = []

    for sub_doc in subscriptions:
        subscription_info = sub_doc.get("subscription")
        if not subscription_info:
            continue
        try:
            webpush(
                subscription_info=subscription_info,
                data=payload_str,
                vapid_private_key=VAPID_PRIVATE_KEY,
                vapid_claims={"sub": VAPID_CLAIMS_EMAIL}
            )
        except WebPushException as e:
            resp = getattr(e, 'response', None)
            status = resp.status_code if resp else 0
            if status in (404, 410):
                stale_ids.append(sub_doc["_id"])
            else:
                logger.error(f"Push notification failed: {e}")
        except Exception as e:
            logger.error(f"Push notification error: {e}")

    if stale_ids:
        await db.push_subscriptions.delete_many({"_id": {"$in": stale_ids}})

class PushSubscriptionReq(BaseModel):
    subscription: Dict[str, Any]

# ── Auth Utilities ──

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode('utf-8'), hashed.encode('utf-8'))

def create_token(user_id: str, role: str, extra: dict = None) -> str:
    payload = {
        "sub": user_id,
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(hours=24),
        "jti": uuid.uuid4().hex,
        **(extra or {})
    }
    return pyjwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def get_current_user(request: Request) -> dict:
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(401, "Not authenticated")
    try:
        payload = pyjwt.decode(auth[7:], JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except pyjwt.ExpiredSignatureError:
        raise HTTPException(401, "Token expired")
    except pyjwt.InvalidTokenError:
        raise HTTPException(401, "Invalid token")

def utc_now() -> datetime:
    return datetime.now(timezone.utc)

def parse_iso_datetime(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)

def payment_error(message: str, status_code: int = 400):
    return JSONResponse(
        status_code=status_code,
        content={"status": "error", "message": message, "detail": message}
    )

def build_public_file_url(request: Request, filename: str) -> str:
    return f"{str(request.base_url).rstrip('/')}/uploads/{filename}"

# ── Models ──

class StudentLoginReq(BaseModel):
    auid: Optional[str] = None
    phone: Optional[str] = None

class StaffLoginReq(BaseModel):
    email: str
    password: str

class TemporaryStudentLoginReq(BaseModel):
    auid: Optional[str] = None

class OrderItem(BaseModel):
    item_id: str
    name: str
    qty: int
    price: int

class CreateOrderReq(BaseModel):
    canteen_id: str
    items: List[OrderItem]
    payment_method: Optional[str] = "none"  # "none" or "qr"
    utr: Optional[str] = None  # UTR for QR payments
    submitted_amount: Optional[int] = None
    payment_session_id: Optional[str] = None
    payment_session_started_at: Optional[str] = None

class StatusUpdateReq(BaseModel):
    status: str

class UploadQRReq(BaseModel):
    qr_code: str  # QR image URL or base64

class CreateCanteenReq(BaseModel):
    canteen_id: str
    name: str
    description: str

class UpdateCanteenReq(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    upi_id: Optional[str] = None

class CreateMenuItemReq(BaseModel):
    item_id: str
    canteen_id: str
    name: str
    price: int
    image: str = ""
    category: str = "general"
    veg: bool = True

class UpdateMenuItemReq(BaseModel):
    name: Optional[str] = None
    price: Optional[int] = None
    image: Optional[str] = None
    category: Optional[str] = None
    veg: Optional[bool] = None
    available: Optional[bool] = None

class CreateStaffReq(BaseModel):
    email: str
    password: str
    name: str
    canteen_id: str

# ── Token Counter ──

async def get_next_token():
    result = await db.counters.find_one_and_update(
        {"_id": "token_counter"},
        {"$inc": {"seq": 1}},
        upsert=True,
        return_document=ReturnDocument.AFTER
    )
    return result["seq"]

# ── Seed ──

async def seed_data():
    if await db.canteens.count_documents({}) == 0:
        await db.canteens.insert_many([
            {"canteen_id": "main", "name": "Main Canteen", "description": "North Indian Meals & Thali", "status": "active", "upi_id": "maincanteen@paytm", "qr_code": "https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=upi://pay?pa=maincanteen@paytm&pn=MainCanteen"},
            {"canteen_id": "quick", "name": "Quick Bites", "description": "Burgers, Wraps & Fries", "status": "active", "upi_id": "quickbites@paytm", "qr_code": "https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=upi://pay?pa=quickbites@paytm&pn=QuickBites"},
            {"canteen_id": "juice", "name": "Juice & Shakes", "description": "Fresh Beverages & Snacks", "status": "active", "upi_id": "juiceshakes@paytm", "qr_code": "https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=upi://pay?pa=juiceshakes@paytm&pn=JuiceShakes"},
            {"canteen_id": "south", "name": "South Express", "description": "Dosa, Idli & More", "status": "active", "upi_id": "southexpress@paytm", "qr_code": "https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=upi://pay?pa=southexpress@paytm&pn=SouthExpress"},
        ])
        logger.info("Seeded canteens")

    if await db.menu_items.count_documents({}) == 0:
        items = [
            {"item_id": "m1", "canteen_id": "main", "name": "Veg Thali", "price": 80, "image": "https://images.unsplash.com/photo-1742281257687-092746ad6021?w=400", "category": "meals", "veg": True, "available": True},
            {"item_id": "m2", "canteen_id": "main", "name": "Paneer Thali", "price": 100, "image": "https://images.pexels.com/photos/17223838/pexels-photo-17223838.jpeg?auto=compress&cs=tinysrgb&w=400", "category": "meals", "veg": True, "available": True},
            {"item_id": "m3", "canteen_id": "main", "name": "Dal Rice", "price": 50, "image": "https://images.unsplash.com/photo-1596797038530-2c107229654b?w=400", "category": "meals", "veg": True, "available": True},
            {"item_id": "m4", "canteen_id": "main", "name": "Chole Bhature", "price": 60, "image": "https://images.unsplash.com/photo-1626132647523-66f5bf380027?w=400", "category": "snacks", "veg": True, "available": True},
            {"item_id": "m5", "canteen_id": "main", "name": "Aloo Paratha", "price": 40, "image": "https://images.unsplash.com/photo-1645177628172-a94c1f96e6db?w=400", "category": "snacks", "veg": True, "available": True},
            {"item_id": "m6", "canteen_id": "main", "name": "Rajma Chawal", "price": 55, "image": "https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=400", "category": "meals", "veg": True, "available": True},
            {"item_id": "q1", "canteen_id": "quick", "name": "Classic Burger", "price": 90, "image": "https://images.unsplash.com/photo-1626842514556-057dbce0379d?w=400", "category": "burgers", "veg": False, "available": True},
            {"item_id": "q2", "canteen_id": "quick", "name": "Veg Wrap", "price": 70, "image": "https://images.unsplash.com/photo-1659477483002-c5d0515b58d4?w=400", "category": "wraps", "veg": True, "available": True},
            {"item_id": "q3", "canteen_id": "quick", "name": "French Fries", "price": 50, "image": "https://images.pexels.com/photos/4109132/pexels-photo-4109132.jpeg?auto=compress&cs=tinysrgb&w=400", "category": "sides", "veg": True, "available": True},
            {"item_id": "q4", "canteen_id": "quick", "name": "Paneer Tikka Wrap", "price": 85, "image": "https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=400", "category": "wraps", "veg": True, "available": True},
            {"item_id": "q5", "canteen_id": "quick", "name": "Cheese Pizza Slice", "price": 60, "image": "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=400", "category": "pizza", "veg": True, "available": True},
            {"item_id": "q6", "canteen_id": "quick", "name": "Chicken Burger", "price": 110, "image": "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400", "category": "burgers", "veg": False, "available": True},
            {"item_id": "j1", "canteen_id": "juice", "name": "Mango Shake", "price": 45, "image": "https://images.unsplash.com/photo-1676689151683-db4bf03c8754?w=400", "category": "shakes", "veg": True, "available": True},
            {"item_id": "j2", "canteen_id": "juice", "name": "Cold Coffee", "price": 50, "image": "https://images.pexels.com/photos/17558646/pexels-photo-17558646.jpeg?auto=compress&cs=tinysrgb&w=400", "category": "coffee", "veg": True, "available": True},
            {"item_id": "j3", "canteen_id": "juice", "name": "Fresh Orange Juice", "price": 40, "image": "https://images.unsplash.com/photo-1621506289937-a8e4df240d0b?w=400", "category": "juices", "veg": True, "available": True},
            {"item_id": "j4", "canteen_id": "juice", "name": "Oreo Shake", "price": 60, "image": "https://images.unsplash.com/photo-1572490122747-3968b75cc699?w=400", "category": "shakes", "veg": True, "available": True},
            {"item_id": "j5", "canteen_id": "juice", "name": "Masala Chai", "price": 15, "image": "https://images.unsplash.com/photo-1571934811356-5cc061b6821f?w=400", "category": "hot", "veg": True, "available": True},
            {"item_id": "j6", "canteen_id": "juice", "name": "Lemon Soda", "price": 25, "image": "https://images.unsplash.com/photo-1523677011781-c91d1bbe2f9e?w=400", "category": "cold", "veg": True, "available": True},
            {"item_id": "s1", "canteen_id": "south", "name": "Masala Dosa", "price": 50, "image": "https://images.unsplash.com/photo-1630383249896-424e482df921?w=400", "category": "dosa", "veg": True, "available": True},
            {"item_id": "s2", "canteen_id": "south", "name": "Idli Sambar", "price": 35, "image": "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=400", "category": "breakfast", "veg": True, "available": True},
            {"item_id": "s3", "canteen_id": "south", "name": "Medu Vada", "price": 30, "image": "https://images.unsplash.com/photo-1626132647523-66f5bf380027?w=400", "category": "snacks", "veg": True, "available": True},
            {"item_id": "s4", "canteen_id": "south", "name": "Uttapam", "price": 45, "image": "https://images.unsplash.com/photo-1567337710282-00832b415979?w=400", "category": "breakfast", "veg": True, "available": True},
            {"item_id": "s5", "canteen_id": "south", "name": "Rava Dosa", "price": 55, "image": "https://images.unsplash.com/photo-1668236543090-82eba5ee5976?w=400", "category": "dosa", "veg": True, "available": True},
            {"item_id": "s6", "canteen_id": "south", "name": "Filter Coffee", "price": 20, "image": "https://images.unsplash.com/photo-1610889556528-9a770e32642f?w=400", "category": "hot", "veg": True, "available": True},
        ]
        await db.menu_items.insert_many(items)
        logger.info("Seeded menu items")

    await db.users.update_one(
        {"email": ADMIN_EMAIL, "role": "admin"},
        {"$set": {
            "email": ADMIN_EMAIL,
            "password_hash": hash_password(ADMIN_PASSWORD),
            "name": "Super Admin",
            "role": "admin"
        }, "$setOnInsert": {
            "created_at": datetime.now(timezone.utc).isoformat()
        }},
        upsert=True
    )
    logger.info("Seeded admin")

    await db.users.update_one(
        {"email": RECOVERY_ADMIN_EMAIL, "role": "admin"},
        {"$set": {
            "email": RECOVERY_ADMIN_EMAIL,
            "password_hash": hash_password(RECOVERY_ADMIN_PASSWORD),
            "name": "Super Admin",
            "role": "admin"
        }, "$setOnInsert": {
            "created_at": datetime.now(timezone.utc).isoformat()
        }},
        upsert=True
    )
    logger.info("Seeded recovery admin")

    staff_list = [
        {"email": "maincanteen@ait.edu", "name": "Main Canteen Staff", "canteen_id": "main"},
        {"email": "quickbites@ait.edu", "name": "Quick Bites Staff", "canteen_id": "quick"},
        {"email": "juiceshakes@ait.edu", "name": "Juice & Shakes Staff", "canteen_id": "juice"},
        {"email": "southexpress@ait.edu", "name": "South Express Staff", "canteen_id": "south"},
    ]
    for s in staff_list:
        if not await db.users.find_one({"email": s["email"]}):
            await db.users.insert_one({
                **s, "password_hash": hash_password("staff123"),
                "role": "canteen_staff",
                "created_at": datetime.now(timezone.utc).isoformat()
            })
    logger.info("Seeded staff")

    if not await db.counters.find_one({"_id": "token_counter"}):
        await db.counters.insert_one({"_id": "token_counter", "seq": 0})

    await db.users.create_index("email", sparse=True)
    await db.users.create_index("auid", sparse=True)
    await db.users.create_index("phone", sparse=True)
    await db.orders.create_index("order_id")
    await db.orders.create_index("student_auid")
    await db.orders.create_index("canteen_id")
    await db.menu_items.create_index("canteen_id")
    await db.canteens.create_index("canteen_id")
    await db.push_subscriptions.create_index("student_id")
    await db.payment_utrs.create_index("utr", unique=True)
    await db.payment_utrs.create_index("order_id")
    await db.payment_sessions.create_index("session_id", unique=True)

# ── Auth Routes ──

@api_router.get("/")
async def root():
    return {"message": "CampusBite API running"}
@api_router.post("/auth/student/login")
async def student_login(data: dict):
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    if not email or not password:
        raise HTTPException(400, "Email and password required")

    if not email.endswith("@acharya.ac.in"):
        raise HTTPException(400, "Use college email")

    user = await db.users.find_one({"email": email, "role": "student"})

    if not user:
        raise HTTPException(404, "User not found")

    if not verify_password(password, user["password_hash"]):
        raise HTTPException(401, "Invalid password")

    token = create_token(str(user["_id"]), "student", {
        "email": email,
        "auid": user.get("auid"),
        "phone": user.get("phone")
    })

    return {
        "token": token,
        "user": {
            "email": user["email"],
            "auid": user.get("auid"),
            "role": user["role"]
        }
    }

@api_router.post("/auth/student/temporary-login")
async def temporary_student_login(req: TemporaryStudentLoginReq):
    if TEMP_DISABLE_STUDENT_LOGIN:
        raise HTTPException(403, "Temporary student access is disabled")

    cleaned_auid = ''.join(ch for ch in (req.auid or "").upper() if ch.isalnum())[:24]
    if len(cleaned_auid) < 8:
        cleaned_auid = f"GUEST{uuid.uuid4().hex[:10].upper()}"

    user = await db.users.find_one({"auid": cleaned_auid, "role": "student"})
    if not user:
        doc = {
            "email": f"{cleaned_auid.lower()}@temporary.local",
            "auid": cleaned_auid,
            "phone": "",
            "password_hash": hash_password(uuid.uuid4().hex),
            "role": "student",
            "temporary": True,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        result = await db.users.insert_one(doc)
        user_id = str(result.inserted_id)
        user = {**doc, "_id": result.inserted_id}
    else:
        user_id = str(user["_id"])

    token = create_token(user_id, "student", {"auid": cleaned_auid, "temporary": True})
    return {
        "token": token,
        "user": {
            "id": user_id,
            "email": user["email"],
            "auid": cleaned_auid,
            "role": "student",
            "temporary": True
        }
    }
@api_router.post("/auth/register")
async def register_user(data: dict):
    email = (data.get("email") or "").strip().lower()
    auid = (data.get("auid") or "").strip().upper()
    phone = (data.get("phone") or "").strip()
    password = data.get("password") or ""

    if not email or not password or not auid:
        raise HTTPException(400, "Missing required fields")

    if not email.endswith("@acharya.ac.in"):
        raise HTTPException(400, "Use college email")

    existing = await db.users.find_one({
        "$or": [{"email": email}, {"auid": auid}]
    })

    if existing:
        raise HTTPException(400, "User already exists")

    hashed_pw = hash_password(password)

    await db.users.insert_one({
        "email": email,
        "auid": auid,
        "phone": phone,
        "password_hash": hashed_pw,
        "role": "student",
        "created_at": datetime.now(timezone.utc).isoformat()
    })

    return {"message": "Registered successfully"}
@api_router.post("/auth/staff/login")
async def staff_login(req: StaffLoginReq):
    email = req.email.strip().lower()
    user = await db.users.find_one({"email": email, "role": "canteen_staff"})
    if not user or not verify_password(req.password, user["password_hash"]):
        raise HTTPException(401, "Invalid email or password")
    user_id = str(user["_id"])
    token = create_token(user_id, "canteen_staff", {"canteen_id": user["canteen_id"]})
    canteen = await db.canteens.find_one({"canteen_id": user["canteen_id"]}, {"_id": 0})
    return {"token": token, "user": {
        "id": user_id, "email": user["email"], "name": user["name"],
        "role": "canteen_staff", "canteen_id": user["canteen_id"],
        "canteen_name": canteen["name"] if canteen else user["canteen_id"]
    }}

@api_router.post("/auth/admin/login")
async def admin_login(req: StaffLoginReq):
    email = req.email.strip().lower()
    if email != ADMIN_EMAIL or req.password != ADMIN_PASSWORD:
        raise HTTPException(401, "Invalid email or password")
    user = await db.users.find_one({"email": email, "role": "admin"})
    if not user:
        raise HTTPException(401, "Invalid email or password")
    user_id = str(user["_id"])
    token = create_token(user_id, "admin")
    return {"token": token, "user": {"id": user_id, "email": user["email"], "name": user["name"], "role": "admin"}}

@api_router.get("/auth/me")
async def get_me(request: Request):
    payload = await get_current_user(request)
    user = await db.users.find_one({"_id": ObjectId(payload["sub"])}, {"password_hash": 0})
    if not user:
        raise HTTPException(404, "User not found")
    user["id"] = str(user.pop("_id"))
    return user

# ── Public Routes ──

@api_router.get("/canteens")
async def get_canteens():
    return await db.canteens.find({}, {"_id": 0}).to_list(100)

@api_router.get("/canteens/{canteen_id}/menu")
async def get_menu(canteen_id: str):
    return await db.menu_items.find({"canteen_id": canteen_id, "available": True}, {"_id": 0}).to_list(100)

# ── Student Order Routes ──

@api_router.post("/orders")
async def create_order(req: CreateOrderReq, request: Request):
    payload = await get_current_user(request)
    if payload["role"] != "student":
        raise HTTPException(403, "Only students can place orders")
    canteen = await db.canteens.find_one({"canteen_id": req.canteen_id}, {"_id": 0})
    if not canteen:
        raise HTTPException(404, "Canteen not found")
    
    payment_method = (req.payment_method or "none").strip().lower()
    if payment_method not in {"none", "qr"}:
        raise HTTPException(400, "Invalid payment method")

    # Check if QR payment is enabled
    qr_enabled = canteen.get("qr_enabled", False)
    if payment_method == "qr" and not qr_enabled:
        raise HTTPException(400, "QR payment not enabled for this canteen")

    now = utc_now()
    now_iso = now.isoformat()
    student_identifier = payload.get("auid") or payload.get("phone") or payload.get("sub")
    if not student_identifier:
        raise HTTPException(400, "No student identifier found")

    if not req.items:
        raise HTTPException(400, "At least one item is required")

    validated_items = []
    seen_menu_items = {}
    for item in req.items:
        if item.qty <= 0:
            raise HTTPException(400, f"Invalid quantity for item {item.item_id}")

        menu_item = seen_menu_items.get(item.item_id)
        if not menu_item:
            menu_item = await db.menu_items.find_one(
                {"item_id": item.item_id, "canteen_id": req.canteen_id},
                {"_id": 0},
            )
            if not menu_item:
                raise HTTPException(404, f"Item not found: {item.item_id}")
            if not menu_item.get("available", True):
                raise HTTPException(400, f"Item unavailable: {menu_item.get('name', item.item_id)}")
            seen_menu_items[item.item_id] = menu_item

        validated_items.append({
            "item_id": menu_item["item_id"],
            "name": menu_item["name"],
            "qty": int(item.qty),
            "price": int(menu_item["price"]),
        })

    total = sum(i["price"] * i["qty"] for i in validated_items)

    # Determine payment status and priority
    payment_status = "unpaid"
    priority = False
    payment_metadata = {}
    order_is_suspicious = False

    if payment_method == "qr":
        session_id = (req.payment_session_id or "").strip()
        session_started_at = parse_iso_datetime(req.payment_session_started_at)
        submitted_amount = req.submitted_amount if req.submitted_amount is not None else total
        raw_utr = (req.utr or "").strip()

        if not session_id or not session_started_at:
            return payment_error("Payment session expired")

        session_expires_at = session_started_at + timedelta(seconds=PAYMENT_SESSION_WINDOW_SECONDS)
        session_doc = await db.payment_sessions.find_one({"session_id": session_id})

        if not session_doc:
            session_doc = {
                "session_id": session_id,
                "student_auid": student_identifier,
                "canteen_id": req.canteen_id,
                "total": total,
                "attempts": 0,
                "failed_attempts": 0,
                "blocked": False,
                "is_suspicious": False,
                "started_at": session_started_at.isoformat(),
                "expires_at": session_expires_at.isoformat(),
                "created_at": now_iso,
                "updated_at": now_iso,
            }
            await db.payment_sessions.insert_one(session_doc)
        else:
            stored_started_at = parse_iso_datetime(session_doc.get("started_at"))
            stored_expires_at = parse_iso_datetime(session_doc.get("expires_at"))
            if stored_started_at:
                session_started_at = stored_started_at
            if stored_expires_at:
                session_expires_at = stored_expires_at

        async def reject_payment(reason: str, suspicious: bool = False, status_code: int = 400):
            next_failed_attempts = int(session_doc.get("failed_attempts", 0)) + 1
            should_block = next_failed_attempts >= MAX_PAYMENT_ATTEMPTS
            session_flagged = suspicious or next_failed_attempts > 1 or session_doc.get("is_suspicious", False)
            await db.payment_sessions.update_one(
                {"session_id": session_id},
                {
                    "$inc": {"attempts": 1, "failed_attempts": 1},
                    "$set": {
                        "updated_at": utc_now().isoformat(),
                        "last_failure_reason": reason,
                        "blocked": should_block,
                        "is_suspicious": session_flagged,
                    }
                }
            )
            logger.warning(
                "QR payment rejected for session %s: %s (student=%s canteen=%s suspicious=%s)",
                session_id,
                reason,
                student_identifier,
                req.canteen_id,
                session_flagged,
            )
            return payment_error("Too many attempts" if should_block else reason, 429 if should_block else status_code)

        if session_doc.get("blocked") or int(session_doc.get("failed_attempts", 0)) >= MAX_PAYMENT_ATTEMPTS:
            await db.payment_sessions.update_one(
                {"session_id": session_id},
                {"$set": {"blocked": True, "updated_at": now_iso, "is_suspicious": True, "last_failure_reason": "Too many attempts"}}
            )
            logger.warning("Blocked QR payment session reused: %s", session_id)
            return payment_error("Too many attempts", 429)

        if session_doc.get("successful_order_id"):
            existing_order = await db.orders.find_one({"order_id": session_doc["successful_order_id"]}, {"_id": 0})
            if existing_order:
                return {
                    "status": "success",
                    "message": "Payment submitted",
                    "order_id": existing_order["order_id"],
                    "order": existing_order,
                }

        if session_expires_at < now:
            return await reject_payment("Payment session expired")

        if not re.fullmatch(r"\d{12}", raw_utr):
            return await reject_payment("Enter valid 12-digit UTR")

        if submitted_amount != total:
            return await reject_payment("Payment amount mismatch", suspicious=True)

        existing_utr = await db.payment_utrs.find_one({"utr": raw_utr})
        if existing_utr:
            existing_amount = existing_utr.get("amount")
            duplicate_amount_mismatch = existing_amount is not None and existing_amount != submitted_amount
            await db.payment_utrs.update_one(
                {"utr": raw_utr},
                {
                    "$inc": {"duplicate_attempts": 1},
                    "$set": {
                        "updated_at": now_iso,
                        "is_suspicious": True,
                        "last_duplicate_amount": submitted_amount,
                        "last_duplicate_session_id": session_id,
                        "last_duplicate_student_auid": student_identifier,
                    }
                }
            )
            if duplicate_amount_mismatch:
                logger.warning(
                    "Suspicious duplicate UTR with different amount: utr=%s existing_amount=%s new_amount=%s",
                    raw_utr,
                    existing_amount,
                    submitted_amount,
                )
            return await reject_payment("UTR already used", suspicious=True)

        payment_status = "paid"
        priority = True
        order_is_suspicious = bool(session_doc.get("is_suspicious")) or int(session_doc.get("failed_attempts", 0)) > 1
        payment_metadata = {
            "utr": raw_utr,
            "submitted_amount": submitted_amount,
            "payment_session_id": session_id,
            "payment_session_started_at": session_started_at.isoformat(),
            "payment_session_expires_at": session_expires_at.isoformat(),
            "payment_attempts": int(session_doc.get("attempts", 0)) + 1,
            "payment_failed_attempts": int(session_doc.get("failed_attempts", 0)),
        }

        if order_is_suspicious:
            logger.warning(
                "QR payment accepted but flagged for review: session=%s student=%s canteen=%s",
                session_id,
                student_identifier,
                req.canteen_id,
            )

    token_number = await get_next_token()
    pending = await db.orders.count_documents({"canteen_id": req.canteen_id, "status": {"$in": ["placed", "preparing"]}})
    est_minutes = max(5, min(30, (pending + 1) * 5))
    order_id = str(uuid.uuid4())
    order_doc = {
        "order_id": order_id, "token_number": token_number,
        "canteen_id": req.canteen_id, "canteen_name": canteen["name"],
        "student_auid": student_identifier,
        "items": validated_items,
        "total": total, "status": "placed",
        "payment_method": payment_method,
        "payment_status": payment_status,
        "priority": priority,
        "utr": payment_metadata.get("utr"),
        "estimated_time": f"{est_minutes} min",
        "is_suspicious": order_is_suspicious,
        "created_at": now_iso,
        **payment_metadata,
    }

    if payment_method == "qr":
        try:
            await db.payment_utrs.insert_one({
                "utr": payment_metadata["utr"],
                "amount": payment_metadata["submitted_amount"],
                "order_total": total,
                "order_id": order_id,
                "student_auid": student_identifier,
                "canteen_id": req.canteen_id,
                "session_id": payment_metadata["payment_session_id"],
                "is_suspicious": order_is_suspicious,
                "created_at": now_iso,
                "updated_at": now_iso,
            })
        except DuplicateKeyError:
            logger.warning("Duplicate UTR race detected for %s", payment_metadata["utr"])
            return payment_error("UTR already used")

    try:
        await db.orders.insert_one(order_doc)
    except Exception:
        if payment_method == "qr":
            await db.payment_utrs.delete_one({"order_id": order_id})
        raise

    if payment_method == "qr":
        await db.payment_sessions.update_one(
            {"session_id": payment_metadata["payment_session_id"]},
            {
                "$inc": {"attempts": 1},
                "$set": {
                    "updated_at": now_iso,
                    "last_failure_reason": None,
                    "successful_order_id": order_id,
                    "used_utr": payment_metadata["utr"],
                    "used_amount": payment_metadata["submitted_amount"],
                    "is_suspicious": order_is_suspicious or bool(session_doc.get("is_suspicious", False)),
                }
            }
        )

    order_doc.pop("_id", None)
    return {
        "status": "success",
        "message": "Payment submitted" if payment_method == "qr" else "Order placed",
        "order_id": order_id,
        "order": order_doc,
    }

@api_router.get("/orders/my")
async def get_my_orders(request: Request):
    payload = await get_current_user(request)
    if payload["role"] != "student":
        raise HTTPException(403, "Forbidden")
    student_identifier = payload.get("auid") or payload.get("phone") or payload.get("sub")
    if not student_identifier:
        raise HTTPException(400, "No student identifier found")
    return await db.orders.find({"student_auid": student_identifier}, {"_id": 0}).sort("created_at", -1).to_list(50)

@api_router.get("/orders/{order_id}")
async def get_order(order_id: str, request: Request):
    payload = await get_current_user(request)
    order = await db.orders.find_one({"order_id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(404, "Order not found")
    if payload["role"] == "student":
        student_identifier = payload.get("auid") or payload.get("phone") or payload.get("sub")
        if not student_identifier or order.get("student_auid") != student_identifier:
            raise HTTPException(403, "Forbidden")
    elif payload["role"] == "canteen_staff":
        if order.get("canteen_id") != payload.get("canteen_id"):
            raise HTTPException(403, "Forbidden")
    elif payload["role"] != "admin":
        raise HTTPException(403, "Forbidden")
    return order

# ── Canteen Staff Routes ──

@api_router.get("/staff/orders")
async def get_canteen_orders(request: Request):
    payload = await get_current_user(request)
    if payload["role"] != "canteen_staff":
        raise HTTPException(403, "Forbidden")
    # Sort by priority (paid first), then by created_at
    orders = await db.orders.find({"canteen_id": payload["canteen_id"]}, {"_id": 0}).to_list(200)
    return sorted(orders, key=lambda x: (not x.get("priority", False), x.get("created_at", "")))

@api_router.patch("/staff/orders/{order_id}/status")
async def update_order_status(order_id: str, req: StatusUpdateReq, request: Request):
    payload = await get_current_user(request)
    if payload["role"] != "canteen_staff":
        raise HTTPException(403, "Forbidden")
    order = await db.orders.find_one({"order_id": order_id})
    if not order:
        raise HTTPException(404, "Order not found")
    if order["canteen_id"] != payload["canteen_id"]:
        raise HTTPException(403, "Not your canteen's order")
    valid = {"placed": "preparing", "preparing": "ready"}
    if order["status"] not in valid or valid[order["status"]] != req.status:
        raise HTTPException(400, f"Invalid transition: {order['status']} -> {req.status}")
    await db.orders.update_one({"order_id": order_id}, {"$set": {"status": req.status, "updated_at": datetime.now(timezone.utc).isoformat()}})
    updated = await db.orders.find_one({"order_id": order_id}, {"_id": 0})
    # Push real-time notification to student
    student_id = order.get("student_auid", "")
    if student_id:
        msg = f"Your order #{order['token_number']} is now being prepared!" if req.status == "preparing" else f"Your order #{order['token_number']} is ready! Collect from {order.get('canteen_name', 'counter')}."
        await publish_notification(student_id, {
            "type": "order_status",
            "order_id": order_id,
            "token_number": order["token_number"],
            "status": req.status,
            "canteen_name": order.get("canteen_name", ""),
            "message": msg
        })
        # Send Web Push notification (works even when app is closed)
        push_title = "Order Being Prepared" if req.status == "preparing" else "Order Ready!"
        push_body = msg
        await send_push_notification(student_id, {
            "title": push_title,
            "body": push_body,
            "tag": f"order-{order_id}",
            "status": req.status,
            "order_id": order_id,
            "url": "/"
        })
    return updated

@api_router.get("/staff/menu-items")
async def get_staff_menu_items(request: Request):
    payload = await get_current_user(request)
    if payload["role"] != "canteen_staff":
        raise HTTPException(403, "Forbidden")
    return await db.menu_items.find({"canteen_id": payload["canteen_id"]}, {"_id": 0}).to_list(100)

@api_router.patch("/staff/menu-items/{item_id}/availability")
async def toggle_item_availability(item_id: str, request: Request):
    payload = await get_current_user(request)
    if payload["role"] != "canteen_staff":
        raise HTTPException(403, "Forbidden")
    item = await db.menu_items.find_one({"item_id": item_id, "canteen_id": payload["canteen_id"]})
    if not item:
        raise HTTPException(404, "Item not found or not yours")
    new_status = not item.get("available", True)
    await db.menu_items.update_one({"item_id": item_id}, {"$set": {"available": new_status}})
    return {"item_id": item_id, "available": new_status}

@api_router.patch("/staff/menu-items/{item_id}/category")
async def update_item_category(item_id: str, category: str, request: Request):
    payload = await get_current_user(request)
    if payload["role"] != "canteen_staff":
        raise HTTPException(403, "Forbidden")
    item = await db.menu_items.find_one({"item_id": item_id, "canteen_id": payload["canteen_id"]})
    if not item:
        raise HTTPException(404, "Item not found or not yours")
    await db.menu_items.update_one({"item_id": item_id}, {"$set": {"category": category}})
    return {"item_id": item_id, "category": category}

# ── SSE Notification Stream ──

@api_router.get("/notifications/stream")
async def notification_stream(request: Request, token: str = ""):
    if not token:
        raise HTTPException(401, "Token required")
    try:
        payload = pyjwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except pyjwt.InvalidTokenError:
        raise HTTPException(401, "Invalid token")
    student_id = payload.get("auid") or payload.get("phone") or payload.get("sub")
    if not student_id:
        raise HTTPException(400, "No student identifier")

    queue = subscribe(student_id)

    async def event_generator():
        import json
        try:
            yield f"data: {json.dumps({'type': 'connected', 'message': 'Notifications active'})}\n\n"
            while True:
                if await request.is_disconnected():
                    break
                try:
                    event = await asyncio.wait_for(queue.get(), timeout=30)
                    yield f"data: {json.dumps(event)}\n\n"
                except asyncio.TimeoutError:
                    yield f": keepalive\n\n"
        finally:
            unsubscribe(student_id, queue)

    return StreamingResponse(event_generator(), media_type="text/event-stream", headers={
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",
    })

# ── Push Notification Routes ──

@api_router.get("/push/vapid-key")
async def get_vapid_key():
    return {"public_key": VAPID_PUBLIC_KEY}

@api_router.post("/push/subscribe")
async def push_subscribe(req: PushSubscriptionReq, request: Request):
    payload = await get_current_user(request)
    student_id = payload.get("auid") or payload.get("phone") or payload.get("sub")
    if not student_id:
        raise HTTPException(400, "No student identifier")

    endpoint = req.subscription.get("endpoint", "")
    if not endpoint:
        raise HTTPException(400, "Invalid subscription: missing endpoint")

    existing = await db.push_subscriptions.find_one({
        "student_id": student_id,
        "subscription.endpoint": endpoint
    })
    if existing:
        return {"status": "already_subscribed"}

    await db.push_subscriptions.insert_one({
        "student_id": student_id,
        "subscription": req.subscription,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    return {"status": "subscribed"}

@api_router.post("/push/unsubscribe")
async def push_unsubscribe(req: PushSubscriptionReq, request: Request):
    payload = await get_current_user(request)
    student_id = payload.get("auid") or payload.get("phone") or payload.get("sub")
    if not student_id:
        raise HTTPException(400, "No student identifier")

    endpoint = req.subscription.get("endpoint", "")
    result = await db.push_subscriptions.delete_many({
        "student_id": student_id,
        "subscription.endpoint": endpoint
    })
    return {"status": "unsubscribed", "count": result.deleted_count}

# ── Admin Routes ──

@api_router.get("/admin/stats")
async def get_admin_stats(request: Request):
    payload = await get_current_user(request)
    if payload["role"] != "admin":
        raise HTTPException(403, "Forbidden")
    total_orders = await db.orders.count_documents({})
    active_orders = await db.orders.count_documents({"status": {"$in": ["placed", "preparing"]}})
    completed = await db.orders.count_documents({"status": "ready"})
    pipeline = [{"$group": {"_id": None, "total": {"$sum": "$total"}}}]
    rev = await db.orders.aggregate(pipeline).to_list(1)
    revenue = rev[0]["total"] if rev else 0
    cs_pipeline = [{"$group": {"_id": "$canteen_id", "orders": {"$sum": 1}, "revenue": {"$sum": "$total"}, "canteen_name": {"$first": "$canteen_name"}}}]
    cs = await db.orders.aggregate(cs_pipeline).to_list(10)
    return {
        "total_orders": total_orders, "active_orders": active_orders,
        "completed": completed, "revenue": revenue,
        "canteen_stats": [{"name": c.get("canteen_name", c["_id"]), "canteen_id": c["_id"], "orders": c["orders"], "revenue": c["revenue"]} for c in cs]
    }

@api_router.get("/admin/canteens")
async def admin_get_canteens(request: Request):
    payload = await get_current_user(request)
    if payload["role"] != "admin":
        raise HTTPException(403, "Forbidden")
    return await db.canteens.find({}, {"_id": 0}).to_list(100)

@api_router.post("/admin/canteens")
async def admin_create_canteen(req: CreateCanteenReq, request: Request):
    payload = await get_current_user(request)
    if payload["role"] != "admin":
        raise HTTPException(403, "Forbidden")
    if await db.canteens.find_one({"canteen_id": req.canteen_id}):
        raise HTTPException(400, "Canteen ID already exists")
    doc = {**req.model_dump(), "status": "active"}
    await db.canteens.insert_one(doc)
    doc.pop("_id", None)
    return doc

@api_router.put("/admin/canteens/{canteen_id}")
async def admin_update_canteen(canteen_id: str, req: UpdateCanteenReq, request: Request):
    payload = await get_current_user(request)
    if payload["role"] != "admin":
        raise HTTPException(403, "Forbidden")
    update = {k: v for k, v in req.model_dump().items() if v is not None}
    if not update:
        raise HTTPException(400, "Nothing to update")
    result = await db.canteens.update_one({"canteen_id": canteen_id}, {"$set": update})
    if result.matched_count == 0:
        raise HTTPException(404, "Canteen not found")
    return await db.canteens.find_one({"canteen_id": canteen_id}, {"_id": 0})

@api_router.patch("/admin/canteens/{canteen_id}/qr")
async def admin_upload_qr(canteen_id: str, req: UploadQRReq, request: Request):
    payload = await get_current_user(request)
    if payload["role"] != "admin":
        raise HTTPException(403, "Forbidden - Only super admin can manage QR codes")
    result = await db.canteens.update_one(
        {"canteen_id": canteen_id}, 
        {"$set": {"qr_code": req.qr_code}}
    )
    if result.matched_count == 0:
        raise HTTPException(404, "Canteen not found")
    return {"canteen_id": canteen_id, "qr_code": req.qr_code}

@api_router.post("/admin/canteens/{canteen_id}/qr/upload")
async def admin_upload_qr_image(canteen_id: str, request: Request, file: UploadFile = File(...)):
    payload = await get_current_user(request)
    if payload["role"] != "admin":
        raise HTTPException(403, "Forbidden - Only super admin can manage QR codes")

    canteen = await db.canteens.find_one({"canteen_id": canteen_id}, {"_id": 0})
    if not canteen:
        raise HTTPException(404, "Canteen not found")

    suffix = Path(file.filename or "").suffix.lower()
    if suffix not in {".png", ".jpg", ".jpeg"}:
        raise HTTPException(400, "Only PNG and JPG images are allowed")

    stored_name = f"{canteen_id}-{uuid.uuid4().hex}{suffix}"
    file_path = UPLOADS_DIR / stored_name
    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(400, "QR image file is empty")

    with open(file_path, "wb") as output_file:
        output_file.write(file_bytes)

    qr_url = build_public_file_url(request, stored_name)
    await db.canteens.update_one(
        {"canteen_id": canteen_id},
        {"$set": {"qr_code": qr_url}}
    )
    return {"canteen_id": canteen_id, "qr_code": qr_url}

@api_router.patch("/admin/canteens/{canteen_id}/toggle-qr")
async def admin_toggle_qr(canteen_id: str, enabled: bool, request: Request):
    payload = await get_current_user(request)
    if payload["role"] != "admin":
        raise HTTPException(403, "Forbidden")
    result = await db.canteens.update_one(
        {"canteen_id": canteen_id}, 
        {"$set": {"qr_enabled": enabled}}
    )
    if result.matched_count == 0:
        raise HTTPException(404, "Canteen not found")
    return {"canteen_id": canteen_id, "qr_enabled": enabled}

@api_router.get("/admin/menu-items")
async def admin_get_menu_items(request: Request):
    payload = await get_current_user(request)
    if payload["role"] != "admin":
        raise HTTPException(403, "Forbidden")
    return await db.menu_items.find({}, {"_id": 0}).to_list(200)

@api_router.post("/admin/menu-items")
@api_router.post("/admin/add-item")
async def admin_create_menu_item(
    request: Request,
    item_id: str = Form(...),
    canteen_id: str = Form(...),
    name: str = Form(...),
    price: float = Form(...),
    category: str = Form("general"),
    veg: bool = Form(True),
    image: UploadFile = File(...),
):
    payload = await get_current_user(request)
    if payload["role"] != "admin":
        raise HTTPException(403, "Forbidden")
    if await db.menu_items.find_one({"item_id": item_id}):
        raise HTTPException(400, "Item ID already exists")
    file_name = Path(image.filename or "upload.png").name
    file_path = UPLOADS_DIR / file_name
    file_bytes = await image.read()
    if not file_bytes:
        raise HTTPException(400, "Image file is empty")

    with open(file_path, "wb") as f:
        f.write(file_bytes)

    image_url = f"/uploads/{file_name}"
    doc = {
        "item_id": item_id,
        "canteen_id": canteen_id,
        "name": name,
        "price": price,
        "image": image_url,
        "image_url": image_url,
        "category": category,
        "veg": veg,
        "available": True,
    }
    await db.menu_items.insert_one(doc)
    doc.pop("_id", None)
    return doc

@api_router.put("/admin/menu-items/{item_id}")
async def admin_update_menu_item(item_id: str, req: UpdateMenuItemReq, request: Request):
    payload = await get_current_user(request)
    if payload["role"] != "admin":
        raise HTTPException(403, "Forbidden")
    update = {k: v for k, v in req.model_dump().items() if v is not None}
    if not update:
        raise HTTPException(400, "Nothing to update")
    result = await db.menu_items.update_one({"item_id": item_id}, {"$set": update})
    if result.matched_count == 0:
        raise HTTPException(404, "Item not found")
    return await db.menu_items.find_one({"item_id": item_id}, {"_id": 0})

@api_router.delete("/admin/menu-items/{item_id}")
async def admin_delete_menu_item(item_id: str, request: Request):
    payload = await get_current_user(request)
    if payload["role"] != "admin":
        raise HTTPException(403, "Forbidden")
    result = await db.menu_items.delete_one({"item_id": item_id})
    if result.deleted_count == 0:
        raise HTTPException(404, "Item not found")
    return {"message": "Deleted"}

@api_router.patch("/admin/orders/{order_id}/payment-override")
async def admin_payment_override(order_id: str, mark_unpaid: bool, request: Request):
    payload = await get_current_user(request)
    if payload["role"] != "admin":
        raise HTTPException(403, "Forbidden - Only super admin")
    order = await db.orders.find_one({"order_id": order_id})
    if not order:
        raise HTTPException(404, "Order not found")
    if mark_unpaid:
        await db.orders.update_one(
            {"order_id": order_id}, 
            {"$set": {"payment_status": "unpaid", "priority": False}}
        )
        return {"order_id": order_id, "payment_status": "unpaid"}
    else:
        await db.orders.update_one(
            {"order_id": order_id}, 
            {"$set": {"payment_status": "paid", "priority": True}}
        )
        return {"order_id": order_id, "payment_status": "paid"}

@api_router.get("/admin/staff")
async def admin_get_staff(request: Request):
    payload = await get_current_user(request)
    if payload["role"] != "admin":
        raise HTTPException(403, "Forbidden")
    staff_list = []
    async for s in db.users.find({"role": "canteen_staff"}, {"password_hash": 0}):
        s["id"] = str(s.pop("_id"))
        staff_list.append(s)
    return staff_list

@api_router.post("/admin/staff")
async def admin_create_staff(req: CreateStaffReq, request: Request):
    payload = await get_current_user(request)
    if payload["role"] != "admin":
        raise HTTPException(403, "Forbidden")
    if await db.users.find_one({"email": req.email.lower()}):
        raise HTTPException(400, "Email already exists")
    doc = {
        "email": req.email.lower(), "password_hash": hash_password(req.password),
        "name": req.name, "role": "canteen_staff", "canteen_id": req.canteen_id,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    result = await db.users.insert_one(doc)
    return {"id": str(result.inserted_id), "email": doc["email"], "name": doc["name"], "role": "canteen_staff", "canteen_id": doc["canteen_id"]}

@api_router.delete("/admin/staff/{staff_id}")
async def admin_delete_staff(staff_id: str, request: Request):
    payload = await get_current_user(request)
    if payload["role"] != "admin":
        raise HTTPException(403, "Forbidden")
    try:
        staff_object_id = ObjectId(staff_id)
    except InvalidId:
        raise HTTPException(400, "Invalid staff ID")
    result = await db.users.delete_one({"_id": staff_object_id, "role": "canteen_staff"})
    if result.deleted_count == 0:
        raise HTTPException(404, "Staff not found")
    return {"message": "Deleted"}

# ── Setup ──

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup():
    await seed_data()
    logger.info("CampusBite API ready")

@app.on_event("shutdown")
async def shutdown():
    client.close()
