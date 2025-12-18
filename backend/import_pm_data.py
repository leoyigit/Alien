import json
from datetime import datetime
from app.core.supabase import db

# YOUR DATA
pm_data = [
  {
    "client": "Tampon Tribe",
    "owner": "Leo",
    "category": "New / In Progress",
    "status": "Merchant has a store on shopline, waiting for her to grant us access! 2 Reminder sent no answer yet.",
    "blocker": "Merchant",
    "call": "-",
    "developer": "Evan",
    "last_contact_date": "2025-12-15",
    "comm_channel": "Email",
    "history": [{"timestamp": "2025-12-15 19:23:10", "user": "leo@flyrank.com", "changes": {"status": {"old": "Kickoff done...", "new": "Merchant has a store..."}}, "previous_state": {}}]
  },
  {
    "client": "Avvika",
    "owner": "Alen",
    "category": "Launched",
    "status": "Project launched. https://www.drinkavvika.com/",
    "blocker": "None",
    "call": "-",
    "developer": "Evan",
    "last_contact_date": "2025-09-10",
    "comm_channel": "Slack, Email, Google Meet",
    "history": []
  },
  {
    "client": "Fila Manila",
    "owner": "Jusa",
    "category": "Launched",
    "status": "Live > https://filamanila.com",
    "blocker": "None",
    "call": "-",
    "developer": "Thanasis",
    "last_contact_date": "2025-11-13",
    "comm_channel": "Slack, Email, Google Meet",
    "history": []
  },
  {
    "client": "Elos Thermal",
    "owner": "Leo",
    "category": "Launched",
    "status": "Live > https://elosthermal.com\n\nMerchant reach out for some more minor fixes! Reviews were not showing due to bg/text color.",
    "blocker": "None",
    "call": "-",
    "developer": "Evan",
    "last_contact_date": "2025-12-09",
    "comm_channel": "Slack",
    "history": [{"timestamp": "2025-12-09 14:17:01", "user": "leo@flyrank.com", "changes": {}, "previous_state": {}}]
  },
  {
    "client": "Untoxicated",
    "owner": "Bule",
    "category": "Launched",
    "status": "Live > https://untoxicated.com",
    "blocker": "None",
    "call": "-",
    "developer": "Thanasis",
    "last_contact_date": "2025-12-02",
    "comm_channel": "Slack, Email, Google Meet",
    "history": []
  },
  {
    "client": "Miami Beach Bum",
    "owner": "Leo",
    "category": "Ready / Scheduled",
    "status": "Launching early January if not before. Waiting AI integration Foresite Ads.",
    "blocker": "Merchant  Waiting AI integration Foresite Ads.",
    "call": "2025-12-17",
    "developer": "Labros",
    "last_contact_date": "2025-12-03",
    "comm_channel": "Slack",
    "history": [{"timestamp": "2025-12-15 19:19:20", "user": "leo@flyrank.com", "changes": {}, "previous_state": {}}]
  },
  {
    "client": "OKU",
    "owner": "Leo",
    "category": "Ready / Scheduled",
    "status": "Ready to launch pending Shopline/Client tasks...",
    "blocker": "Client > Still missing shipping",
    "call": "-",
    "developer": "Evan",
    "last_contact_date": "2025-11-14",
    "comm_channel": "Google Meet",
    "history": []
  },
  {
    "client": "Miss Commando",
    "owner": "Leo",
    "category": "Ready / Scheduled",
    "status": "Ready to launch. Waiting to schedule the pre-launch call...",
    "blocker": "Client",
    "call": "-",
    "developer": "Edis",
    "last_contact_date": "2025-11-13",
    "comm_channel": "Slack",
    "history": []
  },
  {
    "client": "Patch Party Club",
    "owner": "Leo",
    "category": "Ready / Scheduled",
    "status": "Almost ready. Waiting on Shopline apps & QA...",
    "blocker": "Shopline + Client",
    "call": "2025-12-11",
    "developer": "Evan",
    "last_contact_date": "2025-11-20",
    "comm_channel": "Email, Slack",
    "history": []
  },
  {
    "client": "Mimosa Royale",
    "owner": "Leo",
    "category": "Ready / Scheduled",
    "status": "Setup, data, and theme migration complete...",
    "blocker": "Client",
    "call": "-",
    "developer": "Evan",
    "last_contact_date": "2025-12-04",
    "comm_channel": "Email",
    "history": []
  },
  {
    "client": "RemoBrush",
    "owner": "Jusa",
    "category": "Almost Ready",
    "status": "The Bundle app needs some fixes...",
    "blocker": "Shopline App Problem",
    "call": "-",
    "developer": "Evan",
    "last_contact_date": "2025-10-29",
    "comm_channel": "Slack",
    "history": []
  },
  {
    "client": "Dirty Dill",
    "owner": "Jusa",
    "category": "Almost Ready",
    "status": "Currently, it’s pending the BevStack onboarding team...",
    "blocker": "Bevstack Agency",
    "call": "-",
    "developer": "Edis",
    "last_contact_date": "2025-11-11",
    "comm_channel": "Email",
    "history": []
  },
  {
    "client": "Drink Yate",
    "owner": "Jusa",
    "category": "Almost Ready",
    "status": "Waiting on them to finalize about payments",
    "blocker": "Client > pending merchant connecting Amazon Pay...",
    "call": "-",
    "developer": "Evan",
    "last_contact_date": "2025-12-01",
    "comm_channel": "Slack",
    "history": []
  },
  {
    "client": "Culture Kicks",
    "owner": "Leo",
    "category": "New / In Progress",
    "status": "Kickoff done, deliverables ready...",
    "blocker": "Client > waiting reply from client",
    "call": "-",
    "developer": "Not Assigned",
    "last_contact_date": "2025-12-01",
    "comm_channel": "Slack, Email",
    "history": []
  },
  {
    "client": "BellaSoftCBD",
    "owner": "Leo",
    "category": "Almost Ready",
    "status": "Store preview send, positive feedback...",
    "blocker": "-",
    "call": "-",
    "developer": "Evan",
    "last_contact_date": "2025-11-08",
    "comm_channel": "Slack",
    "history": [{"timestamp": "2025-12-15 09:55:51", "user": "leo@flyrank.com", "changes": {}, "previous_state": {}}]
  },
  {
    "client": "AmorSui",
    "owner": "Leo",
    "category": "New / In Progress",
    "status": "Kickoff completed, deliverables sent...",
    "blocker": "Client > Shopify access not granted",
    "call": "-",
    "developer": "Not Assigned",
    "last_contact_date": "2025-12-04",
    "comm_channel": "Slack, Email, Google Meet",
    "history": []
  },
  {
    "client": "AnaOno",
    "owner": "Bule",
    "category": "Stuck / On Hold",
    "status": "They want to do some additional changes...",
    "blocker": "Client",
    "call": "-",
    "developer": "Evan",
    "last_contact_date": "2025-12-02",
    "comm_channel": "Email",
    "history": []
  },
  {
    "client": "ZodiaksMoonRock",
    "owner": "Leo",
    "category": "Stuck / On Hold",
    "status": "Merchant unresponsive; no access granted yet.",
    "blocker": "Client (Merchant) > No access granted yet",
    "call": "-",
    "developer": "Evan",
    "last_contact_date": "2025-11-10",
    "comm_channel": "Email",
    "history": []
  },
  {
    "client": "PiperWai",
    "owner": "Leo",
    "category": "Stuck / On Hold",
    "status": "Merchant decided to stay with Shopify",
    "blocker": "Client decided to stay with shopify",
    "call": "-",
    "developer": "Unassigned",
    "last_contact_date": "2025-12-15",
    "comm_channel": "Email",
    "history": [{"timestamp": "2025-12-15 18:51:26", "user": "leo@flyrank.com", "changes": {}, "previous_state": {}}]
  },
  {
    "client": "Fresh Peaches",
    "owner": "Leo",
    "category": "Stuck / On Hold",
    "status": "Paused by merchant",
    "blocker": "Merchant > Waiting on pagebuilder app",
    "call": "-",
    "developer": "Labros",
    "last_contact_date": "2025-11-13",
    "comm_channel": "Slack",
    "history": []
  },
  {
    "client": "Caire Beauty",
    "owner": "Bule",
    "category": "Stuck / On Hold",
    "status": "On hold, they should wrap up changes...",
    "blocker": "Client",
    "call": "-",
    "developer": "Edis",
    "last_contact_date": "2025-09-25",
    "comm_channel": "Email",
    "history": []
  },
  {
    "client": "Snazzy Beverages",
    "owner": "Jusa",
    "category": "Stuck / On Hold",
    "status": "Waiting on the redesign.",
    "blocker": "Client",
    "call": "-",
    "developer": "Evan",
    "last_contact_date": "2025-11-10",
    "comm_channel": "Email",
    "history": []
  },
  {
    "client": "Boozy Jerky",
    "owner": "Leo",
    "category": "New / In Progress",
    "status": "Kickoff completed, deliverables sent. waiting merchant to give us access. Waiting",
    "blocker": "-",
    "call": "2025-12-16",
    "developer": "Unassigned",
    "last_contact_date": "2025-12-16",
    "comm_channel": "Email, Google Meet",
    "history": [{"timestamp": "2025-12-16 21:15:44", "user": "leo@flyrank.com", "changes": {}, "previous_state": {}}]
  },
  {
    "client": "Mixed Up Clothing",
    "owner": "Leo",
    "category": "New / In Progress",
    "status": "Kickoff call held. Slack Channel Created. Deliverables sent.",
    "blocker": "-",
    "call": "-",
    "developer": "Unassigned",
    "last_contact_date": "2025-12-15",
    "comm_channel": "Google Meet",
    "history": [{"timestamp": "2025-12-15 20:54:31", "user": "leo@flyrank.com", "changes": {}, "previous_state": {}}]
  },
  {
    "client": "Dosso Beauty",
    "owner": "Leo",
    "category": "New / In Progress",
    "status": "Kickoff done, access granted...",
    "blocker": "-",
    "call": "2025-12-17",
    "developer": "Unassigned",
    "last_contact_date": "2025-12-16",
    "comm_channel": "Google Meet",
    "history": [{"timestamp": "2025-12-16 23:03:54", "user": "leo@flyrank.com", "changes": {}, "previous_state": {}}]
  }
]

def import_data():
    print("🚀 Starting Import...")
    for item in pm_data:
        client = item["client"]
        # Normalize date fields to be NULL if they are "-"
        next_call = item["call"] if item["call"] != "-" else None
        last_contact = item["last_contact_date"] if item["last_contact_date"] != "-" else None
        
        # Check if project exists (Case insensitive logic handled by DB usually, here we match client_name)
        res = db.table("projects").select("id").eq("client_name", client).execute()
        
        payload = {
            "owner": item["owner"],
            "category": item["category"],
            "status_detail": item["status"],
            "blocker": item["blocker"],
            "developer": item["developer"],
            "next_call": next_call,
            "last_contact_date": last_contact,
            "comm_channels": item["comm_channel"],
            "history": item["history"],
            "last_updated_at": datetime.now().isoformat()
        }

        if res.data:
            print(f"✅ Updating {client}...")
            db.table("projects").update(payload).eq("client_name", client).execute()
        else:
            print(f"✨ Creating {client}...")
            payload["client_name"] = client
            payload["status_overview"] = "Imported from JSON"
            db.table("projects").insert(payload).execute()
    print("🏁 Import Complete!")

if __name__ == "__main__":
    import_data()