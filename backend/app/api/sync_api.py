# backend/app/api/sync_api.py
"""
Global sync API endpoints.
Handles global sync operations and activity log retrieval.
"""
from flask import Blueprint, jsonify, request, g
from app.api.auth import require_auth, require_role
from app.services import global_sync_service, activity_logger

sync_api = Blueprint('sync_api', __name__)


@sync_api.route('/sync/global', methods=['POST'])
@require_auth
@require_role('superadmin', 'internal')
def global_sync():
    """
    Run global sync: contacts, Slack IDs, and AI knowledge for all projects.
    Only accessible to superadmin and internal users.
    """
    try:
        user_id = g.user.get('id')
        user_name = g.user.get('name', 'Unknown')
        
        result = global_sync_service.run_global_sync(user_id, user_name)
        
        if result['success']:
            return jsonify({
                'success': True,
                'message': 'Global sync completed successfully',
                'data': result
            })
        else:
            return jsonify({
                'success': False,
                'error': result.get('error', 'Unknown error'),
                'duration_ms': result.get('duration_ms')
            }), 500
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@sync_api.route('/logs', methods=['GET'])
@require_auth
@require_role('superadmin')
def get_activity_logs():
    """
    Get activity logs with filtering and pagination.
    Only accessible to superadmins.
    
    Query params:
    - action_type: Filter by action type
    - user_id: Filter by user
    - status: Filter by status (success, error, in_progress)
    - resource_type: Filter by resource type
    - start_date: Filter by start date (ISO format)
    - end_date: Filter by end date (ISO format)
    - limit: Number of results (default 100, max 500)
    - offset: Offset for pagination (default 0)
    """
    try:
        action_type = request.args.get('action_type')
        user_id = request.args.get('user_id')
        status = request.args.get('status')
        resource_type = request.args.get('resource_type')
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')
        limit = min(int(request.args.get('limit', 100)), 500)
        offset = int(request.args.get('offset', 0))
        
        logs = activity_logger.get_activity_logs(
            action_type=action_type,
            user_id=user_id,
            status=status,
            resource_type=resource_type,
            start_date=start_date,
            end_date=end_date,
            limit=limit,
            offset=offset
        )
        
        return jsonify({
            'success': True,
            'logs': logs,
            'count': len(logs)
        })
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500
