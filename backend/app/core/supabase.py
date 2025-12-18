from supabase import create_client, Client
from app.core.config import settings

if not settings.SUPABASE_URL or not settings.SUPABASE_KEY:
    raise ValueError("❌ Missing Supabase Credentials in .env")

# Initialize the client
db: Client = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)