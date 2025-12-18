from app.utils.db import db
import json

try:
    # Fetch one row to inspect keys
    res = db.table("communication_logs").select("*").limit(1).execute()
    if res.data:
        print(json.dumps(list(res.data[0].keys())))
    else:
        print("No data found, cannot infer columns.")
except Exception as e:
    print(e)
