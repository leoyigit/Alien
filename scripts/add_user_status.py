"""
Migration script to add user status and approval system.
Adds 'status' column to portal_users table.
"""
import os
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

db = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

def migrate():
    print("🔄 Starting user status migration...")
    
    # Note: This migration requires running SQL directly in Supabase dashboard
    # because the Python client doesn't support ALTER TABLE
    
    sql_commands = """
    -- Add status column to portal_users table
    ALTER TABLE portal_users 
    ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending' 
    CHECK (status IN ('pending', 'approved', 'rejected'));
    
    -- Set all existing users to 'approved' status
    UPDATE portal_users 
    SET status = 'approved' 
    WHERE status IS NULL;
    
    -- Add index for faster queries
    CREATE INDEX IF NOT EXISTS idx_portal_users_status ON portal_users(status);
    """
    
    print("\n📋 Please run the following SQL in your Supabase SQL Editor:")
    print("=" * 60)
    print(sql_commands)
    print("=" * 60)
    print("\n✅ After running the SQL, existing users will be 'approved'")
    print("✅ New signups will be 'pending' by default")

if __name__ == "__main__":
    migrate()
