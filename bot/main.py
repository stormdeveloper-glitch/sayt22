import asyncio
import json
import os
import threading
from html import escape

from aiogram import Bot, Dispatcher
from aiogram.enums import ButtonStyle
from aiogram.filters import Command
from aiogram.types import CallbackQuery, InlineKeyboardButton, InlineKeyboardMarkup, KeyboardButton, Message, ReplyKeyboardMarkup


BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_DATA_LOCK = threading.Lock()
_BOT_THREAD = None
_COIN_ACTIONS = {}

STUDENT_DEFAULTS = {
    "Bahodirjonov Sardor": {"group": "D2", "coins": 100},
    "Farangiz": {"group": "D1", "coins": 25},
    "Ibrohim": {"group": "D1", "coins": 65},
    "Dadajonova Munavvara": {"group": "D1", "coins": 15},
    "Omonov Alisher": {"group": "D1", "coins": 50},
    "Shavkatova Fotima": {"group": "D1", "coins": 50},
    "Shaxboz": {"group": "D1", "coins": 25},
    "Tolipjonov Asadbek": {"group": "D1", "coins": 26},
    "Tursunaliyev Abdulaziz": {"group": "D1", "coins": 5},
    "Umaraliyev Ozodbek": {"group": "D1", "coins": 50},
    "Abdurazoqova Ra'noxon": {"group": "D1", "coins": 15},
    "Abdulhakimov Sardorbek": {"group": "D1", "coins": 35},
    "Ahmadjonova Shodiyona": {"group": "D1", "coins": 45},
    "Hamidov Abdulahat": {"group": "D1", "coins": 24},
    "Abdumo'minov Muhammadmuhtor": {"group": "D1", "coins": 10},
    "Hasanboyev Muhamqodir": {"group": "D1", "coins": 5},
    "Nurmuhamadov Diyorbek": {"group": "D1", "coins": 10},
    "Mahamadov Ozodbek": {"group": "D1", "coins": 5},
    "Shavkatov Abdulatif": {"group": "D1", "coins": 5},
}


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
DEFAULT_DATA_DIR = "/app/data" if os.path.isdir("/app") else os.path.join(BASE_DIR, "data")
DATA_DIR = os.environ.get("DATA_DIR", DEFAULT_DATA_DIR)
DATA_FILE = os.path.join(DATA_DIR, "data.json")
BOT_TOKEN = os.environ.get("BOT_TOKEN", "").strip()


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
        "groups": [],
        "chatFriends": [],
        "chatGroups": [],
        "pendingReqs": [],
        "pendingTelegramLinks": [],
        "tests": [],
        "telegramProfiles": {},
    }


def normalize_data(data):
    base = default_data()
    if isinstance(data, dict):
        base.update(data)
    for key in ("students", "transactions", "teachers", "admins", "adminRequests", "messages", "groups", "chatFriends", "chatGroups", "pendingReqs", "pendingTelegramLinks", "tests"):
        if not isinstance(base.get(key), list):
            base[key] = []
    if not isinstance(base.get("telegramProfiles"), dict):
        base["telegramProfiles"] = {}
    for student in base["students"]:
        if not isinstance(student, dict):
            continue
        default = STUDENT_DEFAULTS.get(str(student.get("name", "")).strip())
        current_group = str(student.get("group") or "").strip()
        if default and (not current_group or current_group == "Yangi" or (current_group == "D1" and default["group"] != "D1")):
            student["group"] = default["group"] if default else "D1"
        elif not current_group:
            student["group"] = "D1"
        teacher_id = n_int((student.get("teacherIds") or [student.get("teacherId") or 1])[0] if isinstance(student.get("teacherIds"), list) else student.get("teacherId"), 1)
        student.setdefault("teacherId", teacher_id)
        if not isinstance(student.get("teacherIds"), list) or not student.get("teacherIds"):
            student["teacherIds"] = [teacher_id]
        if isinstance(student.get("coins"), dict):
            total = sum(n_int(v) for v in student["coins"].values())
        else:
            total = n_int(student.get("coins")) or n_int(student.get("totalCoins"))
        if total == 0 and default and default["coins"] > 0:
            total = default["coins"]
            student["coins"] = {str(teacher_id): total}
        elif not isinstance(student.get("coins"), dict):
            student["coins"] = {str(teacher_id): total}
        student["totalCoins"] = total
    return base


def init_data_file():
    os.makedirs(DATA_DIR, exist_ok=True)
    if not os.path.exists(DATA_FILE):
        write_data(default_data())


def read_data():
    init_data_file()
    with _DATA_LOCK:
        with open(DATA_FILE, "r", encoding="utf-8") as f:
            return normalize_data(json.load(f))


def write_data(data):
    os.makedirs(DATA_DIR, exist_ok=True)
    normalized = normalize_data(data)
    tmp_file = f"{DATA_FILE}.tmp"
    with _DATA_LOCK:
        with open(tmp_file, "w", encoding="utf-8") as f:
            json.dump(normalized, f, ensure_ascii=False, indent=2)
        os.replace(tmp_file, DATA_FILE)
    return normalized


def n_int(value, default=0):
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def update_badges(data):
    for student in data.get("students", []):
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


def telegram_profile(message: Message):
    user = message.from_user
    full_name = user.full_name if user else ""
    username = user.username if user and user.username else ""
    return {
        "telegramId": message.chat.id,
        "telegramName": full_name,
        "telegramUsername": username,
        "telegramPhotoFileId": "",
        "telegramPhotoUrl": "",
    }


def apply_profile_to_linked_accounts(data, profile):
    telegram_id = n_int(profile.get("telegramId"))
    if not telegram_id:
        return
    for collection in ("students", "teachers", "admins"):
        for item in data.get(collection, []):
            if n_int(item.get("telegramId")) != telegram_id:
                continue
            item["telegramName"] = profile.get("telegramName", "")
            item["telegramUsername"] = profile.get("telegramUsername", "")
            item["telegramPhotoFileId"] = profile.get("telegramPhotoFileId", "")
            item["telegramPhotoUrl"] = profile.get("telegramPhotoUrl", "")


def save_profile(message: Message):
    data = read_data()
    profile = telegram_profile(message)
    data.setdefault("telegramProfiles", {})[str(message.chat.id)] = profile
    apply_profile_to_linked_accounts(data, profile)
    write_data(data)
    return data


def linked_students(data, telegram_id):
    return [s for s in data["students"] if n_int(s.get("telegramId")) == telegram_id]


def linked_teachers(data, telegram_id):
    return [t for t in data["teachers"] if n_int(t.get("telegramId")) == telegram_id]


def linked_admins(data, telegram_id):
    return [a for a in data["admins"] if n_int(a.get("telegramId")) == telegram_id and a.get("status") == "active"]


def is_super_admin(data, telegram_id):
    return any(str(a.get("role") or a.get("level") or "").lower() == "super" for a in linked_admins(data, telegram_id))


def main_keyboard(data, telegram_id):
    rows = [
        [KeyboardButton(text="Profil", style=ButtonStyle.PRIMARY), KeyboardButton(text="Reyting", style=ButtonStyle.PRIMARY)],
        [KeyboardButton(text="Telegram ID", style=ButtonStyle.PRIMARY), KeyboardButton(text="Tanga berish", style=ButtonStyle.SUCCESS)],
        [KeyboardButton(text="Tanga ayirish", style=ButtonStyle.DANGER)],
    ]
    if is_super_admin(data, telegram_id):
        rows.insert(0, [KeyboardButton(text="Boshqaruv", style=ButtonStyle.PRIMARY)])
    return ReplyKeyboardMarkup(keyboard=rows, resize_keyboard=True, input_field_placeholder="Tugmalardan tanlang")


def admin_panel_keyboard():
    return InlineKeyboardMarkup(inline_keyboard=[
        [
            InlineKeyboardButton(text="Statistika", callback_data="adm:stats", style=ButtonStyle.PRIMARY),
            InlineKeyboardButton(text="Talabalar", callback_data="adm:students", style=ButtonStyle.PRIMARY),
        ],
        [
            InlineKeyboardButton(text="Ulanishlar", callback_data="adm:links", style=ButtonStyle.SUCCESS),
            InlineKeyboardButton(text="Reyting", callback_data="adm:rating", style=ButtonStyle.PRIMARY),
        ],
    ])


def account_counts(data):
    return (
        len(data.get("students", [])),
        len(data.get("teachers", [])),
        len(data.get("admins", [])),
        sum(n_int(s.get("totalCoins")) for s in data.get("students", [])),
    )


def find_account(data, role, account_id):
    collection = {"student": "students", "teacher": "teachers", "admin": "admins"}.get(role)
    if not collection:
        return None
    aid = n_int(account_id)
    return next((item for item in data.get(collection, []) if n_int(item.get("id")) == aid), None)


def pending_link_for_chat(data, telegram_id, token=None):
    pending = [
        item for item in data.get("pendingTelegramLinks", [])
        if item.get("status") == "pending" and n_int(item.get("telegramId")) == n_int(telegram_id)
    ]
    if token:
        return next((item for item in pending if item.get("token") == token), None)
    return pending[-1] if pending else None


def finish_pending_link(telegram_id, approve=True, token=None):
    data = read_data()
    pending = pending_link_for_chat(data, telegram_id, token)
    if not pending:
        return False, "Faol ulash so'rovi topilmadi."
    account = find_account(data, pending.get("role"), pending.get("accountId"))
    if not account:
        pending["status"] = "missing"
        write_data(data)
        return False, "Profil topilmadi."
    if approve:
        profile = data.get("telegramProfiles", {}).get(str(telegram_id), {})
        account["telegramId"] = n_int(telegram_id)
        account["telegramLinkedAt"] = int(__import__("time").time() * 1000)
        account["telegramName"] = profile.get("telegramName", "")
        account["telegramUsername"] = profile.get("telegramUsername", "")
        pending["status"] = "approved"
        msg = f"✅ Telegram profilingiz {account.get('name', '')} bilan ulandi."
    else:
        pending["status"] = "rejected"
        msg = "❌ Telegram ulash so'rovi rad etildi."
    pending["answeredAt"] = int(__import__("time").time() * 1000)
    write_data(data)
    return True, msg


def student_teacher_ids(student):
    ids = set()
    for value in student.get("teacherIds") or []:
        tid = n_int(value)
        if tid:
            ids.add(tid)
    tid = n_int(student.get("teacherId"))
    if tid:
        ids.add(tid)
    return ids


def visible_students(data, telegram_id):
    students = data["students"]
    teachers = linked_teachers(data, telegram_id)
    admins = linked_admins(data, telegram_id)
    own_students = linked_students(data, telegram_id)
    if admins:
        return students
    if teachers:
        teacher_ids = {n_int(t.get("id")) for t in teachers}
        return [s for s in students if student_teacher_ids(s) & teacher_ids]
    if own_students:
        teacher_ids = set()
        for student in own_students:
            teacher_ids.update(student_teacher_ids(student))
        return [s for s in students if student_teacher_ids(s) & teacher_ids]
    return []


def can_manage_student(data, telegram_id, student):
    if linked_admins(data, telegram_id):
        return True
    teacher_ids = {n_int(t.get("id")) for t in linked_teachers(data, telegram_id)}
    return bool(student_teacher_ids(student) & teacher_ids)


def student_by_id(data, student_id):
    sid = n_int(student_id)
    return next((s for s in data["students"] if n_int(s.get("id")) == sid), None)


def earned(data, student_id, mode):
    sid = n_int(student_id)
    now_ms = int(__import__("time").time() * 1000)
    if mode == "weekly":
        start = now_ms - 7 * 86400 * 1000
    elif mode == "monthly":
        start = now_ms - 30 * 86400 * 1000
    else:
        student = student_by_id(data, sid)
        return n_int(student.get("totalCoins")) if student else 0
    return sum(
        n_int(t.get("amount"))
        for t in data["transactions"]
        if n_int(t.get("studentId")) == sid and n_int(t.get("timestamp")) >= start
    )


def add_coin(data, student, amount, reason, details, telegram_id):
    amount = n_int(amount)
    teacher_id = next(iter(student_teacher_ids(student) or {1}))
    if not isinstance(student.get("coins"), dict):
        student["coins"] = {str(teacher_id): n_int(student.get("totalCoins"))}
    student["coins"][str(teacher_id)] = n_int(student["coins"].get(str(teacher_id))) + amount
    student["totalCoins"] = sum(n_int(v) for v in student["coins"].values())
    data["transactions"].insert(
        0,
        {
            "id": int(__import__("time").time() * 1000),
            "studentId": n_int(student.get("id")),
            "teacherId": None,
            "adminId": None,
            "amount": amount,
            "reason": reason,
            "timestamp": int(__import__("time").time() * 1000),
            "details": details,
            "telegramBy": telegram_id,
        },
    )
    update_badges(data)
    write_data(data)


def apply_coin_change(data, telegram_id, student_id, amount, reason, sign):
    student = student_by_id(data, student_id)
    amount = n_int(amount)
    reason = str(reason or "").strip()
    if not student or amount <= 0 or not reason:
        return False, "Talaba ID, miqdor yoki sabab noto'g'ri."
    if not can_manage_student(data, telegram_id, student):
        return False, "Bu talabaga tanga berish/ayirish huquqi yo'q."
    signed_amount = amount * sign
    details = reason if sign > 0 else f"Ayrildi: {reason}"
    add_coin(data, student, signed_amount, "telegram_plus" if sign > 0 else "telegram_minus", details, telegram_id)
    return True, (
        f"{escape(str(student.get('name', 'Talaba')))}: {signed_amount:+d}\n"
        f"Yangi balans: <b>{n_int(student.get('totalCoins'))}</b>"
    )


def format_student(student, data):
    sid = n_int(student.get("id"))
    return (
        f"<b>{escape(str(student.get('name', 'Talaba')))}</b>\n"
        f"ID: <code>{sid}</code>\n"
        f"Tanga: <b>{n_int(student.get('totalCoins'))}</b>\n"
        f"Daraja: {n_int(student.get('level'), 1)}\n"
        f"Nishon: {escape(str(student.get('badge', 'Starter')))}\n"
        f"Haftalik: {earned(data, sid, 'weekly')}\n"
        f"Oylik: {earned(data, sid, 'monthly')}"
    )


dp = Dispatcher()


@dp.message(Command("start"))
async def cmd_start(message: Message):
    data = save_profile(message)
    args = message.text.split(maxsplit=1)
    start_arg = args[1].strip() if len(args) > 1 else ""
    if start_arg.startswith("reset_"):
        student = student_by_id(data, start_arg.replace("reset_", "", 1))
        if student:
            await message.answer(
                f"<b>{escape(str(student.get('name', 'Talaba')))}</b>\n"
                f"Login ID: <code>{n_int(student.get('id'))}</code>\n"
                f"Parol: <code>{escape(str(student.get('password') or student.get('pass') or ''))}</code>",
                parse_mode="HTML",
            )
            return
        await message.answer("Bu ID bo'yicha talaba topilmadi.")
        return
    students = linked_students(data, message.chat.id)
    teachers = linked_teachers(data, message.chat.id)
    admins = linked_admins(data, message.chat.id)
    lines = [
        "Bot ulandi.",
        f"Telegram ID: <code>{message.chat.id}</code>",
        "",
        "Saytdagi profilga shu ID ni kiriting va botda tasdiqlang.",
    ]
    if students or teachers or admins:
        lines.append("")
        lines.append("Ulangan profillar:")
        lines.extend(f"Talaba: {escape(str(s.get('name', '')))}" for s in students)
        lines.extend(f"O'qituvchi: {escape(str(t.get('name', '')))}" for t in teachers)
        lines.extend(f"Admin: {escape(str(a.get('name', '')))}" for a in admins)
    lines.append("")
    lines.append("Pastdagi tugmalar orqali boshqaring.")
    await message.answer("\n".join(lines), parse_mode="HTML", reply_markup=main_keyboard(data, message.chat.id))


@dp.message(Command("id"))
async def cmd_id(message: Message):
    data = save_profile(message)
    await message.answer(f"Sizning Telegram ID: <code>{message.chat.id}</code>", parse_mode="HTML", reply_markup=main_keyboard(data, message.chat.id))


@dp.callback_query(lambda c: c.data and (c.data.startswith("tgok:") or c.data.startswith("tgno:")))
async def cb_telegram_link(query: CallbackQuery):
    action, token = query.data.split(":", 1)
    ok, msg = finish_pending_link(query.from_user.id, approve=(action == "tgok"), token=token)
    data = read_data()
    await query.answer("Bajarildi" if ok else "Topilmadi", show_alert=not ok)
    await query.message.answer(msg, reply_markup=main_keyboard(data, query.from_user.id))


@dp.message(lambda message: (message.text or "").strip() in {"Tasdiqlash", "Rad etish", "🟢 Tasdiqlash", "🔴 Rad etish", "✅ Tasdiqlash", "❌ Rad etish"})
async def reply_telegram_link(message: Message):
    save_profile(message)
    approve = message.text.strip() == "Tasdiqlash" or message.text.strip().startswith(("🟢", "✅"))
    _, msg = finish_pending_link(message.chat.id, approve=approve)
    data = read_data()
    await message.answer(msg, reply_markup=main_keyboard(data, message.chat.id))


@dp.message(Command("me"))
async def cmd_me(message: Message):
    data = save_profile(message)
    students = linked_students(data, message.chat.id)
    if students:
        await message.answer("\n\n".join(format_student(s, data) for s in students), parse_mode="HTML", reply_markup=main_keyboard(data, message.chat.id))
        return
    teachers = linked_teachers(data, message.chat.id)
    admins = linked_admins(data, message.chat.id)
    if teachers or admins:
        visible = visible_students(data, message.chat.id)
        total = sum(n_int(s.get("totalCoins")) for s in visible)
        await message.answer(
            f"Profil ulangan.\nTalabalar: <b>{len(visible)}</b>\nJami tanga: <b>{total}</b>\n\n"
            "Tanga uchun pastdagi ➕ / ➖ tugmalaridan foydalaning.",
            parse_mode="HTML",
            reply_markup=main_keyboard(data, message.chat.id),
        )
        return
    await message.answer("Profil ulanmagan. 🆔 Telegram ID ni olib, saytdagi profilingizga kiriting.", reply_markup=main_keyboard(data, message.chat.id))


@dp.message(Command("reyting"))
async def cmd_rating(message: Message):
    data = save_profile(message)
    args = message.text.split(maxsplit=1)
    mode_raw = args[1].strip().lower() if len(args) > 1 else "overall"
    mode = {"hafta": "weekly", "weekly": "weekly", "oy": "monthly", "monthly": "monthly"}.get(mode_raw, "overall")
    students = visible_students(data, message.chat.id)
    if not students:
        await message.answer("Reyting uchun profil ulanmagan.", reply_markup=main_keyboard(data, message.chat.id))
        return
    ranked = sorted(students, key=lambda s: earned(data, n_int(s.get("id")), mode), reverse=True)[:10]
    title = {"weekly": "Haftalik", "monthly": "Oylik", "overall": "Umumiy"}[mode]
    lines = [f"<b>{title} reyting</b>"]
    for index, student in enumerate(ranked, 1):
        score = earned(data, n_int(student.get("id")), mode)
        lines.append(f"{index}. {escape(str(student.get('name', '')))} - <b>{score}</b> ID:{n_int(student.get('id'))}")
    await message.answer("\n".join(lines), parse_mode="HTML", reply_markup=main_keyboard(data, message.chat.id))


async def coin_command(message: Message, sign: int):
    data = save_profile(message)
    parts = message.text.split(maxsplit=3)
    if len(parts) < 4:
        sample = "/plus 12 10 yaxshi javob" if sign > 0 else "/minus 12 10 kechikdi"
        await message.answer(f"Format: <code>{sample}</code>", parse_mode="HTML", reply_markup=main_keyboard(data, message.chat.id))
        return
    ok, answer = apply_coin_change(data, message.chat.id, parts[1], parts[2], parts[3], sign)
    await message.answer(answer, parse_mode="HTML", reply_markup=main_keyboard(read_data(), message.chat.id))


@dp.message(Command("plus"))
async def cmd_plus(message: Message):
    await coin_command(message, 1)


@dp.message(Command("minus"))
async def cmd_minus(message: Message):
    await coin_command(message, -1)


@dp.message(Command("help"))
async def cmd_help(message: Message):
    data = save_profile(message)
    await message.answer(
        "Pastdagi tugmalar orqali botni boshqaring.\n\n"
        "➕ yoki ➖ bosilgandan keyin format:\n"
        "<code>student_id miqdor sabab</code>\n"
        "Masalan: <code>12 10 yaxshi javob</code>",
        parse_mode="HTML",
        reply_markup=main_keyboard(data, message.chat.id),
    )


@dp.callback_query(lambda c: c.data and c.data.startswith("adm:"))
async def cb_admin_panel(query: CallbackQuery):
    data = read_data()
    if not is_super_admin(data, query.from_user.id):
        await query.answer("Faqat super admin uchun", show_alert=True)
        return
    action = query.data.split(":", 1)[1]
    if action == "stats":
        st_count, teacher_count, admin_count, total = account_counts(data)
        text = (
            "<b>🛡️ Boshqaruv statistikasi</b>\n\n"
            f"👥 Talabalar: <b>{st_count}</b>\n"
            f"👨‍🏫 O'qituvchilar: <b>{teacher_count}</b>\n"
            f"🛡️ Adminlar: <b>{admin_count}</b>\n"
            f"🪙 Jami tanga: <b>{total}</b>"
        )
    elif action == "students":
        top = sorted(data.get("students", []), key=lambda s: n_int(s.get("totalCoins")), reverse=True)[:15]
        text = "<b>👥 Talabalar</b>\n\n" + ("\n".join(
            f"{i}. {escape(str(s.get('name', '')))} | ID:{n_int(s.get('id'))} | {escape(str(s.get('group', 'D1')))} | {n_int(s.get('totalCoins'))}🪙"
            for i, s in enumerate(top, 1)
        ) or "Talaba yo'q")
    elif action == "links":
        pending = [x for x in data.get("pendingTelegramLinks", []) if x.get("status") == "pending"]
        text = "<b>🔗 Kutilayotgan ulanishlar</b>\n\n" + ("\n".join(
            f"- {escape(str(x.get('name', '')))} | {escape(str(x.get('role', '')))} | TG:{n_int(x.get('telegramId'))}"
            for x in pending[-15:]
        ) or "Kutilayotgan ulanish yo'q")
    else:
        ranked = sorted(visible_students(data, query.from_user.id), key=lambda s: n_int(s.get("totalCoins")), reverse=True)[:10]
        text = "<b>🏆 Reyting</b>\n\n" + ("\n".join(
            f"{i}. {escape(str(s.get('name', '')))} - <b>{n_int(s.get('totalCoins'))}</b>"
            for i, s in enumerate(ranked, 1)
        ) or "Reyting bo'sh")
    await query.answer()
    await query.message.answer(text, parse_mode="HTML", reply_markup=admin_panel_keyboard())


@dp.message(lambda message: (message.text or "").strip() in {"Menu", "Profil", "Reyting", "Telegram ID", "Boshqaruv", "Tanga berish", "Tanga ayirish", "🏠 Menu", "👤 Profil", "🏆 Reyting", "🆔 Telegram ID", "🛡️ Boshqaruv", "➕ Tanga berish", "➖ Tanga ayirish", "🔵 Profil", "🔵 Reyting", "🔵 Telegram ID", "🔵 Boshqaruv", "🟢 Tanga berish", "🔴 Tanga ayirish"})
async def button_router(message: Message):
    text = (message.text or "").strip()
    data = save_profile(message)
    if text == "🏠 Menu":
        await cmd_start(message)
        return
    if text in {"Profil", "👤 Profil", "🔵 Profil"}:
        await cmd_me(message)
        return
    if text in {"Reyting", "🏆 Reyting", "🔵 Reyting"}:
        await cmd_rating(message)
        return
    if text in {"Telegram ID", "🆔 Telegram ID", "🔵 Telegram ID"}:
        await cmd_id(message)
        return
    if text in {"Boshqaruv", "🛡️ Boshqaruv", "🔵 Boshqaruv"}:
        if not is_super_admin(data, message.chat.id):
            await message.answer("Bu panel faqat super admin uchun.", reply_markup=main_keyboard(data, message.chat.id))
            return
        st_count, teacher_count, admin_count, total = account_counts(data)
        await message.answer(
            "<b>🛡️ Super admin panel</b>\n\n"
            f"👥 Talabalar: <b>{st_count}</b>\n"
            f"👨‍🏫 O'qituvchilar: <b>{teacher_count}</b>\n"
            f"🛡️ Adminlar: <b>{admin_count}</b>\n"
            f"🪙 Jami tanga: <b>{total}</b>",
            parse_mode="HTML",
            reply_markup=admin_panel_keyboard(),
        )
        return
    sign = 1 if text == "Tanga berish" or text.startswith(("➕", "🟢")) else -1
    if not (linked_teachers(data, message.chat.id) or linked_admins(data, message.chat.id)):
        await message.answer("Tanga boshqaruvi faqat o'qituvchi/admin uchun.", reply_markup=main_keyboard(data, message.chat.id))
        return
    _COIN_ACTIONS[message.chat.id] = sign
    await message.answer(
        ("🟢 Tanga berish" if sign > 0 else "🔴 Tanga ayirish") + "\n\n"
        "Buyruqsiz yuboring:\n<code>student_id miqdor sabab</code>\n"
        "Masalan: <code>12 10 yaxshi javob</code>",
        parse_mode="HTML",
        reply_markup=main_keyboard(data, message.chat.id),
    )


@dp.message()
async def cmd_fallback(message: Message):
    text = (message.text or "").strip().lower()
    if text in {"start", "/start", "boshlash", "salom", "assalomu alaykum", "assalom"}:
        await cmd_start(message)
        return
    data = save_profile(message)
    if message.chat.id in _COIN_ACTIONS:
        sign = _COIN_ACTIONS.pop(message.chat.id)
        parts = (message.text or "").split(maxsplit=2)
        if len(parts) < 3:
            await message.answer("Format: <code>student_id miqdor sabab</code>", parse_mode="HTML", reply_markup=main_keyboard(data, message.chat.id))
            return
        ok, answer = apply_coin_change(data, message.chat.id, parts[0], parts[1], parts[2], sign)
        await message.answer(answer, parse_mode="HTML", reply_markup=main_keyboard(read_data(), message.chat.id))
        return
    await message.answer(
        "Men Teacher_texno botiman.\n\n"
        "Pastdagi tugmalar orqali boshqaring.",
        reply_markup=main_keyboard(data, message.chat.id),
    )


async def run_bot():
    if not BOT_TOKEN:
        print("[BOT] BOT_TOKEN env ichida topilmadi")
        return
    bot = Bot(BOT_TOKEN)
    try:
        await bot.delete_webhook(drop_pending_updates=True)
        print("[BOT] Polling boshlandi")
        await dp.start_polling(bot, handle_signals=False)
    finally:
        await bot.session.close()


def start_bot_thread():
    global _BOT_THREAD
    if _BOT_THREAD and _BOT_THREAD.is_alive():
        return _BOT_THREAD
    _BOT_THREAD = threading.Thread(target=lambda: asyncio.run(run_bot()), daemon=True)
    _BOT_THREAD.start()
    return _BOT_THREAD


if __name__ == "__main__":
    asyncio.run(run_bot())
