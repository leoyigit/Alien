"""
Script to check and fix Leo's user profile status.
Run this to ensure leo@flyrank.com is set to superadmin with approved status.
"""
import os
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

db = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

def fix_leo_profile():
    print("🔍 Checking Leo's profile...")
    
    # Find Leo's user
    result = db.table("portal_users").select("*").eq("email", "leo@flyrank.com").execute()
    
    if not result.data:
        print("❌ No profile found for leo@flyrank.com")
        print("Creating profile...")
        
        # Get auth user ID
        # Note: You'll need to get this from Supabase Auth dashboard
        print("\n⚠️  Please provide Leo's user ID from Supabase Auth dashboard")
        return
    
    user = result.data[0]
    print(f"\n✅ Found profile:")
    print(f"   Email: {user.get('email')}")
    print(f"   Role: {user.get('role')}")
    print(f"   Status: {user.get('status', 'NOT SET')}")
    print(f"   Display Name: {user.get('display_name')}")
    
    # Fix if needed
    needs_update = False
    updates = {}
    
    if user.get('role') != 'superadmin':
        print("\n⚠️  Role is not superadmin, fixing...")
        updates['role'] = 'superadmin'
        needs_update = True
    
    if user.get('status') != 'approved':
        print("\n⚠️  Status is not approved, fixing...")
        updates['status'] = 'approved'
        needs_update = True
    
    if needs_update:
        db.table("portal_users").update(updates).eq("email", "leo@flyrank.com").execute()
        print("\n✅ Profile updated!")
        print(f"   New role: superadmin")
        print(f"   New status: approved")
    else:
        print("\n✅ Profile is correct!")
    
    print("\n🔄 Please log out and log back in to see changes.")

if __name__ == "__main__":
    fix_leo_profile()
