# backend/app/services/pm_sync_service.py
"""
PM data sync service for AI vector stores.
Fetches all PM inputs and formats them for OpenAI.
"""
from app.core.supabase import db
from typing import List, Dict, Optional
from datetime import datetime


def sync_pm_data(project_id: str, last_sync: Optional[str] = None) -> List[Dict]:
    """
    Fetch all PM data for a project.
    
    Args:
        project_id: Project ID
        last_sync: ISO timestamp of last sync. If None, fetches ALL data.
        
    Returns:
        List of formatted PM data entries
    """
    pm_data = []
    
    # Get project details
    project = db.table("projects").select("*").eq("id", project_id).execute()
    if not project.data:
        return []
    
    p = project.data[0]
    
    # 1. Project basic info
    pm_data.append({
        'type': 'project_info',
        'content': f"""Project: {p.get('client_name')}
Status: {p.get('category', 'Unknown')}
Launch Date: {p.get('launch_date', 'Not set')}
Store URL: {p.get('store_url', 'Not set')}
Admin URL: {p.get('admin_url', 'Not set')}
PM: {p.get('owner', 'Not assigned')}
Developer: {p.get('developer', 'Not assigned')}""",
        'timestamp': p.get('created_at', datetime.now().isoformat())
    })
    
    # 2. Get all reports (PM notes, updates, blockers)
    reports_query = db.table("report_history").select("*").eq("project_id", project_id)
    
    if last_sync:
        # Incremental sync - only new/updated reports
        reports_query = reports_query.gte("created_at", last_sync)
    
    reports = reports_query.order("created_at", desc=False).execute()
    
    for report in reports.data:
        content_parts = []
        
        # Add notes
        if report.get('notes'):
            content_parts.append(f"Notes: {report['notes']}")
        
        # Add blockers
        if report.get('blocker'):
            blocker_status = "Active" if report.get('blocker') == 'yes' else "Resolved"
            blocker_text = report.get('blocker_text', '')
            content_parts.append(f"Blocker ({blocker_status}): {blocker_text}")
        
        # Add updates from JSON
        if report.get('updates'):
            updates = report['updates']
            if isinstance(updates, dict):
                for key, value in updates.items():
                    if value:
                        content_parts.append(f"{key}: {value}")
        
        if content_parts:
            pm_data.append({
                'type': 'pm_report',
                'content': f"""Date: {report.get('created_at', 'Unknown')}
PM: {report.get('created_by', 'Unknown')}

{chr(10).join(content_parts)}""",
                'timestamp': report.get('created_at', datetime.now().isoformat())
            })
    
    return pm_data


def format_pm_data_for_upload(pm_data: List[Dict]) -> str:
    """
    Format PM data entries into a single text document for vector store upload.
    
    Args:
        pm_data: List of PM data entries
        
    Returns:
        Formatted text document
    """
    if not pm_data:
        return ""
    
    sections = []
    
    for entry in pm_data:
        sections.append(f"=== {entry['type'].upper()} ===")
        sections.append(entry['content'])
        sections.append("")  # Blank line
    
    return "\n".join(sections)
