import os
import json
from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

# Railway Volume manzili. Lokal muhitda esa joriy papkada `data` nomli papka yaratadi
DATA_DIR = os.environ.get('DATA_DIR', '/app/data')
DATA_FILE = os.path.join(DATA_DIR, 'data.json')

def init_data_file():
    if not os.path.exists(DATA_DIR):
        os.makedirs(DATA_DIR, exist_ok=True)
    if not os.path.exists(DATA_FILE):
        with open(DATA_FILE, 'w', encoding='utf-8') as f:
            json.dump({"students": [], "transactions": [], "nextStudentId": 1}, f, ensure_ascii=False, indent=2)

@app.route('/api/data', methods=['GET'])
def get_data():
    try:
        init_data_file()
        with open(DATA_FILE, 'r', encoding='utf-8') as f:
            data = json.load(f)
        return jsonify(data)
    except Exception as e:
        print("Xatolik:", e)
        return jsonify({"students": [], "transactions": [], "nextStudentId": 1})

@app.route('/api/data', methods=['POST'])
def save_data():
    try:
        req = request.json
        if not req:
            return jsonify({"status": "error", "message": "No JSON data provided"}), 400

        init_data_file()
        with open(DATA_FILE, 'w', encoding='utf-8') as f:
            json.dump(req, f, ensure_ascii=False, indent=2)
            
        return jsonify({"status": "success"})
    except Exception as e:
        print("Xatolik:", e)
        return jsonify({"status": "error", "message": str(e)}), 500

if __name__ == '__main__':
    init_data_file()
    print(f"Backend API ishga tushdi. Ma'lumotlar {DATA_FILE} faylida saqlanadi.")
    app.run(host='0.0.0.0', port=os.environ.get('PORT', 5000), debug=True)
