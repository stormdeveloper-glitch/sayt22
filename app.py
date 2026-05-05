import json
import os
import threading
import urllib.error
import urllib.parse
import urllib.request
from copy import deepcopy
from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS

app = Flask(__name__, static_folder=".", static_url_path="")
CORS(app)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))


def load_env_file():
    env_file = os.path.join(BASE_DIR, ".env")
    if not os.path.exists(env_file):
        return
    with open(env_file, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


load_env_file()
DATA_DIR = os.environ.get("DATA_DIR", os.path.join(BASE_DIR, "data"))
DATA_FILE = os.path.join(DATA_DIR, "data.json")
BOT_TOKEN = os.environ.get("BOT_TOKEN", "").strip()
_DATA_LOCK = threading.Lock()

print(f"[APP] DATA_DIR={DATA_DIR}")
if DATA_DIR == os.path.join(BASE_DIR, "data"):
    print("[APP] Ogohlantirish: DATA_DIR env o'rnatilmagan. Railway restart/deploy paytida data yo'qolishi mumkin.")


def default_data():
    return {
        "students": [],
        "transactions": [],
        "nextStudentId": 1,
        "teachers": [],
        "nextTeacherId": 1,
        "admins": [],
        "nextAdminId": 1,
        "adminRequests": [],
        "nextRequestId": 1,
        "messages": [],
        "telegramProfiles": {},
    }


def normalize_data(data):
    base = default_data()
    if isinstance(data, dict):
        base.update(data)
    for key in ("students", "transactions", "teachers", "admins", "adminRequests", "messages"):
        if not isinstance(base.get(key), list):
            base[key] = []
    if not isinstance(base.get("telegramProfiles"), dict):
        base["telegramProfiles"] = {}
    return base


def init_data_file():
    os.makedirs(DATA_DIR, exist_ok=True)
    if not os.path.exists(DATA_FILE):
        with open(DATA_FILE, "w", encoding="utf-8") as f:
            json.dump(default_data(), f, ensure_ascii=False, indent=2)


def read_data():
    init_data_file()
    with _DATA_LOCK:
        with open(DATA_FILE, "r", encoding="utf-8") as f:
            return normalize_data(json.load(f))


def write_data(data):
    init_data_file()
    normalized = normalize_data(data)
    tmp_file = f"{DATA_FILE}.tmp"
    with _DATA_LOCK:
        with open(tmp_file, "w", encoding="utf-8") as f:
            json.dump(normalized, f, ensure_ascii=False, indent=2)
        os.replace(tmp_file, DATA_FILE)
    return normalized


def telegram_api(method, params):
    if not BOT_TOKEN:
        return None
    url = f"https://api.telegram.org/bot{BOT_TOKEN}/{method}"
    query = urllib.parse.urlencode(params)
    req = urllib.request.Request(f"{url}?{query}", method="GET")
    try:
        with urllib.request.urlopen(req, timeout=12) as res:
            payload = json.loads(res.read().decode("utf-8"))
        return payload.get("result") if payload.get("ok") else None
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError):
        return None


def telegram_profile_from_api(telegram_id):
    chat = telegram_api("getChat", {"chat_id": telegram_id}) or {}
    profile = {
        "telegramId": int(telegram_id),
        "telegramName": " ".join(
            str(chat.get(k, "")).strip() for k in ("first_name", "last_name") if chat.get(k)
        ).strip() or str(chat.get("title") or ""),
        "telegramUsername": str(chat.get("username") or ""),
        "telegramPhotoFileId": "",
        "telegramPhotoUrl": "",
    }
    photos = telegram_api("getUserProfilePhotos", {"user_id": telegram_id, "limit": 1}) or {}
    try:
        file_id = photos["photos"][0][-1]["file_id"]
        profile["telegramPhotoFileId"] = file_id
        file_info = telegram_api("getFile", {"file_id": file_id}) or {}
        file_path = file_info.get("file_path")
        if file_path and BOT_TOKEN:
            profile["telegramPhotoUrl"] = f"https://api.telegram.org/file/bot{BOT_TOKEN}/{file_path}"
    except (KeyError, IndexError, TypeError):
        pass
    return profile


@app.route("/")
def index():
    return send_from_directory(".", "index.html")


@app.route("/api/data", methods=["GET"])
def get_data():
    try:
        return jsonify(read_data())
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/data", methods=["POST"])
def save_data():
    try:
        req_data = request.get_json(silent=True)
        if not isinstance(req_data, dict):
            return jsonify({"status": "error", "message": "JSON obyekt yuboring"}), 400
        if not all(k in req_data for k in ("students", "transactions", "nextStudentId")):
            return jsonify({"status": "error", "message": "Majburiy maydonlar yetishmayapti"}), 400
        saved = write_data(req_data)
        return jsonify({"status": "success", "message": "Ma'lumot saqlandi", "data": saved})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


@app.route("/api/telegram/profile/<int:telegram_id>", methods=["GET"])
def get_telegram_profile(telegram_id):
    try:
        data = read_data()
        cached = deepcopy(data.get("telegramProfiles", {}).get(str(telegram_id), {}))
        if not cached or request.args.get("refresh") == "1":
            cached = telegram_profile_from_api(telegram_id)
            data.setdefault("telegramProfiles", {})[str(telegram_id)] = cached
            write_data(data)
        return jsonify({"ok": True, "profile": cached})
    except Exception as e:
        return jsonify({"ok": False, "message": str(e)}), 500


@app.route("/api/sms", methods=["POST"])
def send_sms():
    try:
        req_data = request.get_json(silent=True)
        if not isinstance(req_data, dict):
            return jsonify({"status": "error", "message": "JSON obyekt yuboring"}), 400
        phone = str(req_data.get("phone", "")).strip()
        message = str(req_data.get("message", "")).strip()
        if not phone or not message:
            return jsonify({"status": "error", "message": "Telefon raqami va xabar kerak"}), 400

        gateway_url = os.environ.get("SMS_GATEWAY_URL")
        gateway_key = os.environ.get("SMS_GATEWAY_API_KEY")
        if gateway_url:
            payload = json.dumps({"phone": phone, "message": message}).encode("utf-8")
            req = urllib.request.Request(
                gateway_url,
                data=payload,
                headers={"Content-Type": "application/json"},
                method="POST",
            )
            if gateway_key:
                req.add_header("Authorization", f"Bearer {gateway_key}")
            try:
                with urllib.request.urlopen(req, timeout=15) as res:
                    status_code = res.getcode()
                    body = res.read().decode("utf-8", errors="ignore")
                if 200 <= status_code < 300:
                    return jsonify({"status": "success", "message": "SMS yuborildi", "provider_response": body})
                return jsonify({"status": "error", "message": "SMS gateway xatosi", "provider_response": body}), 502
            except urllib.error.URLError as err:
                return jsonify({"status": "error", "message": str(err)}), 502

        print(f"[SMS-STUB] {phone}: {message}")
        return jsonify({"status": "success", "message": "SMS stub orqali qayd etildi"})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


@app.route("/<path:path>")
def static_files(path):
    return send_from_directory(".", path)


def maybe_start_bot():
    if os.environ.get("RUN_TELEGRAM_BOT", "1") == "0":
        print("[BOT] RUN_TELEGRAM_BOT=0, bot ishga tushmadi")
        return
    if not BOT_TOKEN:
        print("[BOT] BOT_TOKEN topilmadi. Railway Variables ichiga BOT_TOKEN qo'shing.")
        return
    try:
        from bot.main import start_bot_thread

        start_bot_thread()
        print("[BOT] Telegram bot thread ishga tushdi")
    except Exception as e:
        print(f"[BOT] Ishga tushirishda xato: {e}")


maybe_start_bot()

if __name__ == "__main__":
    init_data_file()
    port = int(os.environ.get("PORT", 8080))
    app.run(host="0.0.0.0", port=port)
