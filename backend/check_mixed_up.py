#!/usr/bin/env python3
"""
Check Mixed Up Clothing project data
"""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from app.core.supabase import db

def check_mixed_up():
    """Check Mixed Up Clothing project data"""
    
    print("🔍 Searching for Mixed Up Clothing project...\n")
    
    # Search for the project
    result = db.table("projects").select("*").ilike("client_name", "%mixed%up%").execute()
    
    if not result.data:
        print("❌ No project found matching 'Mixed Up'")
        return
    
    project = result.data[0]
    
    print(f"✅ Found project: {project['client_name']}\n")
    print("=" * 60)
    print(f"ID: {project['id']}")
    print(f"PM: {project.get('owner', 'N/A')}")
    print(f"Developer: {project.get('developer', 'N/A')}")
    print(f"Shopline URL: {project.get('shopline_url', 'N/A')}")
    print(f"Shopline Preview Pass: {project.get('shopline_preview_pass', 'N/A')}")
    print(f"Shopify URL: {project.get('shopify_url', 'N/A')}")
    print(f"Live URL: {project.get('live_url', 'N/A')}")
    print("=" * 60)

if __name__ == "__main__":
    try:
        check_mixed_up()
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
