
from app.core.supabase import db
import json

def inspect_mailbox_logs():
    project_id = "2643a394-b350-40d8-b668-13593832dbfa"
    
    print(f"--- Inspecting Logs for Project {project_id} (Mailbox) ---")
    logs = db.table("communication_logs").select("*").eq("project_id", project_id).order("created_at", desc=True).limit(5).execute()
    
    for log in logs.data:
        content = log.get('content', '')
        print(f"ID: {log['id']}")
        print(f"Sender: {log['sender_name']}")
        print(f"Source: {log['source']}")
        print(f"Content Length: {len(content) if content else 0}")
        print(f"Content Preview: {content[:100] if content else '[EMPTY]'}")
        print(f"Raw Content: {repr(content)}")
        print("-" * 30)

if __name__ == "__main__":
    inspect_mailbox_logs()
