# backend/app/services/activity_logger.py
"""
Activity logging service for tracking all platform operations.
Logs are stored in the activity_logs table for superadmin monitoring.
"""
from app.core.supabase import db
from datetime import datetime
from typing import Optional, Dict
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
    """
    try:
        db.table("activity_logs").insert({
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
    except Exception as e:
        # Don't fail the operation if logging fails
        print(f"Failed to log activity: {e}")


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
