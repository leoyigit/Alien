from app.core.supabase import db
res = db.table("projects").select("id, client_name").execute()
for p in res.data:
    print(f"{p['id']}: {p['client_name']}")
