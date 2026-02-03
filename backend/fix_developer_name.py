#!/usr/bin/env python3
"""
Fix developer name: Thanassis -> Thanasis
This script updates all projects where developer is set to "Thanassis" or "thanassis@flyrank.com"
"""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from app.core.supabase import db

def fix_developer_name():
    """Update developer name from Thanassis to Thanasis"""
    
    print("🔍 Searching for projects with developer 'Thanassis'...")
    
    # Find all projects with Thanassis as developer
    result = db.table("projects").select("id, client_name, developer").execute()
    
    projects_to_update = []
    for project in result.data:
        developer = project.get('developer', '')
        if developer and ('thanassis' in developer.lower()):
            projects_to_update.append(project)
            print(f"   Found: {project['client_name']} - Developer: {developer}")
    
    if not projects_to_update:
        print("✅ No projects found with 'Thanassis' - already correct!")
        return
    
    print(f"\n📝 Updating {len(projects_to_update)} projects...")
    
    for project in projects_to_update:
        old_developer = project['developer']
        # Replace Thanassis with Thanasis (case-insensitive)
        new_developer = old_developer.replace('Thanassis', 'Thanasis').replace('thanassis', 'thanasis')
        
        db.table("projects").update({
            "developer": new_developer
        }).eq("id", project['id']).execute()
        
        print(f"   ✅ {project['client_name']}: '{old_developer}' -> '{new_developer}'")
    
    print(f"\n✅ Successfully updated {len(projects_to_update)} projects!")

if __name__ == "__main__":
    try:
        fix_developer_name()
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
