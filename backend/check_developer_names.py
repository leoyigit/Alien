#!/usr/bin/env python3
"""
Script to check all unique developer names in the database
"""

import os
import sys
from dotenv import load_dotenv

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.core.supabase import db

load_dotenv()

def check_developer_names():
    """List all unique developer names"""
    
    print("=" * 60)
    print("📋 Checking Developer Names")
    print("=" * 60)
    print()
    
    # Fetch all projects
    result = db.table("projects").select("developer, client_name").execute()
    projects = result.data if result.data else []
    
    # Group by developer
    dev_projects = {}
    for p in projects:
        dev = p.get('developer') or 'Unassigned'
        if dev not in dev_projects:
            dev_projects[dev] = []
        dev_projects[dev].append(p['client_name'])
    
    # Display results
    print(f"Found {len(dev_projects)} unique developer names:\n")
    
    for dev in sorted(dev_projects.keys()):
        count = len(dev_projects[dev])
        print(f"  {dev}: {count} project(s)")
        if 'edis' in dev.lower():
            print(f"    → Projects: {', '.join(dev_projects[dev][:3])}")
            if count > 3:
                print(f"      ... and {count - 3} more")
    
    print()
    print("=" * 60)

if __name__ == "__main__":
    check_developer_names()
