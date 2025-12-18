import os
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()
url = os.getenv("SUPABASE_URL")
key = os.getenv("SUPABASE_KEY")
db = create_client(url, key)

project_name = "Bella Soft CBD"
res = db.table("projects").select("*").ilike("client_name", f"%{project_name}%").execute()

if res.data:
    project = res.data[0]
    p_id = project['id']
    print(f"Project: {project['client_name']} ({p_id})")
    
    # Check messages
    all_msgs = db.table("communication_logs").select("*").eq("project_id", p_id).execute()
    print(f"Found {len(all_msgs.data)} messages.")
    
    vis_counts = {}
    for m in all_msgs.data:
        v = m['visibility']
        vis_counts[v] = vis_counts.get(v, 0) + 1
    print(f"Current visibility counts: {vis_counts}")
    
    if len(all_msgs.data) > 0:
        print("Cleaning up logs to allow re-sync with correct segregation...")
        db.table("communication_logs").delete().eq("project_id", p_id).execute()
        print("Logs cleared.")
