# backend/app/api/reports.py
"""
AI-powered Reports API for Alien Portal.
Generates executive reports using OpenAI assistants.
"""
from flask import Blueprint, jsonify, request, g
from app.api.auth import require_auth, require_role
from app.core.supabase import db
import openai
import json
import re
import random
import string
import traceback
from datetime import datetime, timedelta, timezone

reports_api = Blueprint('reports_api', __name__)


def get_openai_client():
    """Get OpenAI client with API key from settings."""
    try:
        result = db.table("app_settings").select("value").eq("key", "OPENAI_API_KEY").execute()
        if result.data and result.data[0].get('value'):
            return openai.OpenAI(api_key=result.data[0]['value'])
    except:
        pass
    return None


def generate_report_id():
    """Generate a unique 4-character alphanumeric report ID."""
    max_attempts = 10
    for _ in range(max_attempts):
        # Generate random 4-char ID (uppercase letters + digits)
        report_id = ''.join(random.choices(string.ascii_uppercase + string.digits, k=4))
        
        # Check if it already exists (only if table exists)
        try:
            result = db.table("report_history").select("id").eq("report_id", report_id).execute()
            if not result.data:
                return report_id
        except Exception as e:
            # Table doesn't exist yet - just return the ID
            print(f"[REPORTS] Note: report_history table not found, skipping uniqueness check: {e}")
            return report_id
    
    # Fallback to 6-char if collision (very unlikely)
    return ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))


def get_project_data():
    """Fetch all project data for reports."""
    projects = db.table("projects").select("*").execute()
    return projects.data


def get_recent_logs(project_id, days=7):
    """Get recent communication logs for a project."""
    cutoff = (datetime.now() - timedelta(days=days)).isoformat()
    logs = db.table("communication_logs").select("content, sender_name, created_at, visibility")\
        .eq("project_id", project_id)\
        .gte("created_at", cutoff)\
        .order("created_at", desc=True)\
        .limit(10)\
        .execute()
    return logs.data


def calculate_migration_progress(checklist):
    """Calculate completion percentage from checklist."""
    if not checklist or not isinstance(checklist, dict):
        return 0
    total = len(checklist)
    if total == 0:
        return 0
    completed = sum(1 for v in checklist.values() if v is True)
    return round((completed / total) * 100)


@reports_api.route('/generate', methods=['POST'])
@require_auth
@require_role('superadmin', 'internal')
def generate_report():
    """
    Generate an AI-powered report.
    """
    try:
        data = request.json
        report_type = data.get('report_type', 'pm_status')
        project_ids = data.get('project_ids', [])
        stages = data.get('stages')  # None for all, or list of stage names
        excluded_projects = data.get('excluded_projects', [])  # List of project IDs to exclude
        
        # Get OpenAI client
        client = get_openai_client()
        if not client:
            return jsonify({"error": "OpenAI API key not configured. Add it in Settings."}), 400
        
        # Get project data
        # Get all projects (exclude partnerships - they're not client projects)
        all_projects = [p for p in get_project_data() if not p.get('is_partnership', False)]
        
        # Filter projects
        if project_ids:
            projects = [p for p in all_projects if p['id'] in project_ids]
        else:
            # Default to active projects only (exclude Launched) to match PM Station
            # This ensures reports focus on projects that need attention
            projects = [p for p in all_projects if p.get('category') != 'Launched']
        
        # Apply stage filtering if specified
        if stages:
            projects = [p for p in projects if p.get('category') in stages]
        
        # Apply project exclusion if specified
        if excluded_projects:
            projects = [p for p in projects if p['id'] not in excluded_projects]
        
        if not projects:
            return jsonify({"error": "No active projects found"}), 404
        
        # Use CET timezone (UTC+1)
        cet = timezone(timedelta(hours=1))
        current_time = datetime.now(cet).strftime("%b %d, %Y %H:%M:%S")
        
        # Build context based on report type
        if report_type == 'pm_status':
            # Calculate counts for filtered projects (what we're actually reporting on)
            filtered_counts = {}
            for p in projects:
                cat = p.get('category', 'Unknown')
                filtered_counts[cat] = filtered_counts.get(cat, 0) + 1
            
            # Build category list for prompt (only categories that exist in filtered projects)
            category_lines = []
            category_emojis = {
                'New / In Progress': '🔵',
                'Almost Ready': '🟡',
                'Ready': '🟢',
                'Stuck / On Hold': '🔴',
                'Launched': '🟣'
            }
            for cat, count in filtered_counts.items():
                emoji = category_emojis.get(cat, '⚪')
                category_lines.append(f"    - {emoji} {cat.upper()} ({count})")
            
            categories_to_include = "\n".join(category_lines)
            total_filtered = sum(filtered_counts.values())
            
            context = build_detailed_pm_context(projects)
            system_prompt = f"""You are an expert PM lead generating a "PM Status Report".
    The report must follow this EXACT structure:

    # PM Status Report
    Report created at: {current_time}

    Group projects by their status category. For EACH category, show:
    1. Category header with emoji and count (e.g., "🔵 NEW / IN PROGRESS (5)")
    2. List each project with ALL details in this format:

    Project: [Project Name]
    - PM Notes: [status_detail]
    - Update Time: [last_updated_at in format: Dec 17, 2025 22:54:03]
    - Blockers: [blocker or "None"]
    - Developer & PM: [developer] / [owner]
    - Last Call / Contact Date: [last_contact_date or "N/A"]
    - Scheduled Call: [next_call or "N/A"]
    - ETA PC: [eta_pc or "N/A"]
    - ETA SL: [eta_sl or "N/A"]
    - Going Live Date: [launch_date_public or "TBD"]
    - URLs: [live_url], [shopify_url]

    3. Add a blank line between projects for readability

    Categories to include (ONLY show these categories that are in the filtered data):
{categories_to_include}

    Do NOT include any other categories.

    Final Section:
    ### Overall Summary & Suggestions
    Provide a high-level overview showing the filtered project counts (Total: {total_filtered} projects).
    Add specific suggestions for the team based on the filtered projects.

    Be professional, detailed, and highly readable."""

        elif report_type == 'migration_tracker':
            # Calculate counts for filtered migration projects
            migration_counts = {}
            for p in projects:
                cat = p.get('category', 'Unknown')
                migration_counts[cat] = migration_counts.get(cat, 0) + 1
            
            # Build category list for prompt
            migration_category_lines = []
            for cat, count in migration_counts.items():
                emoji = category_emojis.get(cat, '⚪')
                migration_category_lines.append(f"    - {emoji} {cat.upper()} ({count})")
            
            migration_categories_to_include = "\n".join(migration_category_lines)
            total_migration = sum(migration_counts.values())
            
            context = build_migration_context(projects)
            system_prompt = f"""You are an expert migration project lead generating a "Migration Progress Report".
    The report must follow this EXACT structure (matching PM Status Report style):

    # Migration Progress Report
    Report created at: {current_time}

    Group projects by their migration stage. For EACH category, show:
    1. Category header with emoji and count (e.g., "🔵 NEW / IN PROGRESS ({migration_counts['New / In Progress']})")
    2. List each project with ALL details in this format:

    Project: [Project Name]
    - Migration Status: [Progress description]
    - Update Time: [last_updated_at in format: Dec 17, 2025 22:54:03]
    - Blockers: [blocker or "None"]  
    - Developer & PM: [developer] / [owner]
    - Launch Date: [launch_date_public]
    - URLs: [live_url], [shopify_url]

    3. Add a blank line between projects for readability

    Categories to include (ONLY show these categories that are in the filtered data):
{migration_categories_to_include}

    Do NOT include any other categories.

    Final Section:
    ### Overall Summary & Recommendations
    Provide migration progress overview showing the filtered project counts (Total: {total_migration} projects).
    Add specific next steps and recommendations for the migration team based on the filtered projects.

    Be professional, detailed, and highly readable."""

        elif report_type == 'communication':
            context = build_communication_context(projects)
            system_prompt = """You are an executive report generator summarizing client communications.
    Generate a Communication Summary Report.
    Include: Last contact dates, scheduled calls, recent discussion highlights.
    Flag any projects with no recent contact (>14 days).
    Be brief but informative. Focus on actionable insights."""

        else:
            return jsonify({"error": f"Unknown report type: {report_type}"}), 400
            
    except Exception as e:
        print(f"[REPORTS] Pre-generation Error: {e}")
        traceback.print_exc()
        return jsonify({"error": f"Failed to prepare report data: {str(e)}"}), 500
    
    try:
        # Generate report using OpenAI
        print(f"[REPORTS] Generating {report_type} report for {len(projects)} projects")
        print(f"[REPORTS] Context length: {len(context)} chars")
        
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"Generate the report based on this data:\n\n{context}"}
            ],
            temperature=0.7,
            max_tokens=3000
        )
        
        report_content = response.choices[0].message.content
        print(f"[REPORTS] Successfully generated report ({len(report_content)} chars)")
        
        # Generate unique report ID
        report_id = generate_report_id()
        generated_at = datetime.now().isoformat()
        
        # Save report to database
        try:
            db.table("report_history").insert({
                "report_id": report_id,
                "report_type": report_type,
                "content": report_content,
                "project_count": len(projects),
                "generated_by": g.user['id'],
                "generated_at": generated_at,
                "metadata": {
                    "project_ids": project_ids if project_ids else [],
                    "total_projects": len(all_projects),
                    "active_projects": len(projects),
                    "stages": stages if stages else "all",
                    "excluded_projects": excluded_projects if excluded_projects else []
                }
            }).execute()
            print(f"[REPORTS] Saved report to database with ID: {report_id}")
        except Exception as db_error:
            print(f"[REPORTS] Warning: Failed to save report to database: {db_error}")
            # Continue anyway - don't fail the request if DB save fails
        
        return jsonify({
            "success": True,
            "report_id": report_id,
            "report_type": report_type,
            "generated_at": generated_at,
            "project_count": len(projects),
            "content": report_content
        })
        
    except openai.AuthenticationError as e:
        print(f"[REPORTS] OpenAI Authentication Error: {e}")
        return jsonify({"error": "OpenAI API key is invalid. Please check Settings."}), 401
    except openai.RateLimitError as e:
        print(f"[REPORTS] OpenAI Rate Limit Error: {e}")
        return jsonify({"error": "OpenAI rate limit exceeded. Please try again later."}), 429
    except openai.APIError as e:
        print(f"[REPORTS] OpenAI API Error: {e}")
        return jsonify({"error": f"OpenAI API error: {str(e)}"}), 500
    except Exception as e:
        print(f"[REPORTS] Report generation error: {type(e).__name__}: {e}")
        traceback.print_exc()
        return jsonify({"error": f"Failed to generate report: {str(e)}"}), 500


def build_detailed_pm_context(projects):
    """Build highly detailed context for PM status report."""
    lines = []
    
    for p in projects:
        # Format URLs
        urls = []
        if p.get('live_url'):
            urls.append(p['live_url'])
        if p.get('shopify_url'):
            urls.append(p['shopify_url'])
        urls_str = ', '.join(urls) if urls else 'N/A'
        
        lines.append(f"""
PROJ: {p.get('client_name', 'Unknown')}
- PM: {p.get('owner', 'Unassigned')}
- DEV: {p.get('developer', 'Unassigned')}
- STAGE: {p.get('category', 'Unknown')}
- NOTES: {p.get('status_detail', 'No update')}
- BLOCKER: {p.get('blocker', 'None')}
- LAST UPDATED: {p.get('last_updated_at', 'N/A')}
- LAST CONTACT: {p.get('last_contact_date', 'N/A')}
- SCHEDULED CALL: {p.get('next_call', 'N/A')}
- ETA PC: {p.get('eta_pc', 'N/A')}
- ETA SL: {p.get('eta_sl', 'N/A')}
- GOING LIVE: {p.get('launch_date_public', 'TBD')}
- URLS: {urls_str}
""")
    
    return "\n".join(lines)


@reports_api.route('/send-to-slack', methods=['POST'])
@require_auth
@require_role('superadmin', 'internal')
def send_report_to_slack():
    """Send a generated report to Slack."""
    from slack_sdk import WebClient
    from app.core.config import settings
    from dateutil import parser as date_parser
    
    data = request.json
    content = data.get('content')
    report_type = data.get('report_type', 'Status Report')
    user_id = data.get('user_id')  # Slack user ID for DM
    
    if not content:
        return jsonify({"error": "No content to send"}), 400
    
    try:
        slack_client = WebClient(token=settings.SLACK_BOT_TOKEN)
        
        # Convert Markdown to Slack mrkdwn format
        s_content = content
        
        # Remove the main title (# PM Status Report, # Migration Progress Report, etc.)
        # This prevents duplicate headers since we show it in the Slack block header
        s_content = re.sub(r'^#\s+.*Report.*$', '', s_content, flags=re.MULTILINE)
        
        # Convert headers (Slack doesn't support headers, use bold + newlines)
        # Skip # headers since we removed the main one
        s_content = re.sub(r'^## (.*)$', r'\n*\1*', s_content, flags=re.MULTILINE)
        s_content = re.sub(r'^### (.*)$', r'_\1_', s_content, flags=re.MULTILINE)
        s_content = re.sub(r'^#### (.*)$', r'`\1`', s_content, flags=re.MULTILINE)
        
        # Convert bold: markdown **text** to Slack *text*
        s_content = re.sub(r'\*\*([^*]+)\*\*', r'*\1*', s_content)
        
        # Convert italic: markdown *text* to Slack _text_ (careful with order!)
        # This needs to happen after bold conversion
        
        # Format timestamps: Convert ISO format to human-readable
        # Match patterns like: 2025-12-17T12:59:34.473299+00:00
        def format_timestamp(match):
            try:
                timestamp_str = match.group(1)
                dt = date_parser.parse(timestamp_str)
                return dt.strftime('%b %d, %Y at %I:%M %p')
            except:
                return match.group(1)
        
        s_content = re.sub(r'(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:\+\d{2}:\d{2})?)', format_timestamp, s_content)
        
        # Also format date-only patterns like 2025-12-17
        def format_date(match):
            try:
                date_str = match.group(1)
                dt = datetime.strptime(date_str, '%Y-%m-%d')
                return dt.strftime('%b %d, %Y')
            except:
                return match.group(1)
        
        s_content = re.sub(r'(\d{4}-\d{2}-\d{2})(?!T)', format_date, s_content)
        
        # Add color coding for project categories using emojis
        # New / In Progress = 🔵 (blue)
        # Almost Ready = 🟡 (yellow)  
        # Ready = 🟢 (green)
        # Stuck / On Hold = 🔴 (red)
        # Launched = 🟣 (purple)
        s_content = re.sub(r'\*\*New / In Progress\*\*', '🔵 *New / In Progress*', s_content)
        s_content = re.sub(r'\*\*Almost Ready\*\*', '🟡 *Almost Ready*', s_content)
        s_content = re.sub(r'\*\*Ready\*\*', '🟢 *Ready*', s_content)
        s_content = re.sub(r'\*\*Stuck / On Hold\*\*', '🔴 *Stuck / On Hold*', s_content)
        s_content = re.sub(r'\*\*Launched\*\*', '🟣 *Launched*', s_content)
        
        # Also add colors to category mentions in project lines
        s_content = re.sub(r'STAGE: New / In Progress', '🔵 STAGE: New / In Progress', s_content)
        s_content = re.sub(r'STAGE: Almost Ready', '🟡 STAGE: Almost Ready', s_content)
        s_content = re.sub(r'STAGE: Ready', '🟢 STAGE: Ready', s_content)
        s_content = re.sub(r'STAGE: Stuck / On Hold', '🔴 STAGE: Stuck / On Hold', s_content)
        s_content = re.sub(r'STAGE: Launched', '🟣 STAGE: Launched', s_content)
        
        # Remove "Report created at:" line since we show it in the header
        s_content = re.sub(r'Report created at:.*?\n', '', s_content)
        
        # Split into chunks if too long for a single block
        chunks = [s_content[i:i+2900] for i in range(0, len(s_content), 2900)]
        
        # Get better report type name
        report_type_names = {
            'pm_status': 'PM Status Report',
            'migration_tracker': 'Migration Progress Report',
            'communication': 'Communication Summary'
        }
        report_title = report_type_names.get(report_type, report_type)
        
        blocks = [
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": f"📊 *{report_title}*\nGenerated: {datetime.now(timezone(timedelta(hours=1))).strftime('%b %d, %Y at %H:%M')} CET"
                }
            },
            {"type": "divider"}
        ]
        
        for chunk in chunks:
            blocks.append({
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": chunk
                }
            })
        
        # Send to Slack (channel or DM)
        channel = user_id if user_id else "C09BMF2RKC0"  # Use user_id for DM, otherwise #operations channel
        
        slack_client.chat_postMessage(
            channel=channel,
            blocks=blocks
        )
        
        return jsonify({"success": True})
    except Exception as e:
        print(f"Slack Send Error: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": f"Failed to send to Slack: {str(e)}"}), 500


def build_pm_status_context(projects):
    """Build context for PM status report."""
    lines = ["# Active Projects Status\n"]
    
    for p in projects:
        lines.append(f"""
## {p.get('client_name', 'Unknown')}
- **PM:** {p.get('owner', 'Unassigned')}
- **Developer:** {p.get('developer', 'Unassigned')}
- **Stage:** {p.get('category', 'Unknown')}
- **Status:** {p.get('status_detail', 'No update')}
- **Blocker:** {p.get('blocker', 'None')}
- **Last Contact:** {p.get('last_contact_date', 'Unknown')}
- **Next Call:** {p.get('next_call', 'Not scheduled')}
- **ETA PC:** {p.get('eta_pc', 'N/A')}
- **ETA SL:** {p.get('eta_sl', 'N/A')}
""")
    
    return "\n".join(lines)


def build_migration_context(projects):
    """Build context for migration tracker report."""
    lines = ["# Migration Progress Data\n"]
    
    # Group by category
    by_category = {}
    for p in projects:
        cat = p.get('category', 'Unknown')
        if cat not in by_category:
            by_category[cat] = []
        by_category[cat].append(p)
    
    for cat, projs in by_category.items():
        lines.append(f"\n## {cat}\n")
        for p in projs:
            progress = calculate_migration_progress(p.get('migration_checklist', {}))
            launch_internal = p.get('launch_date_internal', 'TBD')
            launch_public = p.get('launch_date_public', 'TBD')
            
            lines.append(f"""
### {p.get('client_name', 'Unknown')}
- **Progress:** {progress}%
- **Blocker:** {p.get('blocker', 'None')}
- **Est. Internal Launch:** {launch_internal}
- **Est. Public Launch:** {launch_public}
- **PM:** {p.get('owner', 'Unassigned')}
""")
    
    return "\n".join(lines)


def build_communication_context(projects):
    """Build context for communication summary report."""
    lines = ["# Communication Summary\n"]
    
    today = datetime.now()
    
    for p in projects:
        last_contact = p.get('last_contact_date')
        days_since = "Unknown"
        if last_contact:
            try:
                last_dt = datetime.fromisoformat(last_contact.replace('Z', ''))
                days_since = (today - last_dt).days
            except:
                pass
        
        # Get recent logs
        recent_logs = get_recent_logs(p.get('id'), days=7)
        log_summary = f"{len(recent_logs)} messages in last 7 days" if recent_logs else "No recent messages"
        
        lines.append(f"""
## {p.get('client_name', 'Unknown')}
- **Last Contact:** {last_contact or 'Unknown'} ({days_since} days ago)
- **Next Call:** {p.get('next_call', 'Not scheduled')}
- **Comm Channels:** {p.get('comm_channels', 'Not specified')}
- **Recent Activity:** {log_summary}
- **PM:** {p.get('owner', 'Unassigned')}
""")
    
    return "\n".join(lines)


@reports_api.route('/types', methods=['GET'])
@require_auth
@require_role('superadmin', 'internal')
def get_report_types():
    """Get available report types."""
    return jsonify([
        {
            "id": "pm_status",
            "name": "PM Status Report",
            "description": "Detailed project status grouped by stage with trackers",
            "icon": "📋"
        },
        {
            "id": "migration_tracker",
            "name": "Migration Progress",
            "description": "Progress percentages, completion status, and launch dates",
            "icon": "📊"
        },
        {
            "id": "communication",
            "name": "Communication Summary",
            "description": "Recent contacts, scheduled calls, and activity highlights",
            "icon": "💬"
        }
    ])


@reports_api.route('/history', methods=['GET'])
@require_auth
@require_role('superadmin', 'internal')
def get_report_history():
    """Get last 10 generated reports."""
    try:
        result = db.table("report_history")\
            .select("id, report_id, report_type, generated_at, project_count, generated_by")\
            .order("generated_at", desc=True)\
            .limit(10)\
            .execute()
        
        # Fetch user names for generated_by
        reports = result.data if result.data else []
        
        # Get unique user IDs
        user_ids = list(set([r['generated_by'] for r in reports if r.get('generated_by')]))
        
        # Fetch user names
        user_map = {}
        if user_ids:
            users_result = db.table("portal_users")\
                .select("id, display_name, email")\
                .in_("id", user_ids)\
                .execute()
            
            for user in users_result.data:
                user_map[user['id']] = user.get('display_name') or user.get('email')
        
        # Add user names to reports
        for report in reports:
            if report.get('generated_by'):
                report['generated_by_name'] = user_map.get(report['generated_by'], 'Unknown')
        
        return jsonify(reports)
    except Exception as e:
        print(f"[REPORTS] Error fetching history: {e}")
        # If table doesn't exist, return empty array instead of error
        if "report_history" in str(e) and "does not exist" in str(e).lower():
            print("[REPORTS] Note: report_history table not found. Run migration to enable history.")
            return jsonify([])
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@reports_api.route('/<report_id>', methods=['GET'])
@require_auth
@require_role('superadmin', 'internal')
def get_report_by_id(report_id):
    """Get a specific report by its ID."""
    try:
        result = db.table("report_history")\
            .select("*")\
            .eq("report_id", report_id.upper())\
            .execute()
        
        if not result.data:
            return jsonify({"error": "Report not found"}), 404
        
        report = result.data[0]
        
        # Fetch user name
        if report.get('generated_by'):
            user_result = db.table("portal_users")\
                .select("display_name, email")\
                .eq("id", report['generated_by'])\
                .execute()
            
            if user_result.data:
                user = user_result.data[0]
                report['generated_by_name'] = user.get('display_name') or user.get('email')
        
        return jsonify(report)
    except Exception as e:
        print(f"[REPORTS] Error fetching report {report_id}: {e}")
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@reports_api.route('/history/<report_id>', methods=['DELETE'])
@require_auth
@require_role('superadmin', 'internal')
def delete_report(report_id):
    """Delete a report from history."""
    try:
        result = db.table("report_history")\
            .delete()\
            .eq("report_id", report_id.upper())\
            .execute()
        
        return jsonify({"success": True, "message": "Report deleted"})
    except Exception as e:
        print(f"[REPORTS] Error deleting report {report_id}: {e}")
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@reports_api.route('/compare', methods=['POST'])
@require_auth
@require_role('superadmin', 'internal')
def compare_reports():
    """Compare two reports using AI."""
    data = request.json
    report_id_1 = data.get('report_id_1', '').upper()
    report_id_2 = data.get('report_id_2', '').upper()
    
    if not report_id_1 or not report_id_2:
        return jsonify({"error": "Both report_id_1 and report_id_2 are required"}), 400
    
    try:
        # Fetch both reports
        result1 = db.table("report_history")\
            .select("*")\
            .eq("report_id", report_id_1)\
            .execute()
        
        result2 = db.table("report_history")\
            .select("*")\
            .eq("report_id", report_id_2)\
            .execute()
        
        if not result1.data:
            return jsonify({"error": f"Report {report_id_1} not found"}), 404
        
        if not result2.data:
            return jsonify({"error": f"Report {report_id_2} not found"}), 404
        
        report1 = result1.data[0]
        report2 = result2.data[0]
        
        # Get OpenAI client
        client = get_openai_client()
        if not client:
            return jsonify({"error": "OpenAI API key not configured"}), 400
        
        # Generate comparison using OpenAI
        comparison_prompt = f"""You are analyzing two project status reports. Compare them and provide insights.

Report 1 (ID: {report_id_1}, Date: {report1['generated_at']}):
{report1['content']}

---

Report 2 (ID: {report_id_2}, Date: {report2['generated_at']}):
{report2['content']}

---

Please provide a comprehensive comparison including:
1. **Key Changes**: What has changed between the two reports?
2. **Progress**: Which projects have made progress? Which are stuck?
3. **New Issues**: Any new blockers or concerns?
4. **Resolved Issues**: What problems were resolved?
5. **Recommendations**: What should the team focus on?

Be specific, data-driven, and actionable."""

        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "You are an expert project manager analyzing status reports."},
                {"role": "user", "content": comparison_prompt}
            ],
            temperature=0.7,
            max_tokens=2000
        )
        
        comparison = response.choices[0].message.content
        
        return jsonify({
            "success": True,
            "report_1": {
                "id": report_id_1,
                "date": report1['generated_at'],
                "type": report1['report_type']
            },
            "report_2": {
                "id": report_id_2,
                "date": report2['generated_at'],
                "type": report2['report_type']
            },
            "comparison": comparison
        })
        
    except Exception as e:
        print(f"[REPORTS] Error comparing reports: {e}")
        traceback.print_exc()
        return jsonify({"error": f"Failed to compare reports: {str(e)}"}), 500

