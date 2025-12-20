# backend/app/api/routes.py
import re
from datetime import datetime
from flask import Blueprint, jsonify, request, g
from slack_sdk import WebClient
from slack_sdk.errors import SlackApiError
from app.core.config import settings
from app.core.supabase import db
from app.api.auth import require_auth

# Initialize Blueprint and Slack Client
api = Blueprint('api', __name__)
slack_client = WebClient(token=settings.SLACK_BOT_TOKEN)

# ---------------------------------------------------------
# 🛠️ HELPER FUNCTIONS
# ---------------------------------------------------------

def resolve_slack_user(slack_user_id):
    """
    1. Checks DB cache for user.
    2. If missing, fetches from Slack API.
    3. Auto-assigns 'internal' if email matches flyrank/powercommerce.
    4. Saves to 'slack_users' table.
    """
    try:
        if not slack_user_id: 
            return "Unknown"

        # A. Check Cache (Database)
        existing = db.table("slack_users").select("real_name").eq("slack_id", slack_user_id).execute()
        if existing.data:
            return existing.data[0]["real_name"]

        # B. Fetch from Slack
        user_info = slack_client.users_info(user=slack_user_id)
        user = user_info["user"]
        
        # Priority: Real Name > Display Name > "Unknown"
        real_name = user.get("real_name") or user.get("profile", {}).get("real_name") or user.get("name") or "Unknown"
        profile = user.get("profile", {})
        email = profile.get("email", "")
        avatar = profile.get("image_48", "")

        # C. Auto-Classify Role
        role = "external"
        if email and ("flyrank.com" in email or "powercommerce.com" in email):
            role = "internal"

        # D. Save to Database
        db.table("slack_users").upsert({
            "slack_id": slack_user_id,
            "real_name": real_name,
            "email": email,
            "avatar_url": avatar,
            "user_type": role
        }).execute()
        
        print(f"👤 Discovered User: {real_name} ({role})")
        return real_name

    except Exception as e:
        print(f"⚠️ Could not resolve user {slack_user_id}: {e}")
        return "Unknown User"

def save_message_to_db(project_id, msg, visibility="internal"):
    """
    Saves a single message (or thread reply) to Supabase.
    Resolves the user ID to a Real Name before saving.
    """
    ts = msg.get("ts")
    user_id = msg.get("user")
    
    # 1. Resolve User Identity
    if not user_id and "bot_id" in msg:
         sender_name = msg.get("username", "Bot")
    else:
         sender_name = resolve_slack_user(user_id)

    # 2. Check duplicate (Idempotency)
    # Although we try to be incremental, overlapping timestamps can happen.
    exists = db.table("communication_logs").select("id").eq("slack_ts", ts).execute()
    if exists.data:
        return 

    # 3. Convert Slack ts to actual datetime
    # Slack ts is Unix timestamp (e.g., "1702914327.123456")
    try:
        msg_timestamp = datetime.fromtimestamp(float(ts))
    except:
        msg_timestamp = datetime.now()

    # 4. Insert into Logs with ACTUAL message time
    db.table("communication_logs").insert({
        "project_id": project_id,
        "content": msg.get("text", ""),
        "sender_name": sender_name,
        "source": "slack",
        "slack_ts": ts,
        "thread_ts": msg.get("thread_ts"),
        "visibility": visibility,
        "reactions": msg.get("reactions", []),
        "created_at": msg_timestamp.isoformat()  # Use actual message time!
    }).execute()

# ---------------------------------------------------------
# 📡 CHANNEL SCANNER & MAPPING
# ---------------------------------------------------------

@api.route('/scan-channels', methods=['GET'])
def scan_channels():
    try:
        # Fetch Slack Channels
        slack_res = slack_client.conversations_list(types="public_channel,private_channel", limit=1000)
        all_channels = slack_res["channels"]

        # Fetch Existing Projects
        projects_res = db.table("projects").select("client_name, channel_id_internal, channel_id_external").execute()
        
        mapped_ids = set()
        existing_clients = {} 
        
        for p in projects_res.data:
            if p["channel_id_internal"]: mapped_ids.add(p["channel_id_internal"])
            if p["channel_id_external"]: mapped_ids.add(p["channel_id_external"])
            # Normalize: "Fresh Peaches" -> "freshpeaches"
            clean_db_name = p["client_name"].lower().replace(" ", "").replace("-", "")
            existing_clients[clean_db_name] = p["client_name"]

        ignored_res = db.table("ignored_channels").select("channel_id").execute()
        for i in ignored_res.data:
            mapped_ids.add(i["channel_id"])

        # Regex: Captures "name" from "name-internal"
        pattern = re.compile(r"^(.*?)-(internal|external|flyrank|partner)$")

        unmapped = []
        for ch in all_channels:
            c_id = ch["id"]
            c_name = ch["name"]
            
            if ch["is_archived"] or c_id in mapped_ids:
                continue

            suggestion = None
            match = pattern.match(c_name)
            
            if match:
                extracted_name = match.group(1) # "freshpeaches"
                suffix = match.group(2)         # "internal"
                
                role = "internal"
                if suffix in ["external", "partner"]:
                    role = "external"

                clean_extracted = extracted_name.replace("-", "")
                pretty_client = existing_clients.get(clean_extracted, extracted_name.replace("-", " ").title())

                suggestion = {"client": pretty_client, "role": role}

            unmapped.append({
                "id": c_id,
                "name": c_name,
                "members_count": ch["num_members"],
                "suggestion": suggestion
            })

        unmapped.sort(key=lambda x: x['suggestion'] is None)
        return jsonify({"count": len(unmapped), "channels": unmapped})

    except Exception as e:
        return jsonify({"error": str(e)}), 500

@api.route('/map-channel', methods=['POST'])
def map_channel():
    data = request.json
    c_id = data.get("channel_id")
    client = data.get("client_name")
    role = data.get("role")
    is_partnership = data.get("is_partnership", False)  # New: partnership flag
    
    print(f"📡 map_channel called: channel={c_id}, client={client}, role={role}, partnership={is_partnership}")
    
    if not c_id or not client or not role:
        return jsonify({"error": "Missing fields"}), 400

    field_to_update = "channel_id_internal" if role == "internal" else "channel_id_external"

    try:
        # Check if project exists
        res = db.table("projects").select("id").eq("client_name", client).execute()
        print(f"   Project lookup result: {len(res.data)} found")
        
        if not res.data:
            # Create new project/partnership
            print(f"   Creating new {'partnership' if is_partnership else 'project'}: {client}")
            db.table("projects").insert({
                "client_name": client,
                field_to_update: c_id,
                "status_overview": "Initialized via Scanner",
                "is_partnership": is_partnership
            }).execute()
        else:
            # Update existing
            print(f"   Updating existing: {client} -> {field_to_update}={c_id}, is_partnership={is_partnership}")
            db.table("projects").update({
                field_to_update: c_id,
                "is_partnership": is_partnership
            }).eq("client_name", client).execute()
            
        return jsonify({"success": True, "message": f"Mapped {c_id} to {client}"})
    except Exception as e:
        print(f"❌ map_channel error: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

@api.route('/ignore-channel', methods=['POST'])
def ignore_channel():
    data = request.json
    try:
        db.table("ignored_channels").insert({
            "channel_id": data["channel_id"],
            "channel_name": data.get("channel_name", "unknown")
        }).execute()
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@api.route('/ignored-channels', methods=['GET'])
def get_ignored_channels():
    """Fetch list of ignored channels."""
    try:
        result = db.table("ignored_channels").select("*").execute()
        return jsonify(result.data)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@api.route('/bulk-ignore-channels', methods=['POST'])
def bulk_ignore_channels():
    """Ignore multiple channels at once."""
    data = request.json
    channel_ids = data.get("channel_ids", [])
    
    if not channel_ids:
        return jsonify({"error": "No channel IDs provided"}), 400
    
    try:
        # Insert all ignored channels
        records = [{"channel_id": ch_id, "channel_name": data.get("channel_names", {}).get(ch_id, "unknown")} 
                   for ch_id in channel_ids]
        db.table("ignored_channels").insert(records).execute()
        return jsonify({"success": True, "count": len(channel_ids)})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@api.route('/bulk-map-channels', methods=['POST'])
def bulk_map_channels():
    """Map multiple channels at once to projects or partnerships."""
    data = request.json
    channel_ids = data.get("channel_ids", [])
    client_name = data.get("client_name")
    is_partnership = data.get("is_partnership", False)
    role = data.get("role", "external")
    
    if not channel_ids or not client_name:
        return jsonify({"error": "Missing channel_ids or client_name"}), 400
    
    try:
        # For bulk operations, we'll create separate projects for each channel
        # using the client name as a base
        for idx, ch_id in enumerate(channel_ids):
            # If multiple channels, append number to client name
            final_name = f"{client_name} {idx + 1}" if len(channel_ids) > 1 else client_name
            
            # Check if project exists
            res = db.table("projects").select("id").eq("client_name", final_name).execute()
            
            field_to_update = "channel_id_internal" if role == "internal" else "channel_id_external"
            
            if not res.data:
                # Create new
                db.table("projects").insert({
                    "client_name": final_name,
                    field_to_update: ch_id,
                    "status_overview": "Initialized via Scanner (Bulk)",
                    "is_partnership": is_partnership
                }).execute()
            else:
                # Update existing
                db.table("projects").update({
                    field_to_update: ch_id,
                    "is_partnership": is_partnership
                }).eq("client_name", final_name).execute()
        
        return jsonify({"success": True, "count": len(channel_ids)})
    except Exception as e:
        print(f"❌ bulk_map_channels error: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@api.route('/unignore-channel', methods=['POST'])
def unignore_channel():
    """Remove a channel from the ignored list."""
    data = request.json
    channel_id = data.get("channel_id")
    
    if not channel_id:
        return jsonify({"error": "Missing channel_id"}), 400
    
    try:
        db.table("ignored_channels").delete().eq("channel_id", channel_id).execute()
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@api.route('/mapped-channels', methods=['GET'])
def get_mapped_channels():
    """Get all channels that are already mapped to projects/partnerships."""
    try:
        # Fetch all projects with their channel IDs
        projects = db.table("projects").select("id, client_name, channel_id_internal, channel_id_external, is_partnership").execute()
        
        mapped_channels = []
        for p in projects.data:
            # Add internal channel if exists
            if p.get('channel_id_internal'):
                mapped_channels.append({
                    "channel_id": p['channel_id_internal'],
                    "project_id": p['id'],
                    "project_name": p['client_name'],
                    "role": "internal",
                    "is_partnership": p.get('is_partnership', False)
                })
            
            # Add external channel if exists
            if p.get('channel_id_external'):
                mapped_channels.append({
                    "channel_id": p['channel_id_external'],
                    "project_id": p['id'],
                    "project_name": p['client_name'],
                    "role": "external",
                    "is_partnership": p.get('is_partnership', False)
                })
        
        return jsonify(mapped_channels)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ---------------------------------------------------------
# 📊 DASHBOARD & REPORTING
# ---------------------------------------------------------

@api.route('/projects', methods=['GET'])
@require_auth
def get_projects():
    try:
        user = g.user
        user_role = user.get('role')
        
        # 1. Fetch projects based on role
        if user_role in ['superadmin', 'internal', 'shopline']:
            # Show all projects (exclude partnerships)
            projects = db.table("projects").select("*").eq("is_partnership", False).order("client_name").execute().data
        elif user_role == 'merchant':
            # Show only assigned projects
            assigned_projects = user.get('assigned_projects', [])
            if not assigned_projects:
                return jsonify([])  # No projects assigned
            
            # Fetch only assigned projects, exclude archived
            projects = db.table("projects") \
                .select("*") \
                .in_("id", assigned_projects) \
                .eq("is_partnership", False) \
                .neq("status", "archived") \
                .order("client_name") \
                .execute().data
        else:
            return jsonify([])  # Unknown role
        
        dashboard_data = []
        
        for p in projects:
            # Use cached counts from database (auto-updated by trigger)
            # Fallback to 0 if migration 004 hasn't been run yet
            internal_count = p.get("comm_count_internal", 0) or 0
            external_count = p.get("comm_count_external", 0) or 0
            meetings_count = p.get("comm_count_meetings", 0) or 0
            
            # Get last activity
            last_pm_time = p.get("last_updated_at")
            
            dashboard_data.append({
                **p,
                "stats": {
                    "total_messages": internal_count + external_count,
                    "internal_messages": internal_count,
                    "external_messages": external_count,
                    "meetings": meetings_count,
                    "last_active": last_pm_time,
                    "active_source": "Report" if last_pm_time else None
                }
            })

        return jsonify(dashboard_data)
    except Exception as e:
        print(f"Projects API Error: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

@api.route('/partnerships', methods=['GET'])
def get_partnerships():
    """Get partnership channels (internal/superadmin only)"""
    try:
        # Fetch only partnership channels
        partnerships = db.table("projects").select("*").eq("is_partnership", True).order("client_name").execute().data
        
        dashboard_data = []
        
        for p in partnerships:
            # Use cached counts from database
            internal_count = p.get("comm_count_internal", 0) or 0
            external_count = p.get("comm_count_external", 0) or 0
            meetings_count = p.get("comm_count_meetings", 0) or 0
            
            # Get last activity
            last_pm_time = p.get("last_updated_at")
            
            dashboard_data.append({
                **p,
                "stats": {
                    "total_messages": internal_count + external_count,
                    "internal_messages": internal_count,
                    "external_messages": external_count,
                    "meetings": meetings_count,
                    "last_active": last_pm_time,
                    "active_source": "Report" if last_pm_time else None
                }
            })

        return jsonify(dashboard_data)
    except Exception as e:
        print(f"Partnerships API Error: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@api.route('/projects/<project_id>/update-report', methods=['POST'])
def update_project_report(project_id):
    """
    Updates Project Data. Includes robust error handling and date cleaning.
    """
    try:
        data = request.json
        print(f"📥 Received Update for Project {project_id}:", data) # DEBUG PRINT

        user_email = data.get("user_email", "system")
        new_data = data.get("updates", {})

        if not new_data:
            return jsonify({"error": "No updates provided"}), 400

        # --- SAFETY FIX: Clean Empty Dates ---
        # Converts "" to None (NULL) so Postgres doesn't crash
        date_fields = ["next_call", "last_contact_date", "launch_date_internal", "launch_date_public"]
        for field in date_fields:
            if field in new_data and new_data[field] == "":
                new_data[field] = None
        # -------------------------------------

        # Check for Slack Notification request
        send_slack = new_data.pop("send_slack", False)

        # 1. Fetch Current Data (for History Diff)
        current_res = db.table("projects").select("*").eq("id", project_id).execute()
        if not current_res.data:
            return jsonify({"error": "Project not found"}), 404
        current_project = current_res.data[0]
        
        # 2. Calculate History Diff
        changes = {}
        # Only track history for these specific important fields
        audit_fields = ["status_detail", "blocker", "category", "owner", "developer", "launch_date_public", "client_name"]
        
        has_changes = False
        for field in audit_fields:
            if field in new_data:
                old_val = str(current_project.get(field) or "")
                new_val = str(new_data[field] or "")
                if old_val != new_val:
                    has_changes = True
                    changes[field] = {"old": old_val, "new": new_val}

        # 3. Update History Log
        current_history = current_project.get("history") or []
        if has_changes:
            current_history.insert(0, {
                "timestamp": datetime.now().isoformat(),
                "user": user_email,
                "changes": changes
            })

        # 4. Prepare Final Payload
        # We merge the new data + the updated history
        final_payload = {
            **new_data, 
            "history": current_history,
            "last_updated_at": datetime.now().isoformat()
        }

        # 5. EXECUTE SAVE
        # If this fails, the 'except' block below will print the REAL reason.
        db.table("projects").update(final_payload).eq("id", project_id).execute()
        
        # 6. SEND SLACK NOTIFICATION IF REQUESTED
        if send_slack:
            try:
                client_name = new_data.get("client_name") or current_project.get("client_name")
                status = new_data.get("category") or current_project.get("category")
                note = new_data.get("status_detail") or current_project.get("status_detail")
                blocker = new_data.get("blocker") or current_project.get("blocker")
                pm = new_data.get("owner") or current_project.get("owner")
                
                slack_msg = f"*📢 PM Status Update: {client_name}*\n"
                slack_msg += f"• *Stage:* {status}\n"
                slack_msg += f"• *PM:* {pm}\n"
                if note:
                    slack_msg += f"• *Status Note:* {note}\n"
                if blocker:
                    slack_msg += f"• *🚨 Blocker:* {blocker}\n"
                
                slack_client.chat_postMessage(
                    channel="C09BMF2RKC0",
                    text=slack_msg,
                    unfurl_links=False
                )
                print(f"✅ Slack notification sent for {client_name}")
            except Exception as se:
                print(f"⚠️ Failed to send Slack notification: {se}")

        print("✅ Save Successful!")
        return jsonify({"success": True})

    except Exception as e:
        # THIS IS THE IMPORTANT PART
        print(f"❌ CRITICAL SAVE ERROR: {str(e)}")
        # Return the actual error message to the frontend alert
        return jsonify({"error": str(e)}), 500

# ---------------------------------------------------------
# 💬 HISTORY SYNC & LOGS
# ---------------------------------------------------------

@api.route('/sync-history', methods=['POST'])
def sync_history():
    data = request.json
    project_id = data.get("project_id")
    
    if not project_id:
        return jsonify({"error": "Missing project_id"}), 400

    try:
        # 1. Get Project
        project_res = db.table("projects").select("*").eq("id", project_id).execute()
        if not project_res.data:
            return jsonify({"error": "Project not found"}), 404
        
        project = project_res.data[0]
        
        # Explicit list of channels to scan with their intended visibility
        sync_targets = []
        if project.get("channel_id_internal"):
             sync_targets.append({"id": project["channel_id_internal"], "role": "internal"})
        if project.get("channel_id_external"):
             sync_targets.append({"id": project["channel_id_external"], "role": "external"})
        
        total_imported = 0
        
        # 2. Process each target channel
        for target in sync_targets:
            channel_id = target["id"]
            role = target["role"]

            print(f"📡 Syncing {role} channel: {channel_id} for project {project_id}")

            try:
                # A. Ensure Bot is in Channel
                try:
                    slack_client.conversations_join(channel=channel_id)
                except SlackApiError as e:
                    if e.response["error"] not in ["channel_not_found", "already_in_channel", "is_archived"]:
                         print(f"⚠️ Join warning on {channel_id}: {e.response['error']}")

                # B. Determine 'oldest' timestamp for incremental sync
                latest_res = db.table("communication_logs") \
                    .select("slack_ts") \
                    .eq("project_id", project_id) \
                    .eq("visibility", role) \
                    .order("slack_ts", desc=True) \
                    .limit(1) \
                    .execute()

                oldest_ts = latest_res.data[0]["slack_ts"] if latest_res.data else "0"
                
                # C. Fetch History
                history = slack_client.conversations_history(channel=channel_id, oldest=oldest_ts, limit=200)
                messages = history.get("messages", [])
                
                channel_imported = 0
                for msg in messages:
                    # Filter out system messages except important ones
                    if "subtype" in msg and msg["subtype"] not in ["bot_message", "file_share", "thread_broadcast"]:
                        continue

                    save_message_to_db(project_id, msg, visibility=role)
                    channel_imported += 1
                    total_imported += 1

                    # D. Fetch Thread Replies
                    if msg.get("reply_count", 0) > 0:
                        try:
                            thread_res = slack_client.conversations_replies(channel=channel_id, ts=msg["ts"], limit=100)
                            replies = thread_res.get("messages", [])
                            # Skip standard parent message
                            for reply in replies[1:]:
                                save_message_to_db(project_id, reply, visibility=role)
                                channel_imported += 1
                                total_imported += 1
                        except Exception as e:
                            print(f"   ⚠️ Thread error in {channel_id}: {e}")
                
                print(f"✅ Imported {channel_imported} messages from {role} channel.")

            except Exception as e:
                print(f"❌ Error syncing {role} channel {channel_id}: {e}")

        return jsonify({"success": True, "message": f"Successfully synced {total_imported} messages."})

    except Exception as e:
        print(f"🔥 CRITICAL SYNC ERROR: {e}")
        return jsonify({"error": str(e)}), 500

@api.route('/projects/<project_id>/logs', methods=['GET'])
@require_auth
def get_project_logs(project_id):
    try:
        user = g.user
        user_role = user.get('role')
        
        # Merchants can only see external communications
        if user_role == 'merchant':
            visibility = "external"
        else:
            visibility = request.args.get("visibility", "internal")  # Default to internal

        # Fetch logs, newest first
        res = db.table("communication_logs") \
            .select("*") \
            .eq("project_id", project_id) \
            .eq("visibility", visibility) \
            .order("slack_ts", desc=True) \
            .limit(100) \
            .execute()
        return jsonify(res.data)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@api.route('/projects/<project_id>/emails', methods=['GET'])
def get_project_emails(project_id):
    """Fetch emails for a project (source='email')"""
    try:
        res = db.table("communication_logs") \
            .select("*") \
            .eq("project_id", project_id) \
            .eq("source", "email") \
            .order("created_at", desc=True) \
            .limit(100) \
            .execute()

        return jsonify(res.data)
    except Exception as e:
        print(f"Error fetching emails: {e}")
        return jsonify({"error": str(e)}), 500


@api.route('/slack-users', methods=['GET'])
def get_slack_users():
    try:
        # Return a dictionary: { "U123": "Leo", "U456": "Evan" }
        users = db.table("slack_users").select("slack_id, real_name").execute().data
        user_map = {u["slack_id"]: u["real_name"] for u in users}
        return jsonify(user_map)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@api.route('/projects/<project_id>/channel-members', methods=['GET'])
def get_channel_members(project_id):
    """
    Fetch members from project's internal/external Slack channels.
    Returns: [{ "name": "Leo", "email": "leo@example.com", "slack_id": "U123" }, ...]
    """
    try:
        # Get project channels
        project = db.table("projects").select("channel_id_internal, channel_id_external").eq("id", project_id).execute()
        if not project.data:
            return jsonify({"error": "Project not found"}), 404
        
        channel_internal = project.data[0].get("channel_id_internal")
        channel_external = project.data[0].get("channel_id_external")
        
        members = []
        seen_ids = set()
        
        # Fetch members from both channels
        for channel_id in [channel_internal, channel_external]:
            if not channel_id:
                continue
            
            try:
                response = slack_client.conversations_members(channel=channel_id)
                member_ids = response.get("members", [])
                
                for user_id in member_ids:
                    if user_id in seen_ids:
                        continue
                    seen_ids.add(user_id)
                    
                    # Get user info
                    user_info = slack_client.users_info(user=user_id)
                    user = user_info.get("user", {})
                    profile = user.get("profile", {})
                    
                    # Skip bots
                    if user.get("is_bot"):
                        continue
                    
                    real_name = user.get("real_name") or profile.get("real_name") or user.get("name") or "Unknown"
                    email = profile.get("email") or ""
                    
                    members.append({
                        "slack_id": user_id,
                        "name": real_name,
                        "email": email
                    })
                    
            except SlackApiError as e:
                print(f"Error fetching members from {channel_id}: {e}")
                continue
        
        return jsonify(members)
        
    except Exception as e:
        print(f"Error in get_channel_members: {e}")
        return jsonify({"error": str(e)}), 500

# backend/app/api/routes.py
@api.route('/create-project', methods=['POST'])
def create_project():
    """
    1. Creates Project in DB.
    2. Auto-creates Slack Channels (#name-internal, #name-external).
    """
    data = request.json
    client_name = data.get("client_name")
    owner = data.get("owner", "Unassigned")

    if not client_name:
        return jsonify({"error": "Client Name is required"}), 400

    # 1. Clean Name for Slack (Lowercase, no spaces, max 21 chars)
    # e.g. "Fresh Peaches" -> "freshpeaches"
    clean_name = client_name.lower().replace(" ", "").replace("-", "").replace("_", "")[:21]
    
    internal_channel_name = f"{clean_name}-internal"
    external_channel_name = f"{clean_name}-external"

    created_channels = {}

    try:
        # 2. Create Channels in Slack
        for name in [internal_channel_name, external_channel_name]:
            try:
                # Requires 'channels:manage' scope!
                res = slack_client.conversations_create(name=name, is_private=False)
                channel = res["channel"]
                created_channels[name] = channel["id"]
                print(f"✅ Created channel {name}")
                
            except SlackApiError as e:
                if e.response["error"] == "name_taken":
                    print(f"⚠️ Channel {name} already exists.")
                    # In a real app, you might want to fetch the existing ID here
                else:
                    print(f"❌ Failed to create {name}: {e.response['error']}")
                    raise e

        # 3. Create DB Entry
        project_data = {
            "client_name": client_name,
            "owner": owner,
            "status_detail": "Initialized",
            "category": "New / In Progress",
            "channel_id_internal": created_channels.get(internal_channel_name),
            "channel_id_external": created_channels.get(external_channel_name)
        }
        
        db.table("projects").insert(project_data).execute()

        return jsonify({
            "success": True, 
            "message": f"Project '{client_name}' created!",
            "channels": list(created_channels.keys())
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500

# ---------------------------------------------------------
# 🤖 AI CHAT ASSISTANT
# ---------------------------------------------------------

@api.route('/ai/chat', methods=['POST'])
def ai_chat():
    """
    AI Assistant endpoint for internal users.
    Uses OpenAI to answer questions about projects.
    """
    from openai import OpenAI
    
    try:
        data = request.json or {}
        user_message = data.get("message", "").strip()
        
        if not user_message:
            return jsonify({"error": "No message provided"}), 400
        
        # Initialize OpenAI client
        client = OpenAI(api_key=settings.OPENAI_API_KEY)
        
        # Fetch ALL projects with all relevant fields
        projects = db.table("projects").select("*").execute().data
        
        # Count projects by owner
        owner_counts = {}
        for p in projects:
            owner = p.get('owner') or 'Unassigned'
            owner_counts[owner] = owner_counts.get(owner, 0) + 1
        
        # Format all projects as detailed context
        projects_list = []
        for p in projects:
            proj_info = f"- {p['client_name']}: Stage={p.get('category', 'Unknown')}, PM/Owner={p.get('owner') or 'Unassigned'}, Developer={p.get('developer') or 'Unassigned'}"
            if p.get('status_detail'):
                proj_info += f", Latest Status: {p['status_detail'][:150]}"
            if p.get('blocker'):
                proj_info += f", BLOCKER: {p['blocker']}"
            if p.get('live_url'):
                proj_info += f", Live: {p['live_url']}"
            projects_list.append(proj_info)
        
        projects_context = "\n".join(projects_list)
        
        # Owner counts summary
        counts_summary = ", ".join([f"{name}: {count} projects" for name, count in owner_counts.items()])
        
        system_prompt = f"""You are an AI assistant for the Alien Portal project management system.
You help internal team members from Flyrank and Powercommerce with questions about their client projects.

TEAM MEMBER ALIASES (treat these as the same person):
- "Leo" = "Leo Peng" = "leo" = any PM containing "Leo"
- "Labros" = "Labros Karampitsas" = any developer containing "Labros"
- "Jason" = "Jason Tan" = any PM containing "Jason"

PROJECT COUNTS BY PM/OWNER:
{counts_summary}

TOTAL PROJECTS: {len(projects)}

ALL PROJECTS (complete list):
{projects_context}

IMPORTANT INSTRUCTIONS:
1. When asked "how many projects does X have", count ALL projects where owner contains that name (case-insensitive)
2. List every matching project by name when giving counts
3. Be precise with numbers - count carefully
4. If a project has a blocker, highlight it
5. Use the actual data above, don't make up information

Answer concisely and accurately. If you're unsure, say so."""

        # Call OpenAI
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message}
            ],
            max_tokens=800,
            temperature=0.3  # Lower temperature for more accuracy
        )
        
        ai_response = response.choices[0].message.content
        
        return jsonify({
            "response": ai_response,
            "success": True
        })
        
    except Exception as e:
        print(f"❌ AI Chat Error: {e}")
        return jsonify({"error": str(e)}), 500