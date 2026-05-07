import os
import json
import uuid
import time
import urllib.parse
import urllib.request
import urllib.error
from werkzeug.utils import secure_filename
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS

# static_folder='.' loyiha ichidagi barcha fayllarni (index.html, teacher.jpg) ko'rinadigan qiladi
app = Flask(__name__, static_folder='.', static_url_path='')
CORS(app)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
# Railway Volume ulangan joy: productionda /app/data/data.json.
# Lokalda esa loyiha ichidagi data papkasi ishlatiladi.
DEFAULT_DATA_DIR = '/app/data' if os.path.isdir('/app') else os.path.join(BASE_DIR, 'data')
DATA_DIR = os.environ.get('DATA_DIR', DEFAULT_DATA_DIR)
DATA_FILE = os.path.join(DATA_DIR, 'data.json')
UPLOAD_DIR = os.path.join(BASE_DIR, 'uploads')
os.makedirs(UPLOAD_DIR, exist_ok=True)

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

def n_int(value, default=0):
    try:
        return int(value)
    except (TypeError, ValueError):
        return default

def coins_total(value):
    if isinstance(value, dict):
        return sum(n_int(v) for v in value.values())
    return n_int(value)

def normalize_data(data):
    if not isinstance(data, dict):
        data = {}
    data.setdefault("students", [])
    data.setdefault("transactions", [])
    data.setdefault("nextStudentId", 1)
    data.setdefault("teachers", [])
    data.setdefault("nextTeacherId", 1)
    data.setdefault("admins", [])
    data.setdefault("nextAdminId", 1)
    data.setdefault("adminRequests", [])
    data.setdefault("nextRequestId", 1)
    data.setdefault("messages", [])
    data.setdefault("groups", [])
    data.setdefault("chatFriends", [])
    data.setdefault("chatGroups", [])
    data.setdefault("pendingReqs", [])
    data.setdefault("pendingTelegramLinks", [])
    data.setdefault("tests", [])
    data.setdefault("plans", [])
    data.setdefault("submissions", [])
    data.setdefault("telegramProfiles", {})

    changed = False
    for student in data.get("students", []):
        if not isinstance(student, dict):
            continue
        default = STUDENT_DEFAULTS.get(str(student.get("name", "")).strip())
        current_group = str(student.get("group") or "").strip()
        if default and (not current_group or current_group == "Yangi" or (current_group == "D1" and default["group"] != "D1")):
            student["group"] = default["group"]
            changed = True
        elif not current_group:
            student["group"] = "D1"
            changed = True

        teacher_id = n_int((student.get("teacherIds") or [student.get("teacherId") or 1])[0] if isinstance(student.get("teacherIds"), list) else student.get("teacherId"), 1)
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

def start_telegram_bot():
    """Start Telegram bot in the same Railway service when BOT_TOKEN is set."""
    if not os.environ.get('BOT_TOKEN', '').strip():
        print('[BOT] BOT_TOKEN topilmadi, Telegram bot ishga tushmadi')
        return
    try:
        from bot.main import start_bot_thread
        start_bot_thread()
        print('[BOT] Telegram bot background thread ishga tushdi')
    except Exception as e:
        print(f'[BOT] Telegram botni ishga tushirishda xato: {e}')

def init_data_file():
    """Fayl mavjud bo'lmasa, bazani yaratadi"""
    if not os.path.exists(DATA_DIR):
        os.makedirs(DATA_DIR, exist_ok=True)
    if not os.path.exists(DATA_FILE):
        with open(DATA_FILE, 'w', encoding='utf-8') as f:
            json.dump({
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
                "groups": [],
                "chatFriends": [],
                "chatGroups": [],
                "pendingReqs": [],
                "pendingTelegramLinks": [],
                "tests": [],
                "plans": [],
                "submissions": [],
                "telegramProfiles": {}
            }, f, ensure_ascii=False, indent=2)

@app.route('/')
def index():
    return send_from_directory('.', 'index.html')

@app.route('/api/data', methods=['GET'])
def get_data():
    """Volume'dan ma'lumotni o'qib beradi"""
    try:
        init_data_file()
        with open(DATA_FILE, 'r', encoding='utf-8') as f:
            data = json.load(f)
        data, changed = normalize_data(data)
        if changed:
            with open(DATA_FILE, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
        return jsonify(data)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/data', methods=['POST'])
def save_data():
    """Frontend'dan kelgan ma'lumotni avtomatik Volume'ga saqlaydi"""
    try:
        req_data = request.get_json(silent=True)
        if not isinstance(req_data, dict):
            return jsonify({"status": "error", "message": "JSON obyekt yuboring"}), 400
        if not all(k in req_data for k in ("students", "transactions", "nextStudentId")):
            return jsonify({"status": "error", "message": "Majburiy maydonlar yetishmayapti"}), 400
        req_data, _ = normalize_data(req_data)
        init_data_file()
        with open(DATA_FILE, 'w', encoding='utf-8') as f:
            json.dump(req_data, f, ensure_ascii=False, indent=2)
        return jsonify({"status": "success", "message": "Ma'lumot saqlandi"})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/api/ai/chat', methods=['POST'])
def ai_chat():
    """Chat ichidagi /texno komandasi uchun ChatGPT javobi."""
    api_key = os.environ.get("OPENAI_API_KEY", "").strip()
    if not api_key:
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
        )
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
        "model": os.environ.get("OPENAI_MODEL", "gpt-4o-mini"),
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
            "Authorization": f"Bearer {api_key}",
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
        return jsonify({"status": "error", "message": detail or str(e)}), 502
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 502

def find_account(data, role, account_id):
    collection = {"student": "students", "teacher": "teachers", "admin": "admins"}.get(role)
    if not collection:
        return None
    aid = n_int(account_id)
    return next((item for item in data.get(collection, []) if n_int(item.get("id")) == aid), None)

def send_bot_message(chat_id, text, reply_markup=None):
    token = os.environ.get('BOT_TOKEN', '').strip()
    if not token:
        return False, "BOT_TOKEN sozlanmagan"
    payload = {
        "chat_id": str(chat_id),
        "text": text,
        "parse_mode": "HTML",
    }
    if reply_markup:
        payload["reply_markup"] = json.dumps(reply_markup, ensure_ascii=False)
    body = urllib.parse.urlencode(payload).encode("utf-8")
    url = f"https://api.telegram.org/bot{token}/sendMessage"
    try:
        req = urllib.request.Request(url, data=body, method="POST")
        with urllib.request.urlopen(req, timeout=15) as res:
            return 200 <= res.getcode() < 300, ""
    except urllib.error.HTTPError as e:
        return False, e.read().decode("utf-8", errors="ignore") or str(e)
    except Exception as e:
        return False, str(e)

@app.route('/api/telegram-link/request', methods=['POST'])
def request_telegram_link():
    try:
        req_data = request.get_json(silent=True)
        if not isinstance(req_data, dict):
            return jsonify({"status": "error", "message": "JSON obyekt yuboring"}), 400
        role = str(req_data.get("role", "")).strip()
        account_id = n_int(req_data.get("accountId"))
        telegram_id = n_int(req_data.get("telegramId"))
        if role not in {"student", "teacher", "admin"} or not account_id or not telegram_id:
            return jsonify({"status": "error", "message": "Role, profil ID va Telegram ID kerak"}), 400

        init_data_file()
        with open(DATA_FILE, 'r', encoding='utf-8') as f:
            data = json.load(f)
        data, _ = normalize_data(data)
        account = find_account(data, role, account_id)
        if not account:
            return jsonify({"status": "error", "message": "Profil topilmadi"}), 404

        token = uuid.uuid4().hex[:12]
        data["pendingTelegramLinks"] = [
            item for item in data.get("pendingTelegramLinks", [])
            if not (n_int(item.get("telegramId")) == telegram_id or (item.get("role") == role and n_int(item.get("accountId")) == account_id))
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
        with open(DATA_FILE, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

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
        return jsonify({"status": "error", "message": "Botga xabar yuborilmadi. Avval botga /start yuboring.", "details": err}), 502
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/api/upload', methods=['POST'])
def upload_file():
    if 'file' not in request.files:
        return jsonify({"status": "error", "message": "Fayl yuborilmadi"}), 400
    file = request.files['file']
    if file.filename == '':
        return jsonify({"status": "error", "message": "Fayl tanlanmadi"}), 400
    if file:
        ext = file.filename.rsplit('.', 1)[1].lower() if '.' in file.filename else ''
        filename = f"{uuid.uuid4().hex}.{ext}" if ext else f"{uuid.uuid4().hex}"
        filepath = os.path.join(UPLOAD_DIR, filename)
        file.save(filepath)
        return jsonify({"status": "success", "url": f"uploads/{filename}"})

@app.route('/api/sms', methods=['POST'])
def send_sms():
    """SMS jo'natish uchun oddiy backend endpoint. SMS_GATEWAY_URL mavjud bo'lsa, tashqi xizmatga yuboradi."""
    try:
        req_data = request.get_json(silent=True)
        if not isinstance(req_data, dict):
            return jsonify({"status": "error", "message": "JSON obyekt yuboring"}), 400
        phone = str(req_data.get('phone', '')).strip()
        message = str(req_data.get('message', '')).strip()
        if not phone or not message:
            return jsonify({"status": "error", "message": "Telefon raqami va xabar kerak"}), 400

        gateway_url = os.environ.get('SMS_GATEWAY_URL')
        gateway_key = os.environ.get('SMS_GATEWAY_API_KEY')
        if gateway_url:
            import urllib.request
            import urllib.error
            payload = json.dumps({"phone": phone, "message": message}).encode('utf-8')
            req = urllib.request.Request(gateway_url, data=payload, headers={"Content-Type": "application/json"}, method='POST')
            if gateway_key:
                req.add_header('Authorization', f'Bearer {gateway_key}')
            try:
                with urllib.request.urlopen(req, timeout=15) as res:
                    status_code = res.getcode()
                    body = res.read().decode('utf-8', errors='ignore')
                if 200 <= status_code < 300:
                    return jsonify({"status": "success", "message": "SMS yuborildi", "provider_response": body})
                return jsonify({"status": "error", "message": "SMS gateway xatosi", "provider_response": body}), 502
            except urllib.error.URLError as err:
                return jsonify({"status": "error", "message": str(err)}), 502

        print(f"[SMS-STUB] {phone}: {message}")
        return jsonify({"status": "success", "message": "SMS stub orqali qayd etildi"})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

# Har qanday boshqa faylni (rasm, css) topib berish uchun
@app.route('/<path:path>')
def static_files(path):
    return send_from_directory('.', path)

init_data_file()
start_telegram_bot()

if __name__ == '__main__':
    # Railway beradigan 8080 yoki boshqa portda ishga tushadi
    port = int(os.environ.get('PORT', 8080))
    app.run(host='0.0.0.0', port=port)
