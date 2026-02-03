
from app.core.supabase import db

def test_connection():
    print("Testing connection...")
    try:
        res = db.table("projects").select("id, client_name").limit(5).execute()
        print(f"Success! Found {len(res.data)} projects.")
        for p in res.data:
            print(f"- {p['client_name']}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test_connection()
