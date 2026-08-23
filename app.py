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
from pathlib import Path
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
    MAX_UPLOAD_SIZE = 10 * 1024 * 1024  # 10 MB

    OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "").strip()
    OPENAI_MODEL = os.environ.get("OPENAI_MODEL", "gpt-4o-mini")

    BOT_TOKEN = os.environ.get("BOT_TOKEN", "").strip()

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
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def coins_total(value: Any) -> int:
    if isinstance(value, dict):
        return sum(n_int(v) for v in value.values())
    return n_int(value)


def normalize_data(data: Any) -> tuple[dict, bool]:
    """Ma'lumot bazasi strukturasini to'ldiradi va talabalar hisobini yangilaydi."""
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


def init_data_file() -> None:
    """Fayl mavjud bo'lmasa, bo'sh bazani yaratadi."""
    Config.DATA_DIR.mkdir(parents=True, exist_ok=True)
    if not Config.DATA_FILE.exists():
        empty_data, _ = normalize_data({})
        with Config.DATA_FILE.open("w", encoding="utf-8") as fh:
            json.dump(empty_data, fh, ensure_ascii=False, indent=2)


def read_data() -> dict:
    with _data_lock:
        init_data_file()
        with Config.DATA_FILE.open("r", encoding="utf-8") as fh:
            data = json.load(fh)
        data, changed = normalize_data(data)
        if changed:
            tmp = Config.DATA_FILE.with_suffix(Config.DATA_FILE.suffix + ".tmp")
            with tmp.open("w", encoding="utf-8") as fh:
                json.dump(data, fh, ensure_ascii=False, indent=2)
            os.replace(tmp, Config.DATA_FILE)
        return data


def write_data(data: dict) -> None:
    """Atomik yozish: avval .tmp faylga yoziladi, keyin rename qilinadi."""
    with _data_lock:
        init_data_file()
        tmp = Config.DATA_FILE.with_suffix(Config.DATA_FILE.suffix + ".tmp")
        with tmp.open("w", encoding="utf-8") as fh:
            json.dump(data, fh, ensure_ascii=False, indent=2)
        os.replace(tmp, Config.DATA_FILE)


def find_account(data: dict, role: str, account_id: int) -> Optional[dict]:
    collection = {"student": "students", "teacher": "teachers", "admin": "admins"}.get(role)
    if not collection:
        return None
    aid = n_int(account_id)
    return next((item for item in data.get(collection, []) if n_int(item.get("id")) == aid), None)


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
    if not Config.BOT_TOKEN:
        logger.info("BOT_TOKEN topilmadi, Telegram bot ishga tushmadi")
        return
    try:
        from bot.main import start_bot_thread

        start_bot_thread()
        logger.info("Telegram bot background thread ishga tushdi")
    except Exception:
        logger.exception("Telegram botni ishga tushirishda xato")


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


@app.route("/api/data", methods=["GET"])
def get_data():
    """Volume'dan ma'lumotni o'qib beradi."""
    return jsonify(read_data())


@app.route("/api/data", methods=["POST"])
def save_data():
    """Frontend'dan kelgan ma'lumotni Volume'ga saqlaydi."""
    req_data = request.get_json(silent=True)
    if not isinstance(req_data, dict):
        return jsonify({"status": "error", "message": "JSON obyekt yuboring"}), 400
    if not all(k in req_data for k in ("students", "transactions", "nextStudentId")):
        return jsonify({"status": "error", "message": "Majburiy maydonlar yetishmayapti"}), 400

    req_data, _ = normalize_data(req_data)
    write_data(req_data)
    return jsonify({"status": "success", "message": "Ma'lumot saqlandi"})


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
        init_data_file()
        with Config.DATA_FILE.open("r", encoding="utf-8") as fh:
            data = json.load(fh)
        data, _ = normalize_data(data)
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

        tmp = Config.DATA_FILE.with_suffix(Config.DATA_FILE.suffix + ".tmp")
        with tmp.open("w", encoding="utf-8") as fh:
            json.dump(data, fh, ensure_ascii=False, indent=2)
        os.replace(tmp, Config.DATA_FILE)

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
    if not original_name or not allowed_upload_file(original_name):
        allowed = ", ".join(sorted(Config.ALLOWED_UPLOAD_EXTENSIONS))
        return jsonify({
            "status": "error",
            "message": f"Ruxsat etilmagan fayl turi. Ruxsat etilganlar: {allowed}",
        }), 400

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