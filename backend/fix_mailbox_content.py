
from app.core.supabase import db
from slack_sdk import WebClient
from app.core.config import settings
from app.services.slack_utils import extract_message_content
import time

slack_client = WebClient(token=settings.SLACK_BOT_TOKEN)

def fix_mailbox():
    project_id = "2643a394-b350-40d8-b668-13593832dbfa"
    mailbox_channel_id = "C0A16GEAPD5"  # From webhooks.py
    
    print(f"--- Fixing Logs for Project {project_id} (Mailbox) ---")
    
    # 1. Fetch empty logs
    logs = db.table("communication_logs").select("*").eq("project_id", project_id).eq("content", "").execute()
    
    if not logs.data:
        print("✅ No empty logs found.")
        return

    print(f"found {len(logs.data)} empty logs.")
    
    updated_count = 0
    
    for log in logs.data:
        ts = log['slack_ts']
        if not ts:
            continue
            
        print(f"Fetching Slack message {ts}...")
        try:
            # We use conversations_history with inclusive bounds to get specific message
            res = slack_client.conversations_history(
                channel=mailbox_channel_id,
                latest=ts,
                inclusive=True,
                limit=1
            )
            
            messages = res.get('messages', [])
            if messages:
                msg = messages[0]
                if msg['ts'] == ts:
                    # Found it!
                    content = extract_message_content(msg)
                    if content:
                        print(f"   ✅ Recovered content: {content[:50]}...")
                        # Update DB
                        db.table("communication_logs").update({
                            "content": content
                        }).eq("id", log['id']).execute()
                        updated_count += 1
                    else:
                        print(f"   ⚠️ Content is still empty after extraction.")
                else:
                    print(f"   ⚠️ TS mismatch or message not found.")
            else:
                print(f"   ⚠️ Message not found in Slack history.")
                
        except Exception as e:
            print(f"   ❌ Error fetching from Slack: {e}")
            
        time.sleep(0.5) # Rate limit
        
    print(f"\n✅ Fix complete. Updated {updated_count} records.")

if __name__ == "__main__":
    fix_mailbox()
