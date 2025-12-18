# backend/app/utils/email_parser.py
"""
Email parsing utilities for Slack-forwarded emails.
Extracts metadata and body from emails posted to Slack Mailbox channel.
"""

import re
from datetime import datetime
from typing import Dict, List, Optional


def parse_slack_email(message_text: str) -> Optional[Dict]:
    """
    Parse email content from Slack message.
    
    Slack email format:
    From: Name <email@domain.com>
    To: recipient
    Subject: Email subject
    Date: Mon, Dec 15, 2025 at 9:39 PM
    
    ---------- Forwarded message ---------
    From: ...
    
    Email body...
    
    Returns:
        {
            'from_name': str,
            'from_email': str,
            'to_emails': [str],
            'cc_emails': [str],
            'subject': str,
            'date': str,
            'body': str,
            'is_forwarded': bool
        }
    """
    try:
        lines = message_text.split('\n')
        
        # Initialize result
        result = {
            'from_name': '',
            'from_email': '',
            'to_emails': [],
            'cc_emails': [],
            'subject': '',
            'date': '',
            'body': '',
            'is_forwarded': False
        }
        
        # Check if it's a forwarded message
        if '---------- Forwarded message' in message_text or 'Forwarded message' in message_text:
            result['is_forwarded'] = True
            # Find the start of forwarded content
            for i, line in enumerate(lines):
                if 'Forwarded message' in line:
                    # Parse forwarded section
                    forwarded_data = parse_forwarded_section(lines[i:])
                    if forwarded_data:
                        result.update(forwarded_data)
                    break
        else:
            # Parse direct email (not forwarded)
            result = parse_direct_email(lines)
        
        return result if result['from_email'] else None
        
    except Exception as e:
        print(f"Error parsing email: {e}")
        return None


def parse_forwarded_section(lines: List[str]) -> Optional[Dict]:
    """Parse the forwarded message section."""
    result = {
        'from_name': '',
        'from_email': '',
        'to_emails': [],
        'cc_emails': [],
        'subject': '',
        'date': '',
        'body': ''
    }
    
    body_start_idx = None
    
    for i, line in enumerate(lines):
        line = line.strip()
        
        if line.startswith('From:'):
            # Extract name and email
            name, email = extract_name_email(line.replace('From:', '').strip())
            result['from_name'] = name
            result['from_email'] = email
            
        elif line.startswith('Date:'):
            result['date'] = line.replace('Date:', '').strip()
            
        elif line.startswith('Subject:'):
            result['subject'] = line.replace('Subject:', '').strip()
            
        elif line.startswith('To:'):
            # Extract all TO emails
            to_line = line.replace('To:', '').strip()
            result['to_emails'] = extract_all_emails(to_line)
            
        elif line.startswith('Cc:'):
            # Extract all CC emails
            cc_line = line.replace('Cc:', '').strip()
            result['cc_emails'] = extract_all_emails(cc_line)
            
        elif line == '' and i > 5 and not body_start_idx:
            # First empty line after headers = start of body
            body_start_idx = i + 1
    
    # Extract body
    if body_start_idx:
        body_lines = lines[body_start_idx:]
        # Stop at signature separators
        for i, line in enumerate(body_lines):
            if '---' in line and 'Reply above' in ''.join(body_lines[i:i+3]):
                body_lines = body_lines[:i]
                break
        result['body'] = '\n'.join(body_lines).strip()
    
    return result


def parse_direct_email(lines: List[str]) -> Dict:
    """Parse direct email (not forwarded)."""
    result = {
        'from_name': '',
        'from_email': '',
        'to_emails': [],
        'cc_emails': [],
        'subject': '',
        'date': '',
        'body': ''
    }
    
    body_start_idx = None
    
    for i, line in enumerate(lines):
        line = line.strip()
        
        if line.startswith('From:'):
            name, email = extract_name_email(line.replace('From:', '').strip())
            result['from_name'] = name
            result['from_email'] = email
            
        elif line.startswith('Subject:'):
            result['subject'] = line.replace('Subject:', '').strip()
            
        elif line.startswith('Date:'):
            result['date'] = line.replace('Date:', '').strip()
            
        elif line.startswith('To:'):
            to_line = line.replace('To:', '').strip()
            result['to_emails'] = extract_all_emails(to_line)
            
        elif line == '' and i > 3 and not body_start_idx:
            body_start_idx = i + 1
    
    if body_start_idx:
        body_lines = lines[body_start_idx:]
        for i, line in enumerate(body_lines):
            if '---' in line:
                body_lines = body_lines[:i]
                break
        result['body'] = '\n'.join(body_lines).strip()
    
    return result


def extract_name_email(text: str) -> tuple:
    """
    Extract name and email from 'Name <email>' format.
    
    Examples:
        'Léo Yigit <leo@flyrank.com>' -> ('Léo Yigit', 'leo@flyrank.com')
        '<leo@flyrank.com>' -> ('', 'leo@flyrank.com')
        'leo@flyrank.com' -> ('', 'leo@flyrank.com')
    """
    # Pattern: Name <email@domain.com>
    match = re.search(r'(.+?)\s*<([^>]+)>', text)
    if match:
        name = match.group(1).strip()
        email = match.group(2).strip()
        return name, email
    
    # Just email
    email_match = re.search(r'([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})', text)
    if email_match:
        return '', email_match.group(1)
    
    return '', ''


def extract_all_emails(text: str) -> List[str]:
    """
    Extract all email addresses from a string.
    
    Examples:
        '<sonia@mixed.com>, sales@mixed.com' -> ['sonia@mixed.com', 'sales@mixed.com']
    """
    emails = re.findall(r'<([^>]+@[^>]+)>|([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})', text)
    # Flatten and filter
    result = []
    for match in emails:
        email = match[0] if match[0] else match[1]
        if email:
            result.append(email.strip())
    return result


def extract_domain(email: str) -> str:
    """Extract domain from email address."""
    if '@' in email:
        return email.split('@')[1].lower()
    return ''


def match_project_by_email(email: str, projects: List[Dict]) -> Optional[Dict]:
    """
    Match project by checking stakeholder emails.
    
    Args:
        email: Email address to match
        projects: List of all projects with stakeholders
        
    Returns:
        Matching project or None
    """
    for project in projects:
        stakeholders = project.get('stakeholders', [])
        for stakeholder in stakeholders:
            if stakeholder.get('email', '').lower() == email.lower():
                return project
    return None


def match_project_by_domain(email: str, projects: List[Dict]) -> Optional[Dict]:
    """
    Match project by email domain.
    
    Examples:
        sonia@mixedupclothing.com -> Match project with mixedupclothing domain
    """
    domain = extract_domain(email)
    if not domain:
        return None
    
    for project in projects:
        # Check live_url domain
        live_url = project.get('live_url', '')
        if domain in live_url.lower():
            return project
            
        # Check shopify_url domain
        shopify_url = project.get('shopify_url', '')
        if domain in shopify_url.lower():
            return project
            
        # Check client name similarity
        client_name = project.get('client_name', '').lower().replace(' ', '')
        domain_name = domain.split('.')[0]  # Get first part before TLD
        if domain_name in client_name or client_name in domain_name:
            return project
    
    return None


def match_project_by_name(subject: str, body: str, projects: List[Dict]) -> Optional[Dict]:
    """
    Match project by finding client name in subject or body.
    """
    search_text = f"{subject} {body}".lower()
    
    for project in projects:
        client_name = project.get('client_name', '').lower()
        if len(client_name) > 3 and client_name in search_text:
            return project
    
    return None
