#!/usr/bin/env python3
"""
One-time script to unify developer names: "Edis Dzaferovic" -> "Edis"
"""

import os
import sys
from dotenv import load_dotenv

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.core.supabase import db

load_dotenv()

def unify_developer_names():
    """Update all projects with 'Edis Dzaferovic' to 'Edis'"""
    
    print("=" * 60)
    print("🔧 Unifying Developer Names")
    print("=" * 60)
    print()
    
    # Fetch all projects with "Edis Džaferović"
    print("1️⃣  Fetching projects with 'Edis Džaferović'...")
    result = db.table("projects").select("*").eq("developer", "Edis Džaferović").execute()
    
    projects_to_update = result.data if result.data else []
    print(f"   Found {len(projects_to_update)} projects to update")
    print()
    
    if len(projects_to_update) == 0:
        print("✅ No projects need updating!")
        return
    
    # Show which projects will be updated
    print("2️⃣  Projects to update:")
    for p in projects_to_update:
        print(f"   - {p['client_name']} (ID: {p['id']})")
    print()
    
    # Update each project
    print("3️⃣  Updating projects...")
    updated_count = 0
    
    for project in projects_to_update:
        try:
            db.table("projects").update({
                "developer": "Edis"
            }).eq("id", project["id"]).execute()
            
            print(f"   ✅ Updated: {project['client_name']}")
            updated_count += 1
        except Exception as e:
            print(f"   ❌ Failed to update {project['client_name']}: {e}")
    
    print()
    print("=" * 60)
    print(f"✅ Update Complete!")
    print(f"   Projects updated: {updated_count}/{len(projects_to_update)}")
    print("=" * 60)

if __name__ == "__main__":
    unify_developer_names()
