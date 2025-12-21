# backend/app/services/email_sync_service.py
"""
Email sync service for AI vector stores.
Fetches emails and formats them for OpenAI.
"""
from app.core.supabase import db
from typing import List, Dict, Optional
from datetime import datetime


def sync_emails(project_id: str, last_sync: Optional[str] = None) -> List[Dict]:
    """
    Fetch all emails for a project.
    
    Args:
        project_id: Project ID
        last_sync: ISO timestamp of last sync. If None, fetches ALL emails.
        
    Returns:
        List of formatted email entries
    """
    emails_query = db.table("emails").select("*").eq("project_id", project_id)
    
    if last_sync:
        # Incremental sync - only new emails
        emails_query = emails_query.gte("created_at", last_sync)
    
    emails = emails_query.order("created_at", desc=False).execute()
    
    email_data = []
    
    for email in emails.data:
        email_data.append({
            'type': 'email',
            'content': f"""From: {email.get('from_email', 'Unknown')}
To: {email.get('to_email', 'Unknown')}
Date: {email.get('created_at', 'Unknown')}
Subject: {email.get('subject', 'No subject')}

{email.get('body', '')}""",
            'timestamp': email.get('created_at', datetime.now().isoformat())
        })
    
    return email_data


def format_emails_for_upload(emails: List[Dict]) -> str:
    """
    Format emails into a single text document for vector store upload.
    
    Args:
        emails: List of email entries
        
    Returns:
        Formatted text document
    """
    if not emails:
        return ""
    
    sections = []
    
    for email in emails:
        sections.append("=" * 50)
        sections.append(email['content'])
        sections.append("")  # Blank line
    
    return "\n".join(sections)
