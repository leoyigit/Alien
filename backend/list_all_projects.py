
from app.core.supabase import db

def list_projects():
    print("Listing all projects...")
    res = db.table("projects").select("id, client_name").execute()
    for p in res.data:
        print(f"[{p['id']}] {p['client_name']}")

if __name__ == "__main__":
    list_projects()
