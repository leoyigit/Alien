#!/usr/bin/env python3
"""
List all fields available in the projects table
"""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from app.core.supabase import db

def list_project_fields():
    """Fetch one project and show all available fields"""
    
    print("🔍 Fetching project fields from database...\n")
    
    # Get one project
    result = db.table("projects").select("*").limit(1).execute()
    
    if not result.data:
        print("❌ No projects found in database")
        return
    
    project = result.data[0]
    
    print("📋 Available fields in projects table:\n")
    print("=" * 60)
    
    for field, value in sorted(project.items()):
        value_preview = str(value)[:50] if value else "NULL"
        print(f"  {field:30} = {value_preview}")
    
    print("=" * 60)
    print(f"\n✅ Total fields: {len(project)}")

if __name__ == "__main__":
    try:
        list_project_fields()
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
