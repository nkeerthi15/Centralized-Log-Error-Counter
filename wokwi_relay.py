
from flask import Flask, jsonify
import requests

app = Flask(__name__)

BRIDGE_URL = "http://127.0.0.1:5001/count"

@app.route("/count")
def count():
    try:
        response = requests.get(BRIDGE_URL, timeout=5)
        response.raise_for_status()

        return jsonify(response.json())

    except Exception as e:
        print("Bridge connection error:", e)

        return jsonify({
            "error": "Bridge unavailable"
        }), 503


if __name__ == "__main__":
    print("Wokwi relay starting...")
    app.run(host="0.0.0.0", port=8000)
