import os
import json
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS

# static_folder='.' loyiha ichidagi barcha fayllarni (index.html, teacher.jpg) ko'rinadigan qiladi
app = Flask(__name__, static_folder='.', static_url_path='')
CORS(app)

# Railway Volume ulangan joy
DATA_DIR = os.environ.get('DATA_DIR', '/app/data')
DATA_FILE = os.path.join(DATA_DIR, 'data.json')

def init_data_file():
    """Fayl mavjud bo'lmasa, bazani yaratadi"""
    if not os.path.exists(DATA_DIR):
        os.makedirs(DATA_DIR, exist_ok=True)
    if not os.path.exists(DATA_FILE):
        with open(DATA_FILE, 'w', encoding='utf-8') as f:
            json.dump({"students": [], "transactions": [], "nextStudentId": 1}, f, ensure_ascii=False, indent=2)

@app.route('/')
def index():
    """Asosiy sahifani ochadi"""
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
        req_data = request.json
        init_data_file()
        with open(DATA_FILE, 'w', encoding='utf-8') as f:
            json.dump(req_data, f, ensure_ascii=False, indent=2)
        return jsonify({"status": "success", "message": "Ma'lumot saqlandi"})
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
