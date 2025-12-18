# backend/app/api/chat.py
"""
AlienGPT Chat API - Interactive AI assistant for project queries
"""
from flask import Blueprint, jsonify, request, g
from app.api.auth import require_auth, require_role
from app.core.supabase import db
import openai
import json
from datetime import datetime, timedelta

chat_api = Blueprint('chat_api', __name__)


def get_openai_client():
    """Get OpenAI client with API key from settings."""
    try:
        result = db.table("app_settings").select("value").eq("key", "OPENAI_API_KEY").execute()
        if result.data and result.data[0].get('value'):
            return openai.OpenAI(api_key=result.data[0]['value'])
    except:
        pass
    return None


def build_project_context():
    """Build context from all projects"""
    projects = db.table("projects").select("*").execute()
    
    context_lines = []
    for p in projects.data:
        context_lines.append(f"""
Project: {p.get('client_name')}
- Status: {p.get('category', 'Unknown')}
- PM: {p.get('owner', 'Unassigned')}
- Developer: {p.get('developer', 'Unassigned')}
- Notes: {p.get('status_detail', 'No update')}
- Blocker: {p.get('blocker', 'None')}
- Last Updated: {p.get('last_updated_at', 'N/A')}
- Launch Date (Internal): {p.get('launch_date_internal', 'N/A')}
- Launch Date (Public): {p.get('launch_date_public', 'N/A')}
- URLs: {p.get('live_url', 'N/A')}
""")
    
    return "\n".join(context_lines)


def build_communication_context():
    """Build context from recent communication logs"""
    cutoff = (datetime.now() - timedelta(days=14)).isoformat()
    logs = db.table("communication_logs").select("*")\
        .gte("created_at", cutoff)\
        .order("created_at", desc=True)\
        .limit(50)\
        .execute()
    
    context_lines = []
    for log in logs.data:
        project_id = log.get('project_id')
        # Get project name
        proj = db.table("projects").select("client_name").eq("id", project_id).execute()
        project_name = proj.data[0]['client_name'] if proj.data else 'Unknown'
        
        context_lines.append(f"""
Communication for {project_name}:
- Type: {log.get('source', 'unknown')}
- From: {log.get('sender_name', 'Unknown')}
- Date: {log.get('created_at', 'N/A')}
- Content: {log.get('content', '')[:200]}...
""")
    
    return "\n".join(context_lines[:20])  # Limit to avoid token overflow


@chat_api.route('/message', methods=['POST'])
@require_auth
@require_role('superadmin', 'internal')
def send_message():
    """
    Send a message to AlienGPT and get AI response
    """
    data = request.json
    user_message = data.get('message', '')
    conversation_history = data.get('history', [])
    
    if not user_message:
        return jsonify({"error": "Message is required"}), 400
    
    # Get OpenAI client
    client = get_openai_client()
    if not client:
        return jsonify({"error": "OpenAI API key not configured"}), 400
    
    # Build context
    project_context = build_project_context()
    comm_context = build_communication_context()
    
    system_prompt = f"""You are AlienGPT, an AI assistant for the Alien Portal project management system.
You have access to all project data and communication logs.

CRITICAL FORMATTING RULES:
1. When showing project data, ALWAYS use properly formatted markdown tables
2. Use this EXACT markdown table format:

| Column 1 | Column 2 | Column 3 |
|----------|----------|----------|
| Data 1   | Data 2   | Data 3   |

3. Keep table data concise - truncate long text to fit nicely
4. For dates, use format: "Dec 18" or "2 days ago"
5. Use bullet points for summaries and insights
6. Use **bold** for important information (blockers, alerts)

EXAMPLE RESPONSE FORMAT:
"There are 3 stuck projects:

| Project | PM | Blocker | Last Updated |
|---------|-----|---------|--------------|
| Project A | Leo | Client delay | Dec 17 |
| Project B | Bule | API issues | Dec 15 |

**Key Issues:**
- Most blockers are client-related
- Bule needs support with API integration"

Current Project Data:
{project_context}

Recent Communications (last 14 days):
{comm_context}

Be helpful, professional, and insightful. ALWAYS use proper markdown tables for data."""
    
    # Build messages
    messages = [{"role": "system", "content": system_prompt}]
    
    # Add conversation history (limit to last 10 messages)
    for msg in conversation_history[-10:]:
        messages.append({
            "role": msg.get("role"),
            "content": msg.get("content")
        })
    
    # Add current user message
    messages.append({"role": "user", "content": user_message})
    
    try:
        print(f"[CHAT] Processing message: {user_message[:50]}...")
        
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=messages,
            temperature=0.7,
            max_tokens=2000
        )
        
        ai_message = response.choices[0].message.content
        print(f"[CHAT] Response generated ({len(ai_message)} chars)")
        
        return jsonify({
            "success": True,
            "message": ai_message,
            "timestamp": datetime.now().isoformat()
        })
        
    except openai.AuthenticationError as e:
        print(f"[CHAT] OpenAI Authentication Error: {e}")
        return jsonify({"error": "OpenAI API key is invalid"}), 401
    except openai.RateLimitError as e:
        print(f"[CHAT] OpenAI Rate Limit Error: {e}")
        return jsonify({"error": "Rate limit exceeded. Please try again later."}), 429
    except Exception as e:
        print(f"[CHAT] Error: {type(e).__name__}: {e}")
        return jsonify({"error": f"Failed to process message: {str(e)}"}), 500


@chat_api.route('/clear', methods=['POST'])
@require_auth
@require_role('superadmin', 'internal')
def clear_conversation():
    """Clear conversation history"""
    return jsonify({"success": True, "message": "Conversation cleared"})
