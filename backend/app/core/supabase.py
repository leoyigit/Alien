from supabase import create_client, Client
from app.core.config import settings

if not settings.SUPABASE_URL or not settings.SUPABASE_KEY:
    raise ValueError("❌ Missing Supabase Credentials in .env")

# Initialize the client
# Initialize the client
db: Client = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)

# Initialize Admin Client (Bypasses RLS)
# Fallback to regular key if service role is missing (though RLS will fail)
admin_key = settings.SUPABASE_SERVICE_ROLE_KEY or settings.SUPABASE_KEY
admin_db: Client = create_client(settings.SUPABASE_URL, admin_key)