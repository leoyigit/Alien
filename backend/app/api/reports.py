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
from datetime import datetime, timedelta

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
    data = request.json
    report_type = data.get('report_type', 'pm_status')
    project_ids = data.get('project_ids', [])
    
    # Get OpenAI client
    client = get_openai_client()
    if not client:
        return jsonify({"error": "OpenAI API key not configured. Add it in Settings."}), 400
    
    # Get project data
    all_projects = get_project_data()
    
    # Filter projects
    if project_ids:
        projects = [p for p in all_projects if p['id'] in project_ids]
    else:
        # Default to all projects for PM status report to get counts right, 
        # but AI will focus on non-launched ones for details if requested.
        projects = all_projects
    
    if not projects:
        return jsonify({"error": "No projects found"}), 404
    
    current_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    # Build context based on report type
    if report_type == 'pm_status':
        # Calculate counts
        counts = {
            "New / In Progress": sum(1 for p in projects if p.get('category') == 'New / In Progress'),
            "Almost Ready": sum(1 for p in projects if p.get('category') == 'Almost Ready'),
            "Ready": sum(1 for p in projects if p.get('category') == 'Ready'),
            "Stuck / On Hold": sum(1 for p in projects if p.get('category') == 'Stuck / On Hold'),
            "Launched": sum(1 for p in projects if p.get('category') == 'Launched')
        }
        
        context = build_detailed_pm_context(projects)
        system_prompt = f"""You are an expert PM lead generating a "PM Status Report".
The report must follow this EXACT structure:

# PM Status Report
## {counts['New / In Progress']} New, {counts['Almost Ready']} Almost Ready, {counts['Ready']} Ready, {counts['Stuck / On Hold']} Stuck, {counts['Launched']} Launched
Report created at: {current_time}

Group projects by their status (New / In Progress, Almost Ready, Ready, Stuck / On Hold, Launched).
For each project, include ALL available details in a readable format:
- Project Name (as a header)
- PM Notes (status_detail)
- Update Time (last_updated_at)
- Blockers
- Developer & PM
- Last Call / Contact Date
- Any other useful information (URLs, next steps)

Final Section:
### Overall Summary & Suggestions
Provide a high-level overview of the portfolio health and specific suggestions for the team.

Be professional, detailed, and highly readable."""

    elif report_type == 'migration_tracker':
        context = build_migration_context(projects)
        system_prompt = """You are an executive report generator for a migration project team.
Generate a Migration Tracker Report showing progress on each project.
Format: Table-like summary with progress percentages.
Include: Completion %, current blockers, estimated launch date.
Group by stage (New/In Progress, Almost Ready, Stuck).
Highlight projects needing attention. Be data-driven and concise."""

    elif report_type == 'communication':
        context = build_communication_context(projects)
        system_prompt = """You are an executive report generator summarizing client communications.
Generate a Communication Summary Report.
Include: Last contact dates, scheduled calls, recent discussion highlights.
Flag any projects with no recent contact (>14 days).
Be brief but informative. Focus on actionable insights."""

    else:
        return jsonify({"error": f"Unknown report type: {report_type}"}), 400
    
    try:
        # Generate report using OpenAI
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
        
        return jsonify({
            "success": True,
            "report_type": report_type,
            "generated_at": datetime.now().isoformat(),
            "project_count": len(projects),
            "content": report_content
        })
        
    except Exception as e:
        print(f"Report generation error: {e}")
        return jsonify({"error": f"Failed to generate report: {str(e)}"}), 500


def build_detailed_pm_context(projects):
    """Build highly detailed context for PM status report."""
    lines = []
    
    for p in projects:
        lines.append(f"""
PROJ: {p.get('client_name', 'Unknown')}
- PM: {p.get('owner', 'Unassigned')}
- DEV: {p.get('developer', 'Unassigned')}
- STAGE: {p.get('category', 'Unknown')}
- NOTES: {p.get('status_detail', 'No update')}
- BLOCKER: {p.get('blocker', 'None')}
- LAST UPDATED: {p.get('last_updated_at', 'N/A')}
- LAST CONTACT: {p.get('last_contact_date', 'N/A')}
- NEXT CALL: {p.get('next_call', 'N/A')}
- URLS: {p.get('live_url', 'N/A')}, {p.get('shopify_url', 'N/A')}
""")
    
    return "\n".join(lines)


@reports_api.route('/send-to-slack', methods=['POST'])
@require_auth
@require_role('superadmin', 'internal')
def send_report_to_slack():
    """Send a generated report to Slack."""
    from slack_sdk import WebClient
    from app.core.config import settings
    
    data = request.json
    content = data.get('content')
    report_type = data.get('report_type', 'Status Report')
    
    if not content:
        return jsonify({"error": "No content to send"}), 400
    
    try:
        slack_client = WebClient(token=settings.SLACK_BOT_TOKEN)
        
        # Convert Markdown-ish report to Slack mrkdwn
        # Slack doesn't support # headers, so we use bold
        s_content = content
        s_content = re.sub(r'^# (.*)$', r'*\1*', s_content, flags=re.MULTILINE)
        s_content = re.sub(r'^## (.*)$', r'*\1*', s_content, flags=re.MULTILINE)
        s_content = re.sub(r'^### (.*)$', r'_\1_', s_content, flags=re.MULTILINE)
        
        # Split into chunks if too long for a single block
        chunks = [s_content[i:i+2900] for i in range(0, len(s_content), 2900)]
        
        blocks = [
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": f"🚀 *{report_type} Update*\nGenerated at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"
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
        
        slack_client.chat_postMessage(
            channel="C09BMF2RKC0",
            blocks=blocks
        )
        
        return jsonify({"success": True})
    except Exception as e:
        print(f"Slack Send Error: {e}")
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
