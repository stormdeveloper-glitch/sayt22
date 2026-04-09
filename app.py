import os
import json
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS

app = Flask(__name__, static_folder='.')
CORS(app)

# Railway Volume manzili
DATA_DIR = os.environ.get('DATA_DIR', '/app/data')
DATA_FILE = os.path.join(DATA_DIR, 'data.json')

def init_data_file():
    if not os.path.exists(DATA_DIR):
        os.makedirs(DATA_DIR, exist_ok=True)
    if not os.path.exists(DATA_FILE):
        with open(DATA_FILE, 'w', encoding='utf-8') as f:
            json.dump({"students": [], "transactions": [], "nextStudentId": 1}, f, ensure_ascii=False, indent=2)

@app.route('/')
def index():
    return send_from_directory('.', 'index.html')

@app.route('/api/data', methods=['GET'])
def get_data():
    try:
        init_data_file()
        with open(DATA_FILE, 'r', encoding='utf-8') as f:
            data = json.load(f)
        return jsonify(data)
    except Exception as e:
        return jsonify({"students": [], "transactions": [], "nextStudentId": 1})

@app.route('/api/data', methods=['POST'])
def save_data():
    try:
        req = request.json
        if not req:
            return jsonify({"status": "error", "message": "No JSON data"}), 400
        init_data_file()
        with open(DATA_FILE, 'w', encoding='utf-8') as f:
            json.dump(req, f, ensure_ascii=False, indent=2)
        return jsonify({"status": "success"})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

if __name__ == '__main__':
    init_data_file()
    # Railway uchun eng muhim qismi:
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port)
