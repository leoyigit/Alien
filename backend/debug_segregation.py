import sys
import os

# Create a minimal app context or just use supabase directly with env vars
from dotenv import load_dotenv
load_dotenv()

from supabase import create_client

url = os.getenv("SUPABASE_URL")
key = os.getenv("SUPABASE_KEY")
db = create_client(url, key)

from collections import Counter

project_name = "Bella Soft CBD" 
res = db.table("projects").select("*").ilike("client_name", f"%{project_name}%").execute()

if not res.data:
    print("Project not found.")
else:
    for project in res.data:
        p_id = project['id']
        p_name = project['client_name']
        print(f"--- Project: {p_name} ({p_id}) ---")
        print(f"Internal Channel ID: {project.get('channel_id_internal')}")
        print(f"External Channel ID: {project.get('channel_id_external')}")
        
        all_msgs = db.table("communication_logs").select("visibility").eq("project_id", p_id).execute()
        vis_counts = Counter([m['visibility'] for m in all_msgs.data])
        print(f"Message counts by visibility: {dict(vis_counts)}")
