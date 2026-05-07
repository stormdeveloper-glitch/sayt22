import os
import json
import uuid
from werkzeug.utils import secure_filename
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS

# static_folder='.' loyiha ichidagi barcha fayllarni (index.html, teacher.jpg) ko'rinadigan qiladi
app = Flask(__name__, static_folder='.', static_url_path='')
CORS(app)

# Railway Volume ulangan joy.
# Agar DATA_DIR berilmagan bo'lsa, lokalda loyiha ichidagi data papkasi ishlatiladi.
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.environ.get('DATA_DIR', os.path.join(BASE_DIR, 'data'))
DATA_FILE = os.path.join(DATA_DIR, 'data.json')
UPLOAD_DIR = os.path.join(BASE_DIR, 'uploads')
os.makedirs(UPLOAD_DIR, exist_ok=True)

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
                "messages": []
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
        init_data_file()
        with open(DATA_FILE, 'w', encoding='utf-8') as f:
            json.dump(req_data, f, ensure_ascii=False, indent=2)
        return jsonify({"status": "success", "message": "Ma'lumot saqlandi"})
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

if __name__ == '__main__':
    init_data_file()
    # Railway beradigan 8080 yoki boshqa portda ishga tushadi
    port = int(os.environ.get('PORT', 8080))
    app.run(host='0.0.0.0', port=port)
