# backend/main.py
from flask import Flask
from app.api.routes import api
from app.api.auth import auth
from app.api.settings_api import settings_api
from app.api.reports import reports_api
from app.api.chat import chat_api
from app.api.webhooks import webhooks
from flask_cors import CORS

def create_app():
    app = Flask(__name__)
    CORS(app, supports_credentials=True) # Allow React frontend with credentials

    # Register API blueprints
    app.register_blueprint(api, url_prefix='/api')
    app.register_blueprint(auth, url_prefix='/api/auth')
    app.register_blueprint(settings_api, url_prefix='/api/settings')
    app.register_blueprint(reports_api, url_prefix='/api/reports')
    app.register_blueprint(chat_api, url_prefix='/api/chat')
    app.register_blueprint(webhooks)  # No prefix - already includes /slack/events

    return app


app = create_app()

if __name__ == "__main__":
    print("👽 Alien Portal Backend Running on http://localhost:5001")
    app.run(host="0.0.0.0", port=5001, debug=True)