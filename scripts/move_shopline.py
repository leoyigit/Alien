import os
import sys

# Add backend directory to sys.path
sys.path.append(os.path.join(os.path.dirname(__file__), '../backend'))

from app.core.supabase import db

def move_shopline():
    print("🔍 Fetching all projects...")
    try:
        # Fetch all projects first
        res = db.table("projects").select("*").execute()
        all_projects = res.data
        
        target_projects = [p for p in all_projects if "Shopline" in p.get("client_name", "")]
        
        if not target_projects:
            print("❌ No project found matching 'Shopline'.")
            return

        print(f"found {len(target_projects)} projects matching 'Shopline'.")
        
        for p in target_projects:
            print(f"➡ Found: {p['client_name']} (ID: {p['id']}, Is Partnership: {p.get('is_partnership')})")
            
            if p.get('is_partnership'):
                print("   ✅ Already a partnership. Skipping.")
                continue
                
            print("   🚀 Updating to partnership...")
            db.table("projects").update({"is_partnership": True}).eq("id", p['id']).execute()
            print("   ✨ Done!")
            
    except Exception as e:
        print(f"🔥 Error: {e}")

if __name__ == "__main__":
    move_shopline()
