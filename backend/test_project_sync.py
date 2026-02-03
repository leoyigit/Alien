#!/usr/bin/env python3
"""
Test script to identify which projects are failing during AI sync.
"""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from app.core.supabase import db
from app.services import slack_sync_service, openai_service, pm_sync_service, email_sync_service

def test_single_project_sync(project_id):
    """Test syncing a single project to see what fails."""
    try:
        project = db.table("projects").select("*").eq("id", project_id).execute()
        if not project.data:
            print(f"❌ Project {project_id} not found")
            return
        
        project = project.data[0]
        print(f"\n{'='*60}")
        print(f"Testing: {project['client_name']}")
        print(f"{'='*60}")
        
        # Check channels
        print(f"\n📡 Channels:")
        print(f"  Internal: {project.get('channel_id_internal', 'None')}")
        print(f"  External: {project.get('channel_id_external', 'None')}")
        
        # Test internal channel sync
        print(f"\n🔄 Testing internal channel sync...")
        try:
            internal_messages = slack_sync_service.sync_internal_channel(project['id'])
            if internal_messages:
                print(f"  ✅ Got {len(internal_messages)} messages")
            else:
                print(f"  ⚠️  No messages (returned None or empty)")
        except Exception as e:
            print(f"  ❌ Error: {e}")
        
        # Test external channel sync
        print(f"\n🔄 Testing external channel sync...")
        try:
            external_messages = slack_sync_service.sync_external_channel(project['id'])
            if external_messages:
                print(f"  ✅ Got {len(external_messages)} messages")
            else:
                print(f"  ⚠️  No messages (returned None or empty)")
        except Exception as e:
            print(f"  ❌ Error: {e}")
        
        # Test PM data sync
        print(f"\n🔄 Testing PM data sync...")
        try:
            pm_data = pm_sync_service.sync_pm_data(project['id'])
            if pm_data:
                print(f"  ✅ Got PM data")
            else:
                print(f"  ⚠️  No PM data")
        except Exception as e:
            print(f"  ❌ Error: {e}")
        
        # Test email sync
        print(f"\n🔄 Testing email sync...")
        try:
            emails = email_sync_service.sync_emails(project['id'])
            if emails:
                print(f"  ✅ Got {len(emails)} emails")
            else:
                print(f"  ⚠️  No emails")
        except Exception as e:
            print(f"  ❌ Error: {e}")
        
    except Exception as e:
        print(f"❌ Overall error: {e}")
        import traceback
        traceback.print_exc()


def test_all_projects():
    """Test all projects to identify which ones fail."""
    projects = db.table("projects").select("*").execute()
    
    failed_projects = []
    
    for project in projects.data:
        print(f"\n{'='*60}")
        print(f"Testing: {project['client_name']}")
        print(f"{'='*60}")
        
        has_error = False
        
        # Quick test - just try to sync without uploading
        try:
            # Test internal
            if project.get('channel_id_internal'):
                try:
                    internal_messages = slack_sync_service.sync_internal_channel(project['id'])
                    print(f"  ✅ Internal: {len(internal_messages) if internal_messages else 0} messages")
                except Exception as e:
                    print(f"  ❌ Internal failed: {e}")
                    has_error = True
            else:
                print(f"  ⚠️  No internal channel")
            
            # Test external
            if project.get('channel_id_external'):
                try:
                    external_messages = slack_sync_service.sync_external_channel(project['id'])
                    print(f"  ✅ External: {len(external_messages) if external_messages else 0} messages")
                except Exception as e:
                    print(f"  ❌ External failed: {e}")
                    has_error = True
            else:
                print(f"  ⚠️  No external channel")
            
            if has_error:
                failed_projects.append(project['client_name'])
                
        except Exception as e:
            print(f"  ❌ Overall error: {e}")
            failed_projects.append(project['client_name'])
    
    print(f"\n{'='*60}")
    print(f"SUMMARY")
    print(f"{'='*60}")
    print(f"Total projects: {len(projects.data)}")
    print(f"Failed projects: {len(failed_projects)}")
    
    if failed_projects:
        print(f"\nFailed projects:")
        for name in failed_projects:
            print(f"  - {name}")


if __name__ == "__main__":
    import sys
    
    if len(sys.argv) > 1:
        # Test specific project
        project_id = sys.argv[1]
        test_single_project_sync(project_id)
    else:
        # Test all projects
        test_all_projects()
