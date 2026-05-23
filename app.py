from flask import Flask, jsonify, request
from flask_cors import CORS
from sklearn.neighbors import KNeighborsClassifier

app = Flask(__name__)
CORS(app)  # Allow cross-origin requests from the frontend

# ──────────────────────────────────────────────────────────────
# TRAINING DATA — Behavior features: [scroll_speed, clicks, idle_time]
#
# Each sample represents a behavioral profile captured from a real user session.
# The model classifies incoming behavior into one of three accessibility modes.
# ──────────────────────────────────────────────────────────────

X_train = [
    # 1. NORMAL CLUSTER: Low scroll speed, few clicks, idle time between 5–30 seconds
    [0, 0, 10], [1, 2, 20], [2, 0, 15], [0, 1, 25],

    # 2. DYSLEXIA CLUSTER: Low scroll speed, few clicks, VERY HIGH idle time (70+ seconds)
    #    Long idle times suggest the user is re-reading or struggling with the content.
    [0, 0, 80], [1, 1, 120], [0, 0, 150], [2, 0, 200],

    # 3. FOCUS (CONCENTRATION) CLUSTER: HIGH scroll speed, HIGH clicks, low idle time
    #    Rapid interaction suggests the user is skimming or overloaded — benefits from
    #    a distraction-free reading environment.
    [20, 15, 10], [25, 20, 15], [30, 10, 5], [18, 25, 12]
]

y_train = [
    # Labels corresponding to the Normal Cluster above
    "normal", "normal", "normal", "normal",

    # Labels corresponding to the Dyslexia Cluster above
    "dyslexia", "dyslexia", "dyslexia", "dyslexia",

    # Labels corresponding to the Focus/Concentration Cluster above
    "focus", "focus", "focus", "focus"
]

# ──────────────────────────────────────────────────────────────
# MODEL SETUP
# K-Nearest Neighbors classifier with k=3.
# Chosen for its simplicity and effectiveness on small, well-separated clusters.
# ──────────────────────────────────────────────────────────────
model = KNeighborsClassifier(n_neighbors=3)
model.fit(X_train, y_train)


# ──────────────────────────────────────────────────────────────
# ROUTES
# ──────────────────────────────────────────────────────────────

@app.route('/', methods=['GET'])
def home():
    """Health check endpoint — confirms the server is running."""
    return jsonify({"status": "success", "message": "Server running."})


@app.route('/analyze', methods=['POST'])
def analyze_behavior():
    """
    Receives a JSON payload with real-time user behavior metrics from the frontend,
    runs them through the KNN classifier, and returns the suggested accessibility mode.

    Expected JSON body:
        {
            "speed": <int>,   # number of fast scroll events in the last interval
            "clicks": <int>,  # number of clicks outside the accessibility panel
            "idle":  <int>    # seconds since the user last interacted with the page
        }

    Returns:
        {
            "status": "success",
            "suggested_mode": "normal" | "dyslexia" | "focus"
        }
    """
    incoming_data = request.json

    print(f"INCOMING DATA: {incoming_data}")

    # Build the feature vector and run the prediction
    user_stats = [[incoming_data['speed'], incoming_data['clicks'], incoming_data['idle']]]
    prediction = model.predict(user_stats)
    predicted_mode = prediction[0]

    print(f"PREDICTION MADE: {predicted_mode}")

    return jsonify({
        "status": "success",
        "suggested_mode": predicted_mode
    })


# ──────────────────────────────────────────────────────────────
# ENTRY POINT
# ──────────────────────────────────────────────────────────────
if __name__ == '__main__':
    app.run(port=5000, debug=True)
