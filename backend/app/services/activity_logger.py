# backend/app/services/activity_logger.py
"""
Activity logging service for tracking all platform operations.
Logs are stored in the activity_logs table for superadmin monitoring.
"""
from app.core.supabase import db
from datetime import datetime
from typing import Optional, Dict, List
import traceback


def log_activity(
    user_id: str,
    user_name: str,
    action_type: str,
    resource_type: Optional[str] = None,
    resource_id: Optional[str] = None,
    resource_name: Optional[str] = None,
    status: str = 'success',
    details: Optional[Dict] = None,
    duration_ms: Optional[int] = None
):
    """
    Log an activity to the database.
    
    Args:
        user_id: User who performed the action
        user_name: User's display name
        action_type: Type of action (sync_contacts, sync_ai, ai_chat, etc.)
        resource_type: Type of resource (project, contact, global, etc.)
        resource_id: ID of the resource
        resource_name: Name of the resource
        status: Status (success, error, in_progress)
        details: Additional data (error messages, counts, etc.)
        duration_ms: Duration in milliseconds
    
    Returns:
        The ID of the created log entry
    """
    try:
        result = db.table("activity_logs").insert({
            "user_id": user_id,
            "user_name": user_name,
            "action_type": action_type,
            "resource_type": resource_type,
            "resource_id": resource_id,
            "resource_name": resource_name,
            "status": status,
            "details": details,
            "duration_ms": duration_ms
        }).execute()
        return result.data[0]['id'] if result.data else None
    except Exception as e:
        # Don't fail the operation if logging fails
        print(f"Failed to log activity: {e}")
        return None


def update_activity_log(log_id: str, status: Optional[str] = None, details: Optional[Dict] = None, duration_ms: Optional[int] = None):
    """
    Update an existing activity log entry.
    
    Args:
        log_id: ID of the log entry to update
        status: New status (if updating)
        details: New details (if updating)
        duration_ms: Duration in milliseconds (if updating)
    """
    try:
        update_data = {}
        if status is not None:
            update_data['status'] = status
        if details is not None:
            update_data['details'] = details
        if duration_ms is not None:
            update_data['duration_ms'] = duration_ms
        
        if update_data:
            db.table("activity_logs").update(update_data).eq("id", log_id).execute()
    except Exception as e:
        print(f"Failed to update activity log: {e}")


def append_console_output(log_id: str, line: str):
    """
    Append a console output line to an existing activity log.
    
    Args:
        log_id: ID of the log entry
        line: Console output line to append
    """
    try:
        # Get current log
        result = db.table("activity_logs").select("details").eq("id", log_id).execute()
        if result.data:
            details = result.data[0].get('details', {})
            if 'console_output' not in details:
                details['console_output'] = []
            details['console_output'].append({
                'line': line,
                'timestamp': datetime.now().strftime('%H:%M:%S')
            })
            db.table("activity_logs").update({"details": details}).eq("id", log_id).execute()
    except Exception as e:
        print(f"Failed to append console output: {e}")


def log_error(
    user_id: str,
    user_name: str,
    action_type: str,
    error: Exception,
    resource_type: Optional[str] = None,
    resource_id: Optional[str] = None,
    resource_name: Optional[str] = None,
    duration_ms: Optional[int] = None
):
    """
    Log an error with full stack trace.
    
    Args:
        user_id: User who performed the action
        user_name: User's display name
        action_type: Type of action that failed
        error: The exception that occurred
        resource_type: Type of resource
        resource_id: ID of the resource
        resource_name: Name of the resource
        duration_ms: Duration in milliseconds
    """
    log_activity(
        user_id=user_id,
        user_name=user_name,
        action_type=action_type,
        resource_type=resource_type,
        resource_id=resource_id,
        resource_name=resource_name,
        status='error',
        details={
            'error': str(error),
            'error_type': type(error).__name__,
            'traceback': traceback.format_exc()
        },
        duration_ms=duration_ms
    )


def get_activity_logs(
    action_type: Optional[str] = None,
    user_id: Optional[str] = None,
    status: Optional[str] = None,
    resource_type: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    limit: int = 100,
    offset: int = 0
):
    """
    Get activity logs with filtering and pagination.
    
    Args:
        action_type: Filter by action type
        user_id: Filter by user
        status: Filter by status
        resource_type: Filter by resource type
        start_date: Filter by start date (ISO format)
        end_date: Filter by end date (ISO format)
        limit: Number of results to return
        offset: Offset for pagination
        
    Returns:
        List of activity logs
    """
    query = db.table("activity_logs").select("*")
    
    if action_type:
        query = query.eq("action_type", action_type)
    if user_id:
        query = query.eq("user_id", user_id)
    if status:
        query = query.eq("status", status)
    if resource_type:
        query = query.eq("resource_type", resource_type)
    if start_date:
        query = query.gte("timestamp", start_date)
    if end_date:
        query = query.lte("timestamp", end_date)
    
    query = query.order("timestamp", desc=True).range(offset, offset + limit - 1)
    
    result = query.execute()
    return result.data
