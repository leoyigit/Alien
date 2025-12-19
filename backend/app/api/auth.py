# backend/app/api/auth.py
"""
Authentication API endpoints for Alien Portal.
Handles login, logout, user profile, and user management.
"""
from flask import Blueprint, jsonify, request, g
from functools import wraps
from app.core.supabase import db, admin_db
from app.core.config import settings
import os

auth = Blueprint('auth', __name__)

# =============================================================================
# DECORATORS
# =============================================================================

def require_auth(f):
    """Middleware to require authentication."""
    @wraps(f)
    def wrapper(*args, **kwargs):
        auth_header = request.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            return jsonify({"error": "Missing or invalid authorization header"}), 401
        
        token = auth_header.split(' ')[1]
        try:
            # Verify token with Supabase
            user_response = db.auth.get_user(token)
            if not user_response or not user_response.user:
                return jsonify({"error": "Invalid token"}), 401
            
            # Get user profile with role
            profile = db.table("portal_users").select("*").eq("id", user_response.user.id).execute()
            if not profile.data:
                return jsonify({"error": "User profile not found"}), 404
            
            g.user = profile.data[0]
            g.auth_user = user_response.user
            
        except Exception as e:
            print(f"Auth error: {e}")
            return jsonify({"error": "Authentication failed"}), 401
        
        return f(*args, **kwargs)
    return wrapper


def require_role(*allowed_roles):
    """Decorator to require specific roles."""
    def decorator(f):
        @wraps(f)
        def wrapper(*args, **kwargs):
            user = g.get('user')
            if not user:
                return jsonify({"error": "Not authenticated"}), 401
            if user['role'] not in allowed_roles:
                return jsonify({"error": "Forbidden - insufficient permissions"}), 403
            return f(*args, **kwargs)
        return wrapper
    return decorator


# =============================================================================
# AUTH ENDPOINTS
# =============================================================================

@auth.route('/login', methods=['POST'])
def login():
    """Login with email/password."""
    data = request.json
    email = data.get('email')
    password = data.get('password')
    
    if not email or not password:
        return jsonify({"error": "Email and password required"}), 400
    
    try:
        # Sign in with Supabase Auth
        response = db.auth.sign_in_with_password({
            "email": email,
            "password": password
        })
        
        if not response.user:
            return jsonify({"error": "Invalid credentials"}), 401
        
        # Get user profile - Use admin_db to bypass RLS during login flow
        profile = admin_db.table("portal_users").select("*").eq("id", response.user.id).execute()
        
        profile_data = None
        if profile.data:
            profile_data = profile.data[0]
        else:
            # Self-healing: Create missing profile
            try:
                if not settings.SUPABASE_SERVICE_ROLE_KEY:
                    print("⚠️ SUPABASE_SERVICE_ROLE_KEY is missing! Self-healing will fail due to RLS.")
                    raise ValueError("Service role key missing")

                email = response.user.email
                role = 'merchant'
                if '@flyrank.com' in email or '@powercommerce.com' in email:
                    role = 'internal'
                elif '@shopline.com' in email:
                    role = 'shopline'
                
                new_profile = {
                    "id": response.user.id,
                    "email": email,
                    "role": role,
                    "display_name": email.split('@')[0]
                }
                # Use admin_db to bypass RLS policies
                admin_db.table("portal_users").insert(new_profile).execute()
                profile_data = new_profile
                print(f"Self-healed missing profile for {email}")
            except Exception as e:
                error_msg = str(e)
                print(f"Failed to self-heal profile: {error_msg}")
                
                # If it's a duplicate key, it means the profile actually exists now
                # BUT we need to fetch it with admin_db to see it!
                if "23505" in error_msg or "duplicate key" in error_msg.lower():
                    retry_profile = admin_db.table("portal_users").select("*").eq("id", response.user.id).execute()
                    if retry_profile.data:
                        profile_data = retry_profile.data[0]
                        print(f"Recovered profile after duplicate check for {email}")

                if "42501" in error_msg or "row-level security" in error_msg.lower():
                    print("❌ RLS ERROR: The Service Role Key provided does not have bypass permissions OR is actually just the Anon key.")

        return jsonify({
            "success": True,
            "user": {
                "id": response.user.id,
                "email": response.user.email,
                "profile": profile_data
            },
            "session": {
                "access_token": response.session.access_token,
                "refresh_token": response.session.refresh_token,
                "expires_at": response.session.expires_at
            }
        })
        
    except Exception as e:
        print(f"Login error: {e}")
        return jsonify({"error": "Invalid email or password"}), 401


@auth.route('/signup', methods=['POST'])
def signup():
    """Register a new user."""
    data = request.json
    email = data.get('email')
    password = data.get('password')
    name = data.get('name', '')
    
    if not email or not password:
        return jsonify({"error": "Email and password required"}), 400
    
    if len(password) < 6:
        return jsonify({"error": "Password must be at least 6 characters"}), 400
    
    try:
        # Sign up with Supabase Auth
        response = db.auth.sign_up({
            "email": email,
            "password": password,
            "options": {
                "data": {"name": name}
            }
        })
        
        if not response.user:
            return jsonify({"error": "Signup failed"}), 400
        
        return jsonify({
            "success": True,
            "message": "Account created successfully",
            "user_id": response.user.id
        })
        
    except Exception as e:
        error_msg = str(e)
        if "already registered" in error_msg.lower():
            return jsonify({"error": "Email already registered"}), 409
        print(f"Signup error: {e}")
        return jsonify({"error": "Signup failed"}), 400


@auth.route('/logout', methods=['POST'])
@require_auth
def logout():
    """Logout current user."""
    try:
        db.auth.sign_out()
        return jsonify({"success": True, "message": "Logged out"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@auth.route('/me', methods=['GET'])
@require_auth
def get_current_user():
    """Get current user profile and role."""
    return jsonify({
        "user": g.user,
        "email": g.auth_user.email
    })


# =============================================================================
# USER MANAGEMENT (Admin Only)
# =============================================================================

@auth.route('/users', methods=['GET'])
@require_auth
@require_role('superadmin', 'internal')
def list_users():
    """List all portal users."""
    try:
        users = db.table("portal_users").select("*").order("created_at", desc=True).execute()
        return jsonify(users.data)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@auth.route('/users/<user_id>', methods=['PUT'])
@require_auth
@require_role('superadmin')
def update_user(user_id):
    """Update user role or assigned projects."""
    data = request.json
    allowed_fields = ['role', 'display_name', 'assigned_projects']
    
    updates = {k: v for k, v in data.items() if k in allowed_fields}
    
    if not updates:
        return jsonify({"error": "No valid fields to update"}), 400
    
    try:
        db.table("portal_users").update(updates).eq("id", user_id).execute()
        return jsonify({"success": True, "message": "User updated"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@auth.route('/users/<user_id>', methods=['DELETE'])
@require_auth
@require_role('superadmin')
def delete_user(user_id):
    """Delete a user (removes from portal_users, auth.users handles cascade)."""
    try:
        # Don't allow self-deletion
        if user_id == g.user['id']:
            return jsonify({"error": "Cannot delete yourself"}), 400
        
        db.table("portal_users").delete().eq("id", user_id).execute()
        return jsonify({"success": True, "message": "User deleted"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@auth.route('/forgot-password', methods=['POST'])
def forgot_password():
    """Send password reset email."""
    data = request.json
    email = data.get('email')
    
    if not email:
        return jsonify({"error": "Email is required"}), 400
    
    try:
        # Use Supabase to send reset email
        db.auth.reset_password_email(email)
        return jsonify({
            "success": True,
            "message": "Password reset email sent"
        })
    except Exception as e:
        print(f"Password reset error: {e}")
        # Don't reveal if email exists or not for security
        return jsonify({
            "success": True,
            "message": "If an account exists with this email, you will receive a reset link"
        })
