import os
import json
import uuid
import time
import threading
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

_ranking_cache = {}
_ranking_cache_lock = threading.Lock()
RANKING_CACHE_TTL = 15


def _cache_key(kind, identifier, period):
    return f"{kind}:{identifier}:{period}"


def _cache_get(key):
    with _ranking_cache_lock:
        entry = _ranking_cache.get(key)
    if not entry:
        return None
    if time.time() - entry["ts"] > RANKING_CACHE_TTL:
        return None
    return entry["data"]


def _cache_set(key, data):
    with _ranking_cache_lock:
        _ranking_cache[key] = {"ts": time.time(), "data": data}


def invalidate_ranking_cache():
    with _ranking_cache_lock:
        _ranking_cache.clear()

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

DEFAULT_SUBJECTS = [
    {"id": "math", "name": "Matematika", "icon": "📐", "color": "#00e5ff"},
    {"id": "english", "name": "Ingliz tili", "icon": "🇬🇧", "color": "#ffcc00"},
    {"id": "physics", "name": "Fizika", "icon": "⚛️", "color": "#00ff88"},
    {"id": "chemistry", "name": "Kimyo", "icon": "🧪", "color": "#bf5fff"},
    {"id": "biology", "name": "Biologiya", "icon": "🌱", "color": "#ff8a65"},
    {"id": "history", "name": "Tarix", "icon": "📜", "color": "#4fc3f7"},
    {"id": "literature", "name": "Adabiyot", "icon": "📚", "color": "#f06292"},
    {"id": "programming", "name": "Dasturlash", "icon": "💻", "color": "#7c4dff"},
]

DEFAULT_ACHIEVEMENTS = [
    {"id": "first_test", "name": "Birinchi test", "desc": "1 ta testni yakunlang", "icon": "🎯", "xp": 50, "condition": {"testsCompleted": 1}},
    {"id": "tests_10", "name": "Test ustozi", "desc": "10 ta testni muvaffaqiyatli tugating", "icon": "🏆", "xp": 200, "condition": {"testsCompleted": 10}},
    {"id": "tests_50", "name": "Test mutaxassisi", "desc": "50 ta testni bajaring", "icon": "🎖️", "xp": 500, "condition": {"testsCompleted": 50}},
    {"id": "streak_7", "name": "7 kunlik streak", "desc": "7 kun ketma-ket dars qiling", "icon": "🔥", "xp": 150, "condition": {"streak": 7}},
    {"id": "streak_30", "name": "Oylik streak", "desc": "30 kun ketma-ket o'qish", "icon": "⚡", "xp": 1000, "condition": {"streak": 30}},
    {"id": "xp_1000", "name": "1000 ball", "desc": "Jami 1000 ball to'plang", "icon": "⭐", "xp": 100, "condition": {"totalCoins": 1000}},
    {"id": "xp_5000", "name": "5000 ball", "desc": "Jami 5000 ball to'plang", "icon": "💎", "xp": 500, "condition": {"totalCoins": 5000}},
    {"id": "tasks_50", "name": "Topshiriq ustozi", "desc": "50 ta topshiriqni bajaring", "icon": "📚", "xp": 300, "condition": {"tasksCompleted": 50}},
    {"id": "rank_1", "name": "1-o'rin", "desc": "Reytingda 1-o'ringa chiqing", "icon": "🥇", "xp": 1000, "condition": {"rank": 1}},
    {"id": "rank_3", "name": "Top-3", "desc": "Reytingda 3-o'ringa kirinq", "icon": "🥉", "xp": 500, "condition": {"rank": 3}},
    {"id": "vip", "name": "VIP foydalanuvchi", "desc": "VIP obunani faollashtiring", "icon": "👑", "xp": 200, "condition": {"vip": True}},
    {"id": "videos_10", "name": "Video sevuvchi", "desc": "10 ta video darsni ko'ring", "icon": "🎬", "xp": 150, "condition": {"videosWatched": 10}},
]

DEFAULT_MARKET_PRODUCTS = [
    {"id": "course_math_basic", "name": "Matematika asoslari", "type": "course", "price": 200, "coinsPrice": 500, "rating": 4.8, "purchased": 124, "premium": False, "vip": False, "image": "📐", "desc": "Matematika fanining to'liq asoslari kursi. 30 ta dars, 100+ masala.", "teacher": "Aliyev A.", "lessons": 30},
    {"id": "vip_english", "name": "VIP Ingliz tili", "type": "vip_course", "price": 500, "coinsPrice": 1500, "rating": 4.9, "purchased": 89, "premium": True, "vip": True, "image": "🇬🇧", "desc": "Premium Ingliz tili kursi. 50 ta dars + shaxsiy o'qituvchi bilan mashg'ulotlar.", "teacher": "Valiyeva M.", "lessons": 50},
    {"id": "tests_pack_math", "name": "Matematika test to'plami", "type": "test", "price": 50, "coinsPrice": 150, "rating": 4.7, "purchased": 356, "premium": False, "vip": False, "image": "📝", "desc": "200 ta savoldan iborat to'liq test to'plami. Tushuntirish bilan birga.", "teacher": "O'tkirbek O.", "lessons": 0},
    {"id": "book_physics", "name": "Fizika bo'yicha premium kitob", "type": "book", "price": 80, "coinsPrice": 250, "rating": 4.6, "purchased": 210, "premium": False, "vip": False, "image": "📘", "desc": "Fizika bo'yicha 300 sahifalik elektr kitob. Rasm va diagrammalar bilan.", "teacher": "", "lessons": 0},
    {"id": "video_pack_chem", "name": "Kimyo video darslar to'plami", "type": "video", "price": 120, "coinsPrice": 350, "rating": 4.8, "purchased": 178, "premium": True, "vip": False, "image": "🎬", "desc": "4K formatda 25 ta video dars. Har biriga test va topshiriqlar.", "teacher": "Zokirov B.", "lessons": 25},
    {"id": "premium_all", "name": "PREMIUM paket (Barchasi)", "type": "premium", "price": 1200, "coinsPrice": 3500, "rating": 5.0, "purchased": 45, "premium": True, "vip": True, "image": "👑", "desc": "Barcha kurslar, VIP videolar, premium testlar, shaxsiy maslahat. 1 yillik ulash.", "teacher": "Barcha o'qituvchilar", "lessons": 500},
]

DEFAULT_NOTIF_TYPES = {
    "new_lesson": {"icon": "📖", "title": "Yangi dars"},
    "new_test": {"icon": "📝", "title": "Yangi test"},
    "new_message": {"icon": "💬", "title": "Yangi xabar"},
    "achievement": {"icon": "🏆", "title": "Yangi yutuq"},
    "rank_up": {"icon": "⬆️", "title": "Reytingda o'sish"},
    "rank_down": {"icon": "⬇️", "title": "Reytingda pasayish"},
    "score_up": {"icon": "📈", "title": "Ball oshdi"},
    "vip_content": {"icon": "👑", "title": "VIP kontent"},
    "homework": {"icon": "📋", "title": "Uyga vazifa"},
    "teacher_comment": {"icon": "✏️", "title": "O'qituvchi izohi"},
    "announcement": {"icon": "📢", "title": "Muhim e'lon"},
}

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
    data.setdefault("subjects", DEFAULT_SUBJECTS)
    data.setdefault("achievements_def", DEFAULT_ACHIEVEMENTS)
    data.setdefault("products", DEFAULT_MARKET_PRODUCTS)
    data.setdefault("notifications", [])
    data.setdefault("nextNotificationId", 1)
    data.setdefault("activity_logs", [])
    data.setdefault("purchases", [])
    data.setdefault("nextPurchaseId", 1)

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

        if not isinstance(student.get("subjectScores"), dict):
            student["subjectScores"] = {
                "math": {"score": 0, "prevScore": 0, "lessonsAttended": 0, "tasksCompleted": 0, "testsTaken": 0, "avgTestScore": 0, "teacherGrade": 0, "trend": "stable", "reason": ""},
                "english": {"score": 0, "prevScore": 0, "lessonsAttended": 0, "tasksCompleted": 0, "testsTaken": 0, "avgTestScore": 0, "teacherGrade": 0, "trend": "stable", "reason": ""},
                "physics": {"score": 0, "prevScore": 0, "lessonsAttended": 0, "tasksCompleted": 0, "testsTaken": 0, "avgTestScore": 0, "teacherGrade": 0, "trend": "stable", "reason": ""},
                "chemistry": {"score": 0, "prevScore": 0, "lessonsAttended": 0, "tasksCompleted": 0, "testsTaken": 0, "avgTestScore": 0, "teacherGrade": 0, "trend": "stable", "reason": ""},
                "biology": {"score": 0, "prevScore": 0, "lessonsAttended": 0, "tasksCompleted": 0, "testsTaken": 0, "avgTestScore": 0, "teacherGrade": 0, "trend": "stable", "reason": ""},
                "history": {"score": 0, "prevScore": 0, "lessonsAttended": 0, "tasksCompleted": 0, "testsTaken": 0, "avgTestScore": 0, "teacherGrade": 0, "trend": "stable", "reason": ""},
                "literature": {"score": 0, "prevScore": 0, "lessonsAttended": 0, "tasksCompleted": 0, "testsTaken": 0, "avgTestScore": 0, "teacherGrade": 0, "trend": "stable", "reason": ""},
                "programming": {"score": 0, "prevScore": 0, "lessonsAttended": 0, "tasksCompleted": 0, "testsTaken": 0, "avgTestScore": 0, "teacherGrade": 0, "trend": "stable", "reason": ""},
            }
            changed = True

        if not isinstance(student.get("progress"), dict):
            student["progress"] = {
                "weekly": [],
                "monthly": [],
                "overall": 0,
                "perSubject": {},
                "strongSubjects": [],
                "weakSubjects": [],
                "nextGoal": 500,
            }
            changed = True

        if not isinstance(student.get("achievements"), list):
            student["achievements"] = []
            changed = True

        if not isinstance(student.get("activity"), dict):
            student["activity"] = {
                "today": {"lessons": 0, "videos": 0, "tests": 0, "tasks": 0, "minutes": 0, "xp": 0},
                "week": {"lessons": 0, "videos": 0, "tests": 0, "tasks": 0, "minutes": 0, "xp": 0},
                "total": {"lessons": 0, "videos": 0, "tests": 0, "tasks": 0, "minutes": 0, "xp": 0},
                "streak": 0,
                "lastActive": 0,
                "dailyGoal": {"target": 100, "current": 0},
            }
            changed = True

        if not isinstance(student.get("vip"), dict):
            student["vip"] = {"status": False, "expiresAt": 0, "plan": "none"}
            changed = True

        if not isinstance(student.get("rank"), dict):
            student["rank"] = {"daily": 0, "weekly": 0, "monthly": 0, "overall": 0, "prevOverall": 0}
            changed = True

        if not isinstance(student.get("notifSettings"), dict):
            student["notifSettings"] = {
                "newLesson": True, "newTest": True, "newMessage": True, "achievement": True,
                "rankChange": True, "scoreChange": True, "vipContent": True, "homework": True,
                "teacherComment": True, "announcement": True,
            }
            changed = True

        if not isinstance(student.get("purchasedProducts"), list):
            student["purchasedProducts"] = []
            changed = True

        if not student.get("firstName"):
            nm = str(student.get("name", "")).strip().split()
            student["firstName"] = nm[0] if len(nm) > 0 else ""
            student["lastName"] = nm[1] if len(nm) > 1 else ""
            changed = True

        if not student.get("username"):
            student["username"] = "@" + str(student.get("name", "user")).lower().replace(" ", "_")[:20]
            changed = True

        if not student.get("grade"):
            student["grade"] = "10-sinf"
            changed = True
        if not student.get("school"):
            student["school"] = "Maktab #" + str(n_int(student.get("id"), 1))
            changed = True

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
                "telegramProfiles": {},
                "subjects": DEFAULT_SUBJECTS,
                "achievements_def": DEFAULT_ACHIEVEMENTS,
                "products": DEFAULT_MARKET_PRODUCTS,
                "notifications": [],
                "nextNotificationId": 1,
                "activity_logs": [],
                "purchases": [],
                "nextPurchaseId": 1,
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
        invalidate_ranking_cache()
        return jsonify({"status": "success", "message": "Ma'lumot saqlandi"})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


def _load_and_normalize():
    init_data_file()
    with open(DATA_FILE, 'r', encoding='utf-8') as f:
        data = json.load(f)
    data, changed = normalize_data(data)
    if changed:
        with open(DATA_FILE, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    return data


def _has_access(scope, identifier, viewer_role, viewer_id, data):
    if viewer_role == "admin":
        return True
    if viewer_role == "teacher":
        tid = n_int(viewer_id)
        if scope == "teacher":
            return tid == n_int(identifier)
        if scope == "group":
            gname = str(identifier or "").strip()
            grp = next((g for g in (data.get("groups") or []) if str(g.get("name") or "").strip() == gname), None)
            if grp and n_int(grp.get("teacherId")) == tid:
                return True
            return False
        if scope in ("subject", "overall"):
            return True
        return False
    if viewer_role == "student":
        sid = n_int(viewer_id)
        student = find_account(data, "student", sid)
        if not student:
            return False
        if scope == "overall":
            return True
        if scope == "subject":
            return True
        if scope == "group":
            return str(student.get("group") or "").strip() == str(identifier or "").strip()
        if scope == "teacher":
            return n_int(identifier) in (student.get("teacherIds") or [n_int(student.get("teacherId"))])
        return False
    return False


@app.route('/api/ranking/list', methods=['GET'])
def ranking_list():
    try:
        scope = str(request.args.get("scope", "overall")).strip() or "overall"
        identifier = request.args.get("identifier", "").strip()
        period = str(request.args.get("period", "overall")).strip() or "overall"
        if period not in PERIOD_MS:
            period = "overall"
        if scope not in ("overall", "subject", "group", "teacher"):
            scope = "overall"
        page = max(1, n_int(request.args.get("page", 1)))
        per_page = max(1, min(200, n_int(request.args.get("perPage", 50))))
        viewer_role = str(request.args.get("viewerRole", "")).strip() or None
        viewer_id = n_int(request.args.get("viewerId")) or None

        data = _load_and_normalize()
        subjects = data.get("subjects") or DEFAULT_SUBJECTS
        txs = data.get("transactions") or []

        if scope in ("teacher", "group"):
            if not identifier:
                return jsonify({"status": "error", "message": "identifier kerak"}), 400
        if scope == "subject":
            if not identifier:
                return jsonify({"status": "error", "message": "subject identifier kerak"}), 400
            if not any(str(s.get("id")) == str(identifier) for s in subjects):
                return jsonify({"status": "error", "message": "Fan topilmadi"}), 404

        if viewer_role and viewer_id:
            if not _has_access(scope, identifier, viewer_role, viewer_id, data):
                return jsonify({"status": "error", "message": "Ruxsat berilmagan"}), 403

        ck = _cache_key(scope, identifier, period)
        cached = _cache_get(ck)
        if cached and cached.get("page") == page and cached.get("perPage") == per_page:
            return jsonify({"status": "success", "cached": True, **cached})

        filtered = _filter_students(data, scope, identifier, viewer_role, viewer_id)
        result = _rank_students(filtered, period, txs, scope, identifier, subjects, page=page, per_page=per_page)
        response = {
            "scope": scope,
            "identifier": identifier,
            "period": period,
            "total": result["total"],
            "page": result["page"],
            "perPage": result["perPage"],
            "pages": result["pages"],
            "items": result["items"],
        }
        _cache_set(ck, response)
        return jsonify({"status": "success", "cached": False, **response})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


@app.route('/api/ranking/overview/student/<int:student_id>', methods=['GET'])
def ranking_student_overview(student_id):
    try:
        viewer_role = str(request.args.get("viewerRole", "")).strip() or None
        viewer_id = n_int(request.args.get("viewerId")) or None
        data = _load_and_normalize()
        subjects = data.get("subjects") or DEFAULT_SUBJECTS
        txs = data.get("transactions") or []
        target = find_account(data, "student", student_id)
        if not target:
            return jsonify({"status": "error", "message": "Talaba topilmadi"}), 404
        if viewer_role and viewer_id:
            if viewer_role == "admin":
                pass
            elif viewer_role == "teacher":
                tid = n_int(viewer_id)
                if tid not in (target.get("teacherIds") or [n_int(target.get("teacherId"))]):
                    return jsonify({"status": "error", "message": "Ruxsat berilmagan"}), 403
            elif viewer_role == "student":
                if n_int(viewer_id) != n_int(student_id):
                    return jsonify({"status": "error", "message": "Ruxsat berilmagan"}), 403
            else:
                return jsonify({"status": "error", "message": "Ruxsat berilmagan"}), 403
        ck = f"overview:student:{student_id}"
        cached = _cache_get(ck)
        if cached:
            return jsonify({"status": "success", "cached": True, **cached})
        overview = _student_rank_overview(data, student_id, txs, subjects)
        if not overview:
            return jsonify({"status": "error", "message": "Talaba topilmadi"}), 404
        _cache_set(ck, overview)
        return jsonify({"status": "success", "cached": False, **overview})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


@app.route('/api/ranking/teacher/<int:teacher_id>', methods=['GET'])
def ranking_teacher_students(teacher_id):
    try:
        viewer_role = str(request.args.get("viewerRole", "")).strip() or None
        viewer_id = n_int(request.args.get("viewerId")) or None
        data = _load_and_normalize()
        subjects = data.get("subjects") or DEFAULT_SUBJECTS
        txs = data.get("transactions") or []
        teacher = find_account(data, "teacher", teacher_id)
        if not teacher:
            return jsonify({"status": "error", "message": "O'qituvchi topilmadi"}), 404
        if viewer_role and viewer_id:
            if viewer_role == "admin":
                pass
            elif viewer_role == "teacher":
                if n_int(viewer_id) != n_int(teacher_id):
                    return jsonify({"status": "error", "message": "Ruxsat berilmagan"}), 403
            else:
                return jsonify({"status": "error", "message": "Ruxsat berilmagan"}), 403
        ck = f"overview:teacher:{teacher_id}"
        cached = _cache_get(ck)
        if cached:
            return jsonify({"status": "success", "cached": True, "teacherId": teacher_id, "students": cached})
        rows = _teacher_students_rank(data, teacher_id, txs, subjects)
        _cache_set(ck, rows)
        return jsonify({"status": "success", "cached": False, "teacherId": teacher_id, "students": rows})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


@app.route('/api/ranking/meta', methods=['GET'])
def ranking_meta():
    try:
        data = _load_and_normalize()
        subjects = [{"id": s.get("id"), "name": s.get("name"), "icon": s.get("icon"), "color": s.get("color")} for s in (data.get("subjects") or DEFAULT_SUBJECTS)]
        group_names = sorted({str(s.get("group") or "").strip() for s in (data.get("students") or []) if str(s.get("group") or "").strip()})
        groups = [{"name": g, "teacherId": next((n_int(x.get("teacherId")) for x in (data.get("groups") or []) if str(x.get("name") or "").strip() == g), None)} for g in group_names]
        teacher_list = [{"id": t.get("id"), "name": t.get("name"), "subject": t.get("subject"), "group": t.get("group")} for t in (data.get("teachers") or [])]
        periods = [
            {"id": "daily", "name": "Kunlik"},
            {"id": "weekly", "name": "Haftalik"},
            {"id": "monthly", "name": "Oylik"},
            {"id": "overall", "name": "Barcha vaqt"},
        ]
        scopes = [
            {"id": "overall", "name": "Umumiy"},
            {"id": "subject", "name": "Fan"},
            {"id": "group", "name": "Guruh"},
            {"id": "teacher", "name": "O'qituvchi"},
        ]
        return jsonify({
            "status": "success",
            "scopes": scopes,
            "periods": periods,
            "subjects": subjects,
            "groups": groups,
            "teachers": teacher_list,
        })
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


@app.route('/api/ranking/invalidate', methods=['POST'])
def ranking_invalidate():
    try:
        viewer_role = str(request.args.get("viewerRole", "")).strip() or (request.get_json(silent=True) or {}).get("viewerRole", "")
        if viewer_role and viewer_role != "admin":
            return jsonify({"status": "error", "message": "Faqat adminlar"}), 403
        invalidate_ranking_cache()
        return jsonify({"status": "success"})
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


PERIOD_MS = {
    "daily": 86400000,
    "weekly": 7 * 86400000,
    "monthly": 30 * 86400000,
    "overall": None,
}


def _tx_score_for_period(txs, student_id, period, teacher_id=None, subject_id=None):
    if period == "overall":
        return None
    now_ms = int(time.time() * 1000)
    window = PERIOD_MS.get(period)
    if not window:
        return None
    cutoff = now_ms - window
    total = 0
    for t in txs:
        if n_int(t.get("studentId")) != n_int(student_id):
            continue
        if teacher_id is not None and n_int(t.get("teacherId")) != n_int(teacher_id):
            continue
        if n_int(t.get("timestamp", 0)) < cutoff:
            continue
        ttype = str(t.get("type", "")).lower()
        if ttype == "purchase":
            continue
        total += n_int(t.get("coins")) if "coins" in t else n_int(t.get("amount"))
    return total


def _score_student(student, period, txs, scope="overall", identifier=None, subjects=None):
    sid = n_int(student.get("id"))
    if scope == "overall":
        p_score = _tx_score_for_period(txs, sid, period)
        if p_score is not None:
            return p_score
        return n_int(student.get("totalCoins"))
    if scope == "teacher":
        tid = n_int(identifier)
        p_score = _tx_score_for_period(txs, sid, period, teacher_id=tid)
        if p_score is not None:
            return p_score
        coins = student.get("coins") or {}
        return n_int(coins.get(str(tid))) if isinstance(coins, dict) else n_int(coins)
    if scope == "subject":
        subj_id = str(identifier or "")
        subj_scores = student.get("subjectScores") or {}
        s = subj_scores.get(subj_id, {}) if isinstance(subj_scores, dict) else {}
        base = n_int(s.get("score")) if isinstance(s, dict) else 0
        if period == "overall":
            return base
        trend_boost = 0
        p_score = _tx_score_for_period(txs, sid, period)
        if p_score is not None:
            trend_boost = p_score
        return base + trend_boost
    if scope == "group":
        p_score = _tx_score_for_period(txs, sid, period)
        if p_score is not None:
            return p_score
        return n_int(student.get("totalCoins"))
    return n_int(student.get("totalCoins"))


def _filter_students(data, scope, identifier, role, viewer_id):
    students = data.get("students", []) or []
    if scope == "teacher":
        tid = n_int(identifier)
        return [s for s in students if tid in (s.get("teacherIds") or [n_int(s.get("teacherId"))])]
    if scope == "group":
        gname = str(identifier or "").strip()
        return [s for s in students if str(s.get("group") or "").strip() == gname]
    if scope == "subject":
        return list(students)
    if scope == "overall":
        return list(students)
    return list(students)


def _rank_students(filtered, period, txs, scope, identifier, subjects, page=1, per_page=50):
    scored = []
    for s in filtered:
        score = _score_student(s, period, txs, scope, identifier, subjects)
        scored.append({
            "id": n_int(s.get("id")),
            "name": str(s.get("name", "")),
            "firstName": str(s.get("firstName", "")),
            "lastName": str(s.get("lastName", "")),
            "username": str(s.get("username", "")),
            "avatar": s.get("avatar"),
            "score": score,
            "level": n_int(s.get("level")),
            "badge": str(s.get("badge", "")),
            "group": str(s.get("group", "")),
            "teacherIds": s.get("teacherIds") or [n_int(s.get("teacherId"))],
            "totalCoins": n_int(s.get("totalCoins")),
            "subjectScores": s.get("subjectScores") or {},
            "progress": s.get("progress") or {},
            "activity": s.get("activity") or {},
            "achievements": s.get("achievements") or [],
            "rank": 0,
        })
    scored.sort(key=lambda x: (x["score"], x["totalCoins"]), reverse=True)
    rank = 1
    prev_score = None
    for i, it in enumerate(scored):
        if prev_score is not None and it["score"] != prev_score:
            rank = i + 1
        it["rank"] = rank
        prev_score = it["score"]
    total = len(scored)
    start = (page - 1) * per_page
    end = start + per_page
    return {
        "total": total,
        "page": page,
        "perPage": per_page,
        "pages": (total + per_page - 1) // per_page if per_page else 1,
        "items": scored[start:end],
        "allIds": [x["id"] for x in scored],
    }


def _student_rank_overview(data, student_id, txs, subjects):
    student = find_account(data, "student", student_id)
    if not student:
        return None
    sid = n_int(student.get("id"))
    group_name = str(student.get("group") or "").strip()
    teacher_ids = student.get("teacherIds") or [n_int(student.get("teacherId"))]
    overview = {
        "studentId": sid,
        "overall": {},
        "group": {},
        "teachers": {},
        "subjects": {},
    }
    for period in ("daily", "weekly", "monthly", "overall"):
        all_s = _filter_students(data, "overall", None, None, None)
        ranked = _rank_students(all_s, period, txs, "overall", None, subjects, page=1, per_page=10**6)
        overview["overall"][period] = next((x["rank"] for x in ranked["items"] if x["id"] == sid), 0)
        overview["overall"][period + "_total"] = ranked["total"]
        if group_name:
            grp_s = _filter_students(data, "group", group_name, None, None)
            grp_r = _rank_students(grp_s, period, txs, "group", group_name, subjects, page=1, per_page=10**6)
            overview["group"][period] = next((x["rank"] for x in grp_r["items"] if x["id"] == sid), 0)
            overview["group"][period + "_total"] = grp_r["total"]
        for tid in teacher_ids:
            t_s = _filter_students(data, "teacher", tid, None, None)
            t_r = _rank_students(t_s, period, txs, "teacher", tid, subjects, page=1, per_page=10**6)
            overview["teachers"][str(tid)] = overview["teachers"].get(str(tid), {})
            overview["teachers"][str(tid)][period] = next((x["rank"] for x in t_r["items"] if x["id"] == sid), 0)
            overview["teachers"][str(tid)][period + "_total"] = t_r["total"]
    subject_list = subjects or []
    for subj in subject_list:
        subj_id = str(subj.get("id", ""))
        subj_s = _filter_students(data, "subject", subj_id, None, None)
        subj_r = _rank_students(subj_s, "overall", txs, "subject", subj_id, subjects, page=1, per_page=10**6)
        overview["subjects"][subj_id] = {
            "rank": next((x["rank"] for x in subj_r["items"] if x["id"] == sid), 0),
            "total": subj_r["total"],
            "score": n_int(((student.get("subjectScores") or {}).get(subj_id) or {}).get("score")),
            "name": str(subj.get("name", subj_id)),
            "icon": str(subj.get("icon", "")),
        }
    return overview


def _teacher_students_rank(data, teacher_id, txs, subjects):
    tid = n_int(teacher_id)
    t_students = _filter_students(data, "teacher", tid, None, None)
    ranked_overall = _rank_students(t_students, "overall", txs, "teacher", tid, subjects, page=1, per_page=10**6)
    rows = []
    by_id = {x["id"]: x for x in ranked_overall["items"]}
    all_s = _filter_students(data, "overall", None, None, None)
    all_ranked = _rank_students(all_s, "overall", txs, "overall", None, subjects, page=1, per_page=10**6)
    all_by_id = {x["id"]: x for x in all_ranked["items"]}
    group_name_map = {}
    for s in t_students:
        sid = n_int(s.get("id"))
        grp = str(s.get("group") or "").strip()
        if grp and grp not in group_name_map:
            g_s = _filter_students(data, "group", grp, None, None)
            g_r = _rank_students(g_s, "overall", txs, "group", grp, subjects, page=1, per_page=10**6)
            group_name_map[grp] = {x["id"]: x["rank"] for x in g_r["items"]}
        subj_scores = s.get("subjectScores") or {}
        top_subject = None
        top_score = -1
        for subj_id, v in subj_scores.items() if isinstance(subj_scores, dict) else []:
            sc = n_int(v.get("score")) if isinstance(v, dict) else 0
            if sc > top_score:
                top_score = sc
                top_subject = subj_id
        my_rank = by_id.get(sid, {}).get("rank", 0)
        overall_rank = all_by_id.get(sid, {}).get("rank", 0)
        grp_rank = 0
        if grp in group_name_map:
            grp_rank = group_name_map[grp].get(sid, 0)
        rows.append({
            "id": sid,
            "name": str(s.get("name", "")),
            "avatar": s.get("avatar"),
            "score": by_id.get(sid, {}).get("score", 0),
            "totalCoins": n_int(s.get("totalCoins")),
            "level": n_int(s.get("level")),
            "badge": str(s.get("badge", "")),
            "group": grp,
            "progress": (s.get("progress") or {}).get("overall", 0),
            "strongSubjects": (s.get("progress") or {}).get("strongSubjects", []),
            "weakSubjects": (s.get("progress") or {}).get("weakSubjects", []),
            "topSubject": top_subject,
            "subjectScores": subj_scores,
            "lastActive": n_int(((s.get("activity") or {}).get("lastActive"))),
            "streak": n_int(((s.get("activity") or {}).get("streak"))),
            "rankTeacher": my_rank,
            "rankOverall": overall_rank,
            "rankGroup": grp_rank,
            "achievementsCount": len(s.get("achievements") or []),
            "testsTaken": n_int((((s.get("activity") or {}).get("total") or {}).get("tests"))),
        })
    rows.sort(key=lambda x: x["rankTeacher"])
    return rows

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

@app.route('/api/notification/add', methods=['POST'])
def add_notification():
    try:
        req_data = request.get_json(silent=True)
        if not isinstance(req_data, dict):
            return jsonify({"status": "error", "message": "JSON obyekt yuboring"}), 400
        student_id = n_int(req_data.get("studentId"))
        ntype = str(req_data.get("type", "announcement")).strip()
        message = str(req_data.get("message", "")).strip()
        if not student_id or not message:
            return jsonify({"status": "error", "message": "studentId va message kerak"}), 400

        init_data_file()
        with open(DATA_FILE, 'r', encoding='utf-8') as f:
            data = json.load(f)
        data, _ = normalize_data(data)

        nid_counter = n_int(data.get("nextNotificationId", 1))
        notif_def = DEFAULT_NOTIF_TYPES.get(ntype, {"icon": "🔔", "title": "Bildirishnoma"})
        notification = {
            "id": nid_counter,
            "studentId": student_id,
            "type": ntype,
            "icon": notif_def.get("icon", "🔔"),
            "title": notif_def.get("title", "Bildirishnoma"),
            "message": message,
            "read": False,
            "createdAt": int(time.time() * 1000),
            "data": req_data.get("data", {}),
        }
        data.setdefault("notifications", []).append(notification)
        data["nextNotificationId"] = nid_counter + 1

        with open(DATA_FILE, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        return jsonify({"status": "success", "notification": notification})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


@app.route('/api/notification/list/<int:student_id>', methods=['GET'])
def list_notifications(student_id):
    try:
        init_data_file()
        with open(DATA_FILE, 'r', encoding='utf-8') as f:
            data = json.load(f)
        sid = n_int(student_id)
        all_n = [n for n in data.get("notifications", []) if n_int(n.get("studentId")) == sid]
        all_n.sort(key=lambda x: n_int(x.get("createdAt")), reverse=True)
        unread = sum(1 for n in all_n if not n.get("read") is False)
        return jsonify({"status": "success", "notifications": all_n, "unread": unread})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


@app.route('/api/notification/read', methods=['POST'])
def mark_notif_read():
    try:
        req_data = request.get_json(silent=True)
        if not isinstance(req_data, dict):
            return jsonify({"status": "error", "message": "JSON obyekt yuboring"}), 400
        nid = n_int(req_data.get("id"))
        if not nid:
            return jsonify({"status": "error", "message": "id kerak"}), 400
        init_data_file()
        with open(DATA_FILE, 'r', encoding='utf-8') as f:
            data = json.load(f)
        for n in data.get("notifications", []):
            if n_int(n.get("id")) == nid:
                n["read"] = True
                break
        with open(DATA_FILE, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        return jsonify({"status": "success"})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


@app.route('/api/activity/log', methods=['POST'])
def log_activity():
    try:
        req_data = request.get_json(silent=True)
        if not isinstance(req_data, dict):
            return jsonify({"status": "error", "message": "JSON obyekt yuboring"}), 400
        student_id = n_int(req_data.get("studentId"))
        activity_type = str(req_data.get("activityType", "lesson")).strip()
        amount = n_int(req_data.get("amount"), 1)
        if not student_id:
            return jsonify({"status": "error", "message": "studentId kerak"}), 400
        init_data_file()
        with open(DATA_FILE, 'r', encoding='utf-8') as f:
            data = json.load(f)
        data, _ = normalize_data(data)
        log_entry = {
            "studentId": student_id,
            "type": activity_type,
            "amount": amount,
            "timestamp": int(time.time() * 1000),
            "data": req_data.get("data", {}),
        }
        data.setdefault("activity_logs", []).append(log_entry)
        with open(DATA_FILE, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        return jsonify({"status": "success", "log": log_entry})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


@app.route('/api/purchase/buy', methods=['POST'])
def buy_product():
    try:
        req_data = request.get_json(silent=True)
        if not isinstance(req_data, dict):
            return jsonify({"status": "error", "message": "JSON obyekt yuboring"}), 400
        student_id = n_int(req_data.get("studentId"))
        product_id = str(req_data.get("productId", "")).strip()
        payment_method = str(req_data.get("paymentMethod", "coins")).strip()
        if not student_id or not product_id:
            return jsonify({"status": "error", "message": "studentId va productId kerak"}), 400
        init_data_file()
        with open(DATA_FILE, 'r', encoding='utf-8') as f:
            data = json.load(f)
        data, _ = normalize_data(data)
        student = find_account(data, "student", student_id)
        if not student:
            return jsonify({"status": "error", "message": "Talaba topilmadi"}), 404
        product = next((p for p in data.get("products", []) if str(p.get("id")) == product_id), None)
        if not product:
            return jsonify({"status": "error", "message": "Mahsulot topilmadi"}), 404
        teacher_id = n_int(student.get("teacherId"), 1)
        coins_dict = student.get("coins") or {}
        if not isinstance(coins_dict, dict):
            coins_dict = {str(teacher_id): n_int(coins_dict)}
            student["coins"] = coins_dict
        cur_coins = n_int(coins_dict.get(str(teacher_id)))
        price_coins = n_int(product.get("coinsPrice"))
        if payment_method == "coins" and cur_coins < price_coins:
            return jsonify({"status": "error", "message": "Tanga yetarli emas"}), 400
        if payment_method == "coins":
            coins_dict[str(teacher_id)] = cur_coins - price_coins
            student["totalCoins"] = coins_total(coins_dict)
        purchased = student.get("purchasedProducts") or []
        if product_id not in purchased:
            purchased.append(product_id)
            student["purchasedProducts"] = purchased
        for p in data.get("products", []):
            if str(p.get("id")) == product_id:
                p["purchased"] = n_int(p.get("purchased")) + 1
                break
        pid = n_int(data.get("nextPurchaseId", 1))
        purchase = {
            "id": pid,
            "studentId": student_id,
            "productId": product_id,
            "paymentMethod": payment_method,
            "amount": price_coins if payment_method == "coins" else n_int(product.get("price")),
            "createdAt": int(time.time() * 1000),
        }
        data.setdefault("purchases", []).append(purchase)
        data["nextPurchaseId"] = pid + 1
        tx_id = len(data.get("transactions", [])) + 1
        data.setdefault("transactions", []).append({
            "id": tx_id, "studentId": student_id, "teacherId": teacher_id,
            "type": "purchase", "coins": -price_coins if payment_method == "coins" else 0,
            "note": f"Sotib olindi: " + str(product.get("name")),
            "time": int(time.time() * 1000),
        })
        with open(DATA_FILE, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        return jsonify({"status": "success", "purchase": purchase, "student": student})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


@app.route('/api/achievement/check', methods=['POST'])
def check_achievements():
    try:
        req_data = request.get_json(silent=True)
        if not isinstance(req_data, dict):
            return jsonify({"status": "error", "message": "JSON obyekt yuboring"}), 400
        student_id = n_int(req_data.get("studentId"))
        if not student_id:
            return jsonify({"status": "error", "message": "studentId kerak"}), 400
        init_data_file()
        with open(DATA_FILE, 'r', encoding='utf-8') as f:
            data = json.load(f)
        data, _ = normalize_data(data)
        student = find_account(data, "student", student_id)
        if not student:
            return jsonify({"status": "error", "message": "Talaba topilmadi"}), 404
        earned_ids = set(str(a.get("id")) for a in (student.get("achievements") or []))
        new_ach = []
        coins = n_int(student.get("totalCoins"))
        act = student.get("activity") or {}
        tot = act.get("total") or {}
        rank = (student.get("rank") or {}).get("overall", 999)
        stats = {
            "testsCompleted": n_int(tot.get("tests")),
            "streak": n_int(act.get("streak")),
            "totalCoins": coins,
            "tasksCompleted": n_int(tot.get("tasks")),
            "rank": n_int(rank),
            "videosWatched": n_int(tot.get("videos")),
            "vip": bool((student.get("vip") or {}).get("status")),
        }
        for ach_def in data.get("achievements_def", []):
            cond = ach_def.get("condition") or {}
            ach_id = str(ach_def.get("id"))
            if ach_id in earned_ids:
                continue
            ok = True
            for k, v in cond.items():
                sv = stats.get(k)
                if k == "vip":
                    if bool(sv) != bool(v):
                        ok = False
                        break
                else:
                    if k == "rank":
                        if n_int(sv, 999) > n_int(v):
                            ok = False
                            break
                    else:
                        if n_int(sv) < n_int(v):
                            ok = False
                            break
            if ok:
                ach_obj = {"id": ach_id, "icon": ach_def.get("icon"), "name": ach_def.get("name"),
                           "desc": ach_def.get("desc"), "xp": n_int(ach_def.get("xp")),
                           "earnedAt": int(time.time() * 1000)}
                (student.get("achievements") or []).append(ach_obj)
                new_ach.append(ach_obj)
                t_id = len(data.get("transactions", [])) + 1
                data.setdefault("transactions", []).append({
                    "id": t_id, "studentId": student_id,
                    "teacherId": n_int(student.get("teacherId"), 1),
                    "type": "achievement", "coins": n_int(ach_def.get("xp")),
                    "note": "🏆 " + str(ach_def.get("name")),
                    "time": int(time.time() * 1000),
                })
                tid2 = n_int(data.get("nextNotificationId", 1))
                data.setdefault("notifications", []).append({
                    "id": tid2, "studentId": student_id, "type": "achievement",
                    "icon": "🏆", "title": "Yangi yutuq",
                    "message": "Tabriklaymiz! Siz \"%s\" yutuqiga egasiz!" % str(ach_def.get("name")),
                    "read": False, "createdAt": int(time.time() * 1000),
                })
                data["nextNotificationId"] = tid2 + 1
        with open(DATA_FILE, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        return jsonify({"status": "success", "newAchievements": new_ach, "student": student})
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
