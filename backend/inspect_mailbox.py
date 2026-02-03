
from app.core.supabase import db
import json

def inspect_mailbox():
    # 1. Find project named "Mailbox" (or similar)
    print("--- Finding Project ---")
    res = db.table("projects").select("id, client_name").ilike("client_name", "%Mailbox%").execute()
    
    if not res.data:
        print("❌ 'Mailbox' project not found.")
        return
        
    project = res.data[0]
    print(f"Found Project: {project['client_name']} ({project['id']})")
    
    # 2. Get recent logs
    print("\n--- Recent Logs ---")
    logs = db.table("communication_logs").select("*").eq("project_id", project['id']).order("created_at", desc=True).limit(5).execute()
    
    for log in logs.data:
        content = log.get('content', '')
        print(f"ID: {log['id']}")
        print(f"Sender: {log['sender_name']}")
        print(f"Source: {log['source']}")
        print(f"Content Length: {len(content) if content else 0}")
        print(f"Content Preview: {content[:100] if content else '[EMPTY]'}")
        print("-" * 30)

if __name__ == "__main__":
    inspect_mailbox()
