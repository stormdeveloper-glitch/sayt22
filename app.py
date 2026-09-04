"""
Teacher_texno platformasi uchun Flask backend.

Asosiy takomillashtirishlar (eski koddan farqi):
  - Xavfsiz fayl yuklash: extension whitelist, hajm chegarasi, secure_filename
  - data.json ga yozishda race condition oldini olish uchun threading.Lock
  - print() o'rniga standart logging moduli
  - Barcha sozlamalar Config klassida markazlashtirilgan
  - Global xato handlerlar (400/404/413/500)
  - Type hints va aniqroq docstringlar
"""

import json
import logging
import os
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
from collections import defaultdict, deque
from pathlib import Path
# DB utilities
from data_database import (
    get_all_data,
    get_storage_health,
    init_data_db,
    migrate_json_to_db,
    save_data_dict,
)
from typing import Any, Optional

from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
from werkzeug.exceptions import HTTPException
from werkzeug.utils import secure_filename

# --------------------------------------------------------------------------
# Logging
# --------------------------------------------------------------------------
logging.basicConfig(
    level=os.environ.get("LOG_LEVEL", "INFO"),
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("teacher_texno")


def load_env_file() -> None:
    """Load local .env values when running outside managed hosting."""
    env_file = Path(__file__).resolve().parent / ".env"
    if not env_file.is_file():
        return
    with env_file.open("r", encoding="utf-8") as fh:
        for raw in fh:
            line = raw.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


load_env_file()


# --------------------------------------------------------------------------
# Konfiguratsiya
# --------------------------------------------------------------------------
class Config:
    BASE_DIR = Path(__file__).resolve().parent
    DEFAULT_DATA_DIR = Path("/app/data") if Path("/app").is_dir() else BASE_DIR / "data"
    DATA_DIR = Path(os.environ.get("DATA_DIR", str(DEFAULT_DATA_DIR)))
    DATA_FILE = DATA_DIR / "data.json"

    UPLOAD_DIR = BASE_DIR / "uploads"
    ALLOWED_UPLOAD_EXTENSIONS = {"png", "jpg", "jpeg", "gif", "webp", "pdf"}
    ALLOWED_IMPORT_EXTENSIONS = {"json"}
    MAX_UPLOAD_SIZE = 10 * 1024 * 1024  # 10 MB
    MAX_JSON_IMPORT_SIZE = 5 * 1024 * 1024  # 5 MB
    MAX_JSON_PAYLOAD_SIZE = 5 * 1024 * 1024  # 5 MB
    RATE_LIMIT_WINDOW_SEC = int(os.environ.get("RATE_LIMIT_WINDOW_SEC", 60))
    RATE_LIMIT_API = int(os.environ.get("RATE_LIMIT_API", 180))
    RATE_LIMIT_WRITE = int(os.environ.get("RATE_LIMIT_WRITE", 45))
    RATE_LIMIT_AUTH = int(os.environ.get("RATE_LIMIT_AUTH", 20))
    RATE_LIMIT_UPLOAD = int(os.environ.get("RATE_LIMIT_UPLOAD", 12))
    RATE_LIMIT_ADMIN_IMPORT = int(os.environ.get("RATE_LIMIT_ADMIN_IMPORT", 6))

    OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "").strip()
    OPENAI_MODEL = os.environ.get("OPENAI_MODEL", "gpt-4o-mini")

    BOT_TOKEN = os.environ.get("BOT_TOKEN", "").strip()
    RUN_TELEGRAM_BOT = os.environ.get("RUN_TELEGRAM_BOT", "1").strip() not in {"0", "false", "False", "no", "NO"}

    SMS_GATEWAY_URL = os.environ.get("SMS_GATEWAY_URL")
    SMS_GATEWAY_API_KEY = os.environ.get("SMS_GATEWAY_API_KEY")

    _raw_origins = os.environ.get("CORS_ORIGINS", "").strip()
    if _raw_origins:
        CORS_ORIGINS = [o.strip() for o in _raw_origins.split(",") if o.strip()]
        CORS_ALLOW_ALL = False
    else:
        CORS_ORIGINS = "*"
        CORS_ALLOW_ALL = True

    PORT = int(os.environ.get("PORT", 8080))


Config.UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

# data.json ga bir vaqtda bir nechta so'rov yozishining oldini olish uchun.
_data_lock = threading.Lock()
_rate_limit_lock = threading.Lock()
_rate_limit_buckets: dict[str, deque[float]] = defaultdict(deque)

STUDENT_DEFAULTS = {
    "Bahodirjonov Sardor": {"group": "D2", "coins": 100},
    "Bahodirov Asadbek": {"group": "D1", "coins": 0},
    "Farangiz": {"group": "D1", "coins": 25},
    "Farxodjon 08": {"group": "D1", "coins": 0},
    "Ibrohim": {"group": "D1", "coins": 65},
    "Muhiddinov Nurillo": {"group": "D1", "coins": 0},
    "Dadajonova Munavvara": {"group": "D1", "coins": 15},
    "Og'abek": {"group": "D1", "coins": 0},
    "Omonov Alisher": {"group": "D1", "coins": 50},
    "Shavkatova Fotima": {"group": "D1", "coins": 50},
    "Shaxboz": {"group": "D1", "coins": 25},
    "Tojaliyev G'ayratjon": {"group": "D1", "coins": 0},
    "Tolipjonov Asadbek": {"group": "D1", "coins": 26},
    "Tursunaliyev Abdulaziz": {"group": "D1", "coins": 5},
    "Umaraliyev Ozodbek": {"group": "D1", "coins": 50},
    "Abdurazoqova Ra'noxon": {"group": "D1", "coins": 15},
    "Abdulhakimov Sardorbek": {"group": "D1", "coins": 35},
    "Ahmadjonova Shodiyona": {"group": "D1", "coins": 45},
    "Hamidov Abdulahat": {"group": "D1", "coins": 24},
    "Abdumo'minov Muhammadmuhtor": {"group": "D1", "coins": 10},
    "Hoshimov Abdulhafiz": {"group": "D1", "coins": 0},
    "Hasanboyev Muhamqodir": {"group": "D1", "coins": 5},
    "Nurmuhamadov Diyorbek": {"group": "D1", "coins": 10},
    "Mahamadov Ozodbek": {"group": "D1", "coins": 5},
    "Shavkatov Abdulatif": {"group": "D1", "coins": 5},
}

app = Flask(__name__, static_folder=str(Config.BASE_DIR), static_url_path="")
app.config["MAX_CONTENT_LENGTH"] = Config.MAX_UPLOAD_SIZE
if Config.CORS_ALLOW_ALL:
    CORS(app, resources={r"/*": {"origins": "*"}})
else:
    CORS(app, resources={r"/*": {"origins": Config.CORS_ORIGINS}})


# --------------------------------------------------------------------------
# Yordamchi funksiyalar
# --------------------------------------------------------------------------
def n_int(value: Any, default: int = 0) -> int:
    """Convert value to int safely."""
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def coins_total(value: Any) -> int:
    """Calculate total coins from dict or int."""
    if isinstance(value, dict):
        return sum(n_int(v) for v in value.values())
    return n_int(value)


def normalize_data(data: Any) -> tuple[dict, bool]:
    """Ensure data structure exists and add missing defaults for students."""
    if not isinstance(data, dict):
        data = {}

    defaults = {
        "students": [], "transactions": [], "nextStudentId": 1,
        "teachers": [], "nextTeacherId": 1,
        "admins": [], "nextAdminId": 1,
        "adminRequests": [], "nextRequestId": 1,
        "messages": [], "groups": [],
        "chatFriends": [], "chatGroups": [],
        "pendingReqs": [], "pendingTelegramLinks": [],
        "tests": [], "plans": [], "submissions": [],
        "telegramProfiles": {},
        "settings": {},
        "currencyExchanges": [], "nextExchangeId": 1,
        # New student fields defaults
        "studentDefaults": {
            "firstName": "",
            "lastName": "",
            "phone": "",
            "age": 0,
            "class": "",
            "school": "",
            "typing": [],
            "bestWpm": 0,
            "bestAccuracy": 0,
            "completedLessons": [],
            "typingProgress": 0.0
        }
    }
    changed = False
    for key, default_value in defaults.items():
        if key not in data:
            data[key] = default_value
            changed = True

    for student in data.get("students", []):
        if not isinstance(student, dict):
            continue

        default = STUDENT_DEFAULTS.get(str(student.get("name", "")).strip())
        current_group = str(student.get("group") or "").strip()
        if default and (
            not current_group
            or current_group == "Yangi"
            or (current_group == "D1" and default["group"] != "D1")
        ):
            student["group"] = default["group"]
            changed = True
        elif not current_group:
            student["group"] = "D1"
            changed = True

        teacher_ids_raw = student.get("teacherIds")
        teacher_id = n_int(
            teacher_ids_raw[0] if isinstance(teacher_ids_raw, list) and teacher_ids_raw
            else student.get("teacherId"),
            default=1,
        )
        if not student.get("teacherId"):
            student["teacherId"] = teacher_id
            changed = True
        if not isinstance(student.get("teacherIds"), list) or not student.get("teacherIds"):
            student["teacherIds"] = [teacher_id]
            changed = True

        current_total = n_int(student.get("totalCoins")) or coins_total(student.get("coins"))
        if current_total == 0 and default and default["coins"] > 0:
            current_total = default["coins"]
            student["totalCoins"] = current_total
            student["coins"] = {str(teacher_id): current_total}
            changed = True
        elif isinstance(student.get("coins"), dict):
            student["totalCoins"] = current_total
        else:
            student["totalCoins"] = current_total
            student["coins"] = {str(teacher_id): current_total}
            changed = True

        if not isinstance(student.get("olmos"), int):
            student["olmos"] = n_int(student.get("olmos"))
            changed = True

        coins = n_int(student.get("totalCoins"))
        student["level"] = max(1, int(coins / 100) + 1)
        if coins < 100:
            student["badge"] = "Starter"
        elif coins < 300:
            student["badge"] = "Active"
        elif coins < 600:
            student["badge"] = "Pro"
        else:
            student["badge"] = "Elite"

    return data, changed


def client_ip() -> str:
    forwarded_for = request.headers.get("X-Forwarded-For", "")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()[:64]
    return (request.remote_addr or "unknown")[:64]


def is_rate_limited(scope: str, limit: int, window_seconds: int) -> bool:
    now = time.time()
    bucket_key = f"{scope}:{client_ip()}"
    with _rate_limit_lock:
        bucket = _rate_limit_buckets[bucket_key]
        while bucket and now - bucket[0] > window_seconds:
            bucket.popleft()
        if len(bucket) >= limit:
            return True
        bucket.append(now)
        return False


def validate_dataset_payload(data: Any) -> tuple[bool, str]:
    if not isinstance(data, dict):
        return False, "JSON obyekt yuboring"

    expected_lists = (
        "students",
        "teachers",
        "admins",
        "transactions",
        "groups",
        "messages",
        "adminRequests",
        "chatFriends",
        "chatGroups",
        "pendingReqs",
        "pendingTelegramLinks",
        "tests",
        "plans",
        "submissions",
        "currencyExchanges",
    )
    for key in expected_lists:
        if key in data and not isinstance(data[key], list):
            return False, f"`{key}` massiv bo'lishi kerak"

    expected_objects = ("settings", "telegramProfiles", "studentDefaults")
    for key in expected_objects:
        if key in data and not isinstance(data[key], dict):
            return False, f"`{key}` obyekt bo'lishi kerak"

    if len(json.dumps(data, ensure_ascii=False)) > Config.MAX_JSON_PAYLOAD_SIZE:
        return False, "JSON hajmi juda katta"

    return True, ""


def summarize_dataset(data: dict) -> dict:
    return {
        "students": len(data.get("students", [])),
        "teachers": len(data.get("teachers", [])),
        "admins": len(data.get("admins", [])),
        "groups": len(data.get("groups", [])),
        "messages": len(data.get("messages", [])),
    }


def chat_state_payload(data: dict) -> dict:
    return {
        "messages": data.get("messages", []) if isinstance(data.get("messages"), list) else [],
        "chatFriends": data.get("chatFriends", []) if isinstance(data.get("chatFriends"), list) else [],
        "chatGroups": data.get("chatGroups", []) if isinstance(data.get("chatGroups"), list) else [],
        "pendingReqs": data.get("pendingReqs", []) if isinstance(data.get("pendingReqs"), list) else [],
    }


def validate_chat_payload(data: Any) -> tuple[bool, str]:
    if not isinstance(data, dict):
        return False, "JSON obyekt yuboring"
    for key in ("messages", "chatFriends", "chatGroups", "pendingReqs"):
        if key in data and not isinstance(data[key], list):
            return False, f"`{key}` massiv bo'lishi kerak"
    if len(json.dumps(data, ensure_ascii=False)) > (3 * 1024 * 1024):
        return False, "Chat payload juda katta"
    return True, ""


def detect_upload_type(filename: str, head: bytes) -> bool:
    ext = filename.rsplit(".", 1)[1].lower()
    if ext == "pdf":
        return head.startswith(b"%PDF-")
    if ext in {"png"}:
        return head.startswith(b"\x89PNG\r\n\x1a\n")
    if ext in {"jpg", "jpeg"}:
        return head.startswith(b"\xff\xd8\xff")
    if ext == "gif":
        return head.startswith((b"GIF87a", b"GIF89a"))
    if ext == "webp":
        return len(head) >= 12 and head[:4] == b"RIFF" and head[8:12] == b"WEBP"
    if ext == "json":
        stripped = head.lstrip(b"\xef\xbb\xbf\r\n\t ")
        return stripped.startswith(b"{") or stripped.startswith(b"[")
    return False


def require_admin(data: dict, admin_id: Any) -> Optional[dict]:
    admin = find_account(data, "admin", n_int(admin_id))
    if not admin:
        return None
    return admin


def init_data_file() -> None:
    """Initialize databases and migrate legacy JSON if it exists."""
    init_data_db()
    migrate_json_to_db(Config.DATA_FILE)


def read_data() -> dict:
    """Fetch and normalize the complete dataset from storage."""
    data = get_all_data()
    data, changed = normalize_data(data)
    if changed:
        save_data_dict("app_data", data)
    return data


def write_data(data: dict) -> dict[str, bool]:
    """Persist the dataset to all configured storages."""
    return save_data_dict("app_data", data)


def find_account(data: dict, role: str, account_id: int) -> Optional[dict]:
    collection = {"student": "students", "teacher": "teachers", "admin": "admins"}.get(role)
    if not collection:
        return None
    aid = n_int(account_id)
    return next((item for item in data.get(collection, []) if n_int(item.get("id")) == aid), None)


# --------------------------------------------------------------------------
# Tanga <-> Olmos valyuta almashinuvi
#
# Kurslar ATAYLAB bir-biriga teskari EMAS (spred bilan):
#   Tanga -> Olmos: 1 Tanga = COIN_TO_DIAMOND_RATE (standart 10) Olmos
#   Olmos -> Tanga: DIAMOND_TO_COIN_RATE (standart 15) Olmos = 1 Tanga
# Bu ikkala qiymat admin panelidan sozlanishi mumkin, lekin standart holatda
# talabnomadagi 10 / 15 qiymatlari ishlatiladi.
# --------------------------------------------------------------------------
DEFAULT_COIN_TO_DIAMOND_RATE = 10
DEFAULT_DIAMOND_TO_COIN_RATE = 15


def get_exchange_rates(data: dict) -> tuple[int, int]:
    """Joriy Tanga->Olmos va Olmos->Tanga kurslarini qaytaradi (har doim >=1)."""
    settings = data.get("settings")
    if not isinstance(settings, dict):
        settings = {}
    c2d = n_int(settings.get("coinToDiamondRate"), DEFAULT_COIN_TO_DIAMOND_RATE) or DEFAULT_COIN_TO_DIAMOND_RATE
    d2c = n_int(settings.get("diamondToCoinRate"), DEFAULT_DIAMOND_TO_COIN_RATE) or DEFAULT_DIAMOND_TO_COIN_RATE
    return max(1, c2d), max(1, d2c)


def student_wallet_state(student: dict, data: dict) -> dict:
    """Talabaning market/valyuta uchun ochiq holatini (state) shakllantiradi."""
    c2d, d2c = get_exchange_rates(data)
    return {
        "coins": n_int(student.get("totalCoins")),
        "diamonds": n_int(student.get("olmos")),
        "mktOwned": student.get("mktOwned") if isinstance(student.get("mktOwned"), list) else [],
        "purchasedProducts": student.get("purchasedProducts") if isinstance(student.get("purchasedProducts"), list) else [],
        "equippedAvatar": student.get("equippedAvatar"),
        "equippedBadge": student.get("equippedBadge"),
        "coinToDiamondRate": c2d,
        "diamondToCoinRate": d2c,
        # Eskilik bilan moslik uchun (frontendning eski kodi shu maydonni o'qishi mumkin)
        "exchangeRate": d2c,
    }


def send_bot_message(chat_id: Any, text: str, reply_markup: Optional[dict] = None) -> tuple[bool, str]:
    if not Config.BOT_TOKEN:
        return False, "BOT_TOKEN sozlanmagan"

    payload = {"chat_id": str(chat_id), "text": text, "parse_mode": "HTML"}
    if reply_markup:
        payload["reply_markup"] = json.dumps(reply_markup, ensure_ascii=False)

    body = urllib.parse.urlencode(payload).encode("utf-8")
    url = f"https://api.telegram.org/bot{Config.BOT_TOKEN}/sendMessage"
    try:
        req = urllib.request.Request(url, data=body, method="POST")
        with urllib.request.urlopen(req, timeout=15) as res:
            return 200 <= res.getcode() < 300, ""
    except urllib.error.HTTPError as e:
        return False, e.read().decode("utf-8", errors="ignore") or str(e)
    except Exception as e:  # noqa: BLE001
        return False, str(e)


def allowed_upload_file(filename: str) -> bool:
    if "." not in filename:
        return False
    ext = filename.rsplit(".", 1)[1].lower()
    return ext in Config.ALLOWED_UPLOAD_EXTENSIONS


def start_telegram_bot() -> None:
    """BOT_TOKEN mavjud bo'lsa, Telegram botni fon rejimida ishga tushiradi."""
    if not Config.RUN_TELEGRAM_BOT:
        logger.info("RUN_TELEGRAM_BOT o'chirilgan, Telegram bot ishga tushmadi")
        return
    if not Config.BOT_TOKEN:
        logger.info("BOT_TOKEN topilmadi, Telegram bot ishga tushmadi")
        return
    try:
        from bot.main import start_bot_thread

        start_bot_thread()
        logger.info("Telegram bot background thread ishga tushdi")
    except Exception:
        logger.exception("Telegram botni ishga tushirishda xato")


@app.before_request
def enforce_request_limits():
    if not request.path.startswith("/api/"):
        return None

    if request.path == "/health":
        return None

    scope = "api"
    limit = Config.RATE_LIMIT_API

    if request.path.startswith("/api/auth"):
        scope = "auth"
        limit = Config.RATE_LIMIT_AUTH
    elif request.path == "/api/upload":
        scope = "upload"
        limit = Config.RATE_LIMIT_UPLOAD
    elif request.path == "/api/admin/import-json":
        scope = "admin-import"
        limit = Config.RATE_LIMIT_ADMIN_IMPORT
    elif request.method in {"POST", "PUT", "PATCH", "DELETE"}:
        scope = "write"
        limit = Config.RATE_LIMIT_WRITE

    if is_rate_limited(scope, limit, Config.RATE_LIMIT_WINDOW_SEC):
        return jsonify({
            "status": "error",
            "message": "Juda ko'p so'rov yuborildi. Birozdan keyin qayta urinib ko'ring.",
        }), 429
    return None


@app.after_request
def apply_security_headers(response):
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "SAMEORIGIN"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    response.headers["Cross-Origin-Resource-Policy"] = "same-origin"
    response.headers["Content-Security-Policy"] = (
        "default-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob: https:; "
        "img-src 'self' data: blob: https:; "
        "media-src 'self' blob: data: https:; "
        "connect-src 'self' https://api.openai.com https://api.telegram.org;"
    )
    return response


# --------------------------------------------------------------------------
# Global xato handlerlar
# --------------------------------------------------------------------------
@app.errorhandler(413)
def handle_too_large(_e: HTTPException):
    return jsonify({"status": "error", "message": "Fayl hajmi juda katta"}), 413


@app.errorhandler(404)
def handle_not_found(_e: HTTPException):
    if request.path.startswith("/api/"):
        return jsonify({"status": "error", "message": "Endpoint topilmadi"}), 404
    return send_from_directory(str(Config.BASE_DIR), "index.html")


@app.errorhandler(Exception)
def handle_unexpected_error(e: Exception):
    if isinstance(e, HTTPException):
        return e
    logger.exception("Kutilmagan xato")
    return jsonify({"status": "error", "message": "Ichki server xatosi"}), 500


# --------------------------------------------------------------------------
# Routelar
# --------------------------------------------------------------------------
@app.route("/")
def index():
    return send_from_directory(".", "index.html")


@app.route("/health", methods=["GET"])
def health():
    storage = get_storage_health()
    ok = storage.get("sqlite") or storage.get("postgres")
    return jsonify({
        "status": "ok" if ok else "degraded",
        "storage": storage,
    }), 200 if ok else 503


@app.route("/api/data", methods=["GET"])
def get_data():
    """Bazalardan ma'lumotni o'qib beradi."""
    return jsonify(read_data())


@app.route("/api/data", methods=["POST"])
def save_data():
    """Frontend'dan kelgan ma'lumotni bazalarga saqlaydi."""
    req_data = request.get_json(silent=True)
    valid, message = validate_dataset_payload(req_data)
    if not valid:
        return jsonify({"status": "error", "message": message}), 400
    if not all(k in req_data for k in ("students", "transactions", "nextStudentId")):
        return jsonify({"status": "error", "message": "Majburiy maydonlar yetishmayapti"}), 400

    req_data, _ = normalize_data(req_data)
    storage = write_data(req_data)
    return jsonify({
        "status": "success",
        "message": "Ma'lumot saqlandi",
        "storage": storage,
    })


@app.route("/api/chat/state", methods=["GET"])
def get_chat_state():
    data = read_data()
    return jsonify({
        "status": "success",
        "chat": chat_state_payload(data),
    })


@app.route("/api/chat/state", methods=["POST"])
def save_chat_state():
    body = request.get_json(silent=True)
    valid, message = validate_chat_payload(body)
    if not valid:
        return jsonify({"status": "error", "message": message}), 400

    with _data_lock:
        data = read_data()
        data["messages"] = body.get("messages", []) if isinstance(body.get("messages"), list) else []
        data["chatFriends"] = body.get("chatFriends", []) if isinstance(body.get("chatFriends"), list) else []
        data["chatGroups"] = body.get("chatGroups", []) if isinstance(body.get("chatGroups"), list) else []
        data["pendingReqs"] = body.get("pendingReqs", []) if isinstance(body.get("pendingReqs"), list) else []
        storage = write_data(data)

    return jsonify({
        "status": "success",
        "message": "Chat saqlandi",
        "storage": storage,
    })


@app.route("/api/admin/import-json", methods=["POST"])
def import_json():
    """Admin uchun JSON import: validate -> normalize -> SQLite + PostgreSQL."""
    admin_id = n_int(request.form.get("adminId"))
    import_file = request.files.get("file")

    if not admin_id:
        return jsonify({"status": "error", "message": "Admin ID kerak"}), 400
    if not import_file or not import_file.filename:
        return jsonify({"status": "error", "message": "JSON fayl tanlanmadi"}), 400

    original_name = secure_filename(import_file.filename)
    if "." not in original_name or original_name.rsplit(".", 1)[1].lower() not in Config.ALLOWED_IMPORT_EXTENSIONS:
        return jsonify({"status": "error", "message": "Faqat .json fayl yuklash mumkin"}), 400

    raw = import_file.read(Config.MAX_JSON_IMPORT_SIZE + 1)
    if len(raw) > Config.MAX_JSON_IMPORT_SIZE:
        return jsonify({"status": "error", "message": "JSON fayl juda katta"}), 413
    if not detect_upload_type(original_name, raw[:128]):
        return jsonify({"status": "error", "message": "JSON fayl formati noto'g'ri"}), 400

    try:
        imported = json.loads(raw.decode("utf-8-sig"))
    except json.JSONDecodeError:
        return jsonify({"status": "error", "message": "JSON parse bo'lmadi"}), 400

    valid, message = validate_dataset_payload(imported)
    if not valid:
        return jsonify({"status": "error", "message": message}), 400

    with _data_lock:
        current = read_data()
        current_admin = require_admin(current, admin_id)
        imported_admin = require_admin(imported, admin_id)
        if current.get("admins") and not current_admin:
            return jsonify({"status": "error", "message": "Admin topilmadi"}), 403
        if not current.get("admins") and not imported_admin:
            return jsonify({"status": "error", "message": "Import ichida mos admin topilmadi"}), 403

        imported, _ = normalize_data(imported)
        storage = write_data(imported)

    return jsonify({
        "status": "success",
        "message": "JSON import qilindi va bazalarga yozildi",
        "summary": summarize_dataset(imported),
        "storage": storage,
        "data": imported,
    })


@app.route("/api/market/state", methods=["GET"])
def market_state():
    """Talabaning joriy tanga/olmos balansi va inventarini serverdan qaytaradi.

    Frontend hech qachon bu qiymatlarni o'zi hisoblamaydi — faqat shu yerdan
    kelgan (tasdiqlangan) holatni ko'rsatadi.
    """
    student_id = n_int(request.args.get("studentId"))
    if not student_id:
        return jsonify({"ok": False, "error": "unauthorized"}), 400

    with _data_lock:
        data = read_data()
        data, changed = normalize_data(data)
        student = find_account(data, "student", student_id)
        if not student:
            if changed:
                write_data(data)
            return jsonify({"ok": False, "error": "unauthorized"}), 404
        if changed:
            write_data(data)
        state = student_wallet_state(student, data)

    return jsonify({"ok": True, "state": state})


@app.route("/api/currency/exchange", methods=["POST"])
def currency_exchange():
    """Tanga <-> Olmos almashinuvini serverda, atomik tarzda amalga oshiradi.

    Kurslar ATAYLAB teng emas:
      c2d (Tanga -> Olmos): 1 Tanga = coinToDiamondRate (standart 10) Olmos
      d2c (Olmos -> Tanga): diamondToCoinRate (standart 15) Olmos = 1 Tanga
        (miqdor diamondToCoinRate'ga karrali bo'lishi shart, aks holda rad etiladi)

    Har bir muvaffaqiyatli almashinuv data["currencyExchanges"] ro'yxatiga
    yoziladi (kim, qachon, qaysi yo'nalishda, qancha miqdorda).
    """
    body = request.get_json(silent=True)
    if not isinstance(body, dict):
        return jsonify({"ok": False, "error": "invalid_amount"}), 400

    student_id = n_int(body.get("studentId"))
    direction = str(body.get("direction", "")).strip()
    amount = n_int(body.get("amount"))

    if not student_id or direction not in ("c2d", "d2c"):
        return jsonify({"ok": False, "error": "invalid_amount"}), 400
    if amount <= 0:
        return jsonify({"ok": False, "error": "invalid_amount"}), 400

    with _data_lock:
        data = read_data()
        data, _ = normalize_data(data)
        student = find_account(data, "student", student_id)
        if not student:
            return jsonify({"ok": False, "error": "unauthorized"}), 404

        c2d_rate, d2c_rate = get_exchange_rates(data)
        cur_coins = n_int(student.get("totalCoins"))
        cur_diamonds = n_int(student.get("olmos"))

        if direction == "c2d":
            # Tanga sarflab, Olmos olish: 1 Tanga = c2d_rate Olmos
            if amount > cur_coins:
                return jsonify({"ok": False, "error": "insufficient_balance"}), 400
            coins_delta = -amount
            diamonds_delta = amount * c2d_rate
        else:
            # Olmos sarflab, Tanga olish: d2c_rate Olmos = 1 Tanga
            # Miqdor kursga karrali bo'lishi shart — aks holda Olmos "yo'qolib" ketmasligi uchun rad etamiz.
            if amount % d2c_rate != 0:
                return jsonify({"ok": False, "error": "invalid_multiple"}), 400
            if amount > cur_diamonds:
                return jsonify({"ok": False, "error": "insufficient_balance"}), 400
            diamonds_delta = -amount
            coins_delta = amount // d2c_rate

        student["totalCoins"] = cur_coins + coins_delta
        student["olmos"] = cur_diamonds + diamonds_delta

        exchange_id = n_int(data.get("nextExchangeId"), 1)
        data["nextExchangeId"] = exchange_id + 1
        data.setdefault("currencyExchanges", []).append({
            "id": exchange_id,
            "studentId": student_id,
            "direction": direction,
            "amount": amount,
            "coinsDelta": coins_delta,
            "diamondsDelta": diamonds_delta,
            "coinsBalanceAfter": student["totalCoins"],
            "diamondsBalanceAfter": student["olmos"],
            "rateUsed": c2d_rate if direction == "c2d" else d2c_rate,
            "at": int(time.time() * 1000),
        })

        write_data(data)
        state = student_wallet_state(student, data)

    return jsonify({"ok": True, "state": state})


@app.route("/api/admin/exchange-rate", methods=["POST"])
def admin_exchange_rate():
    """Admin uchun: Tanga<->Olmos kurslarini o'zgartirish (standart: 10 / 15).

    Talab: `role` va `adminId` yuborilishi va haqiqatan admin bo'lishi kerak.
    """
    body = request.get_json(silent=True)
    if not isinstance(body, dict):
        return jsonify({"ok": False, "error": "invalid_amount"}), 400

    admin_id = n_int(body.get("adminId"))

    with _data_lock:
        data = read_data()
        data, _ = normalize_data(data)
        admin = find_account(data, "admin", admin_id) if admin_id else None
        if not admin:
            return jsonify({"ok": False, "error": "unauthorized"}), 403

        settings = data.get("settings")
        if not isinstance(settings, dict):
            settings = {}
            data["settings"] = settings

        if "coinToDiamondRate" in body:
            settings["coinToDiamondRate"] = max(1, n_int(body.get("coinToDiamondRate"), DEFAULT_COIN_TO_DIAMOND_RATE))
        if "diamondToCoinRate" in body:
            settings["diamondToCoinRate"] = max(1, n_int(body.get("diamondToCoinRate"), DEFAULT_DIAMOND_TO_COIN_RATE))
        # Eski frontend/klient faqat "rate" yuborishi mumkin — buni Olmos->Tanga
        # kursi sifatida talqin qilamiz (eski xatti-harakatga eng yaqini).
        elif "rate" in body:
            settings["diamondToCoinRate"] = max(1, n_int(body.get("rate"), DEFAULT_DIAMOND_TO_COIN_RATE))

        write_data(data)
        c2d_rate, d2c_rate = get_exchange_rates(data)

    return jsonify({"ok": True, "state": {
        "coinToDiamondRate": c2d_rate,
        "diamondToCoinRate": d2c_rate,
        "exchangeRate": d2c_rate,
    }})


@app.route("/api/ai/chat", methods=["POST"])
def ai_chat():
    """Chat ichidagi /texno komandasi uchun ChatGPT javobi."""
    if not Config.OPENAI_API_KEY:
        return jsonify({"status": "error", "message": "OPENAI_API_KEY sozlanmagan"}), 503

    req_data = request.get_json(silent=True)
    if not isinstance(req_data, dict):
        return jsonify({"status": "error", "message": "JSON obyekt yuboring"}), 400

    prompt = str(req_data.get("prompt", "")).strip()
    if not prompt:
        return jsonify({"status": "error", "message": "Savol matni kerak"}), 400

    history = req_data.get("history", [])
    messages = [{
        "role": "system",
        "content": (
            "Siz Teacher_texno platformasidagi Texno AI yordamchisisiz. "
            "Javoblarni asosan o'zbek tilida, qisqa, foydali va amaliy yozing. "
            "Telegram/Instagram chatidagi mention assistant kabi kontekstga mos javob bering."
        ),
    }]
    if isinstance(history, list):
        for item in history[-10:]:
            if not isinstance(item, dict):
                continue
            role = "assistant" if item.get("role") == "assistant" else "user"
            content = str(item.get("content", "")).strip()
            if content:
                messages.append({"role": role, "content": content[:1200]})
    messages.append({"role": "user", "content": prompt})

    payload = {
        "model": Config.OPENAI_MODEL,
        "messages": messages,
        "temperature": 0.4,
        "max_tokens": 700,
    }
    body = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        "https://api.openai.com/v1/chat/completions",
        data=body,
        method="POST",
        headers={
            "Authorization": f"Bearer {Config.OPENAI_API_KEY}",
            "Content-Type": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=35) as res:
            out = json.loads(res.read().decode("utf-8"))
        answer = out.get("choices", [{}])[0].get("message", {}).get("content", "").strip()
        return jsonify({"status": "success", "answer": answer or "Javob topilmadi"})
    except urllib.error.HTTPError as e:
        detail = e.read().decode("utf-8", errors="ignore")
        logger.warning("OpenAI API xatosi: %s", detail)
        return jsonify({"status": "error", "message": detail or str(e)}), 502
    except Exception as e:  # noqa: BLE001
        logger.exception("OpenAI so'rovida kutilmagan xato")
        return jsonify({"status": "error", "message": str(e)}), 502


@app.route("/api/telegram-link/request", methods=["POST"])
def request_telegram_link():
    req_data = request.get_json(silent=True)
    if not isinstance(req_data, dict):
        return jsonify({"status": "error", "message": "JSON obyekt yuboring"}), 400

    role = str(req_data.get("role", "")).strip()
    account_id = n_int(req_data.get("accountId"))
    telegram_id = n_int(req_data.get("telegramId"))
    if role not in {"student", "teacher", "admin"} or not account_id or not telegram_id:
        return jsonify({"status": "error", "message": "Role, profil ID va Telegram ID kerak"}), 400

    # Race condition oldini olish uchun lock ichida o'qish + yozish
    with _data_lock:
        data = read_data()
        account = find_account(data, role, account_id)
        if not account:
            return jsonify({"status": "error", "message": "Profil topilmadi"}), 404

        token = uuid.uuid4().hex[:12]
        data["pendingTelegramLinks"] = [
            item for item in data.get("pendingTelegramLinks", [])
            if not (
                n_int(item.get("telegramId")) == telegram_id
                or (item.get("role") == role and n_int(item.get("accountId")) == account_id)
            )
        ]
        pending = {
            "token": token,
            "role": role,
            "accountId": account_id,
            "telegramId": telegram_id,
            "name": account.get("name", ""),
            "createdAt": int(time.time() * 1000),
            "status": "pending",
        }
        data["pendingTelegramLinks"].append(pending)
        write_data(data)

    role_label = {"student": "Talaba", "teacher": "O'qituvchi", "admin": "Admin"}[role]
    text = (
        "Saytdan Telegram ulash so'rovi keldi.\n\n"
        f"Profil: <b>{role_label}</b>\n"
        f"Ism: <b>{account.get('name', '')}</b>\n"
        f"ID: <code>{account_id}</code>\n\n"
        "Tasdiqlaysizmi?"
    )
    inline_markup = {
        "inline_keyboard": [[
            {"text": "Tasdiqlash", "callback_data": f"tgok:{token}", "style": "success"},
            {"text": "Rad etish", "callback_data": f"tgno:{token}", "style": "danger"},
        ]]
    }
    ok, err = send_bot_message(telegram_id, text, inline_markup)
    if ok:
        reply_markup = {
            "keyboard": [[{"text": "Tasdiqlash", "style": "success"}, {"text": "Rad etish", "style": "danger"}]],
            "resize_keyboard": True,
            "one_time_keyboard": True,
        }
        send_bot_message(telegram_id, "Reply keyboard orqali ham tanlashingiz mumkin:", reply_markup)
        return jsonify({"status": "pending", "message": "Botga tasdiqlash yuborildi"})

    return jsonify({
        "status": "error",
        "message": "Botga xabar yuborilmadi. Avval botga /start yuboring.",
        "details": err,
    }), 502


@app.route("/api/upload", methods=["POST"])
def upload_file():
    """Xavfsiz fayl yuklash: faqat ruxsat etilgan extensiyalar, secure_filename bilan."""
    if "file" not in request.files:
        return jsonify({"status": "error", "message": "Fayl yuborilmadi"}), 400

    file = request.files["file"]
    if not file or file.filename == "":
        return jsonify({"status": "error", "message": "Fayl tanlanmadi"}), 400

    original_name = secure_filename(file.filename)
    if len(original_name) > 120:
        return jsonify({"status": "error", "message": "Fayl nomi juda uzun"}), 400
    if not original_name or not allowed_upload_file(original_name):
        allowed = ", ".join(sorted(Config.ALLOWED_UPLOAD_EXTENSIONS))
        return jsonify({
            "status": "error",
            "message": f"Ruxsat etilmagan fayl turi. Ruxsat etilganlar: {allowed}",
        }), 400

    head = file.stream.read(32)
    file.stream.seek(0)
    if not detect_upload_type(original_name, head):
        return jsonify({"status": "error", "message": "Fayl turi va tarkibi mos emas"}), 400

    ext = original_name.rsplit(".", 1)[1].lower()
    filename = f"{uuid.uuid4().hex}.{ext}"
    filepath = Config.UPLOAD_DIR / filename
    file.save(str(filepath))
    logger.info("Fayl yuklandi: %s", filename)
    return jsonify({"status": "success", "url": f"uploads/{filename}"})


@app.route("/uploads/<path:filename>")
def uploaded_file(filename: str):
    return send_from_directory(str(Config.UPLOAD_DIR), filename)


@app.route("/api/sms", methods=["POST"])
def send_sms():
    """SMS yuborish. SMS_GATEWAY_URL mavjud bo'lsa, tashqi xizmatga yuboradi, aks holda log."""
    req_data = request.get_json(silent=True)
    if not isinstance(req_data, dict):
        return jsonify({"status": "error", "message": "JSON obyekt yuboring"}), 400

    phone = str(req_data.get("phone", "")).strip()
    message = str(req_data.get("message", "")).strip()
    if not phone or not message:
        return jsonify({"status": "error", "message": "Telefon raqami va xabar kerak"}), 400

    if Config.SMS_GATEWAY_URL:
        payload = json.dumps({"phone": phone, "message": message}).encode("utf-8")
        req = urllib.request.Request(
            Config.SMS_GATEWAY_URL, data=payload,
            headers={"Content-Type": "application/json"}, method="POST",
        )
        if Config.SMS_GATEWAY_API_KEY:
            req.add_header("Authorization", f"Bearer {Config.SMS_GATEWAY_API_KEY}")
        try:
            with urllib.request.urlopen(req, timeout=15) as res:
                status_code = res.getcode()
                body = res.read().decode("utf-8", errors="ignore")
            if 200 <= status_code < 300:
                return jsonify({"status": "success", "message": "SMS yuborildi", "provider_response": body})
            return jsonify({"status": "error", "message": "SMS gateway xatosi", "provider_response": body}), 502
        except urllib.error.URLError as err:
            logger.warning("SMS gateway xatosi: %s", err)
            return jsonify({"status": "error", "message": str(err)}), 502

    logger.info("[SMS-STUB] %s: %s", phone, message)
    return jsonify({"status": "success", "message": "SMS stub orqali qayd etildi"})


# Boshqa statik fayllarni (rasm, css, js) topib berish uchun - eng oxirida bo'lishi kerak
@app.route("/<path:path>")
def static_files(path: str):
    return send_from_directory(str(Config.BASE_DIR), path)


init_data_file()
start_telegram_bot()

if __name__ == "__main__":
    debug_mode = os.environ.get("FLASK_DEBUG", "0") == "1"
    app.run(host="0.0.0.0", port=Config.PORT, debug=debug_mode)
