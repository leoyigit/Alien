#!/usr/bin/env python3
"""
Fix Slack User IDs in Communication Logs
This script updates all communication logs where sender_name is a Slack user ID (starts with 'U')
and replaces it with the actual user's real name from the slack_users table or Slack API.
"""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from app.core.supabase import db
from app.services.slack_utils import resolve_slack_user_name

def fix_sender_names():
    """Update sender_name from Slack user IDs to real names"""
    
    print("🔍 Searching for communication logs with Slack user IDs as sender_name...")
    
    # Fetch all communication logs
    result = db.table("communication_logs").select("id, sender_name, source").execute()
    
    logs_to_update = []
    for log in result.data:
        sender_name = log.get('sender_name', '')
        source = log.get('source', '')
        
        # Check if sender_name looks like a Slack user ID (starts with 'U' and is all caps/numbers)
        if sender_name and sender_name.startswith('U') and len(sender_name) > 5 and source == 'slack':
            # Likely a Slack user ID
            logs_to_update.append(log)
    
    if not logs_to_update:
        print("✅ No logs found with Slack user IDs - already correct!")
        return
    
    print(f"\n📝 Found {len(logs_to_update)} logs to update...")
    print(f"   Processing in batches...\n")
    
    updated_count = 0
    failed_count = 0
    
    for i, log in enumerate(logs_to_update, 1):
        old_sender = log['sender_name']
        
        try:
            # Resolve the Slack user ID to real name
            real_name = resolve_slack_user_name(old_sender)
            
            if real_name and real_name != "Unknown User" and real_name != old_sender:
                # Update the database
                db.table("communication_logs").update({
                    "sender_name": real_name
                }).eq("id", log['id']).execute()
                
                updated_count += 1
                if i % 10 == 0:
                    print(f"   ✅ Progress: {i}/{len(logs_to_update)} - '{old_sender}' -> '{real_name}'")
            else:
                failed_count += 1
                print(f"   ⚠️  Could not resolve: '{old_sender}'")
                
        except Exception as e:
            failed_count += 1
            print(f"   ❌ Error updating {old_sender}: {e}")
    
    print(f"\n✅ Migration complete!")
    print(f"   Updated: {updated_count}")
    print(f"   Failed: {failed_count}")
    print(f"   Total processed: {len(logs_to_update)}")

if __name__ == "__main__":
    try:
        fix_sender_names()
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
