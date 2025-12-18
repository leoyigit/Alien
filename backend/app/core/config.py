import os
from dotenv import load_dotenv

# Load variables from .env file
load_dotenv()

class Settings:
    SUPABASE_URL = os.environ.get("SUPABASE_URL")
    SUPABASE_KEY = os.environ.get("SUPABASE_KEY")
    SLACK_BOT_TOKEN = os.environ.get("SLACK_BOT_TOKEN")
    OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY")

# This is the variable your app is looking for:
settings = Settings()