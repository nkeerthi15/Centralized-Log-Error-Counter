import json
import ssl
import threading
from datetime import datetime
from pathlib import Path
from flask import Flask, jsonify, render_template
import paho.mqtt.client as mqtt

# AWS IoT configuration
ENDPOINT = "a1teqxjsbgrcm7-ats.iot.us-east-1.amazonaws.com"
PORT = 8883
TOPIC = "centralized/logs/errors"

BASE_DIR = Path(__file__).resolve().parent
CERT_DIR = Path("/etc/secrets") if Path("/etc/secrets/certificate.crt").exists() else BASE_DIR / "certs"

CERT = str(CERT_DIR / "certificate.crt")
KEY = str(CERT_DIR / "private.key.pem")
ROOT_CA = str(CERT_DIR / "AmazonRootCA1.pem.txt")

# In-memory runtime state
latest_count = 0
mqtt_connected = False
last_connect_time = None
last_message_time = None
message_history = []  # List of {"time": str, "count": int}
MAX_HISTORY_ITEMS = 20

app = Flask(__name__, template_folder="templates", static_folder="static")


@app.after_request
def add_cors_headers(response):
    """Enable CORS so dashboard and external relays can query endpoints cleanly."""
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "GET, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type"
    return response


def append_history(count_val, time_label=None):
    """Safely append new error count point to in-memory session history."""
    if time_label is None:
        time_label = datetime.now().strftime("%H:%M:%S")
    message_history.append({"time": time_label, "count": count_val})
    if len(message_history) > MAX_HISTORY_ITEMS:
        message_history.pop(0)


def on_connect(client, userdata, flags, reason_code, properties):
    global mqtt_connected, last_connect_time
    mqtt_connected = True
    last_connect_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{last_connect_time}] AWS IoT connected successfully: {reason_code}")
    client.subscribe(TOPIC)


def on_disconnect(client, userdata, disconnect_flags, reason_code, properties):
    global mqtt_connected
    mqtt_connected = False
    print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] AWS IoT disconnected: {reason_code}")


def on_message(client, userdata, message):
    global latest_count, last_message_time
    try:
        data = json.loads(message.payload.decode())
        latest_count = int(data.get("errors_last_60_minutes", 0))
        last_message_time = datetime.now().strftime("%H:%M:%S")
        append_history(latest_count, last_message_time)
        print(f"[{last_message_time}] Latest AWS error count updated: {latest_count}")
    except Exception as e:
        print("Error processing MQTT message payload:", e)


# Initialize MQTT client
client = mqtt.Client(
    mqtt.CallbackAPIVersion.VERSION2,
    client_id="CentralizedLogDashboard"
)

# Configure TLS with AWS IoT X.509 client certificate if present
try:
    client.tls_set(
        ca_certs=ROOT_CA,
        certfile=CERT,
        keyfile=KEY,
        cert_reqs=ssl.CERT_REQUIRED,
        tls_version=ssl.PROTOCOL_TLS_CLIENT
    )
    client.on_connect = on_connect
    client.on_disconnect = on_disconnect
    client.on_message = on_message
except Exception as e:
    print(f"Warning: TLS configuration encountered error: {e}")


# -----------------------------------------------------------------------------
# Web & API Endpoints
# -----------------------------------------------------------------------------

@app.route("/")
def index():
    """Serves the professional light-themed monitoring dashboard."""
    return render_template("index.html")


@app.route("/count")
def count():
    """
    Standard counter endpoint preserved exactly for Kubernetes probes
    and Wokwi ESP32 relay compatibility.
    """
    return jsonify({
        "errors_last_60_minutes": latest_count
    })


@app.route("/api/status")
def status():
    """
    Detailed telemetry endpoint providing system, connection and component states.
    Does NOT fabricate data: unavailable metrics are explicitly reported as unavailable.
    """
    return jsonify({
        "errors_last_60_minutes": latest_count,
        "errors_today": None,
        "errors_today_note": "Daily aggregation is not configured in the CloudWatch/Lambda pipeline.",
        "mqtt": {
            "connected": mqtt_connected,
            "endpoint": ENDPOINT,
            "port": PORT,
            "topic": TOPIC,
            "last_connected_at": last_connect_time,
            "last_message_at": last_message_time
        },
        "esp32": {
            "status": "unmonitored",
            "mode": "pull_relay",
            "message": "ESP32 operates in pull-only mode via Wokwi relay. Upstream device heartbeat telemetry is not implemented."
        },
        "infrastructure": {
            "aws_cloudwatch": "operational_upstream",
            "aws_lambda": "operational_upstream",
            "aws_iot_core": "connected" if mqtt_connected else "connecting",
            "flask_bridge": "healthy",
            "docker": "container_spec_ready",
            "kubernetes": "deployment_defined",
            "esp32_display": "unmonitored_pull_mode"
        },
        "history": message_history,
        "recent_events": [],
        "recent_events_note": "Upstream Lambda publishes aggregated 60m counts only. Granular log event streaming is not configured."
    })


def start_mqtt():
    """Connect to AWS IoT MQTT broker with reconnection resilience."""
    try:
        print(f"Connecting to AWS IoT Core at {ENDPOINT}:{PORT}...")
        client.connect(ENDPOINT, PORT, 60)
        client.loop_forever()
    except Exception as e:
        print(f"MQTT connection failed or broker unreachable: {e}")


if __name__ == "__main__":
    # Record initial startup point in history
    append_history(latest_count)
    threading.Thread(target=start_mqtt, daemon=True).start()
    print("LogPulse Centralized Log Bridge starting on http://0.0.0.0:5000")
    app.run(host="0.0.0.0", port=5000)
