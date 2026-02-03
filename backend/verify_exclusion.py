
import sys
import os

# Add the current directory to the python path so we can import from app
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.services import access_control
from flask import Flask, g

# Mock flask app context
app = Flask(__name__)

def verify():
    with app.app_context():
        # Mock user
        g.user = {'id': 'test_user', 'role': 'superadmin'}
        
        print("--- Checking Accessible Projects ---")
        projects = access_control.get_user_accessible_projects('test_user', 'superadmin')
        shopline_found = False
        for p in projects:
            print(f"Project: {p['name']}")
            if p['name'] == 'Shopline':
                shopline_found = True
        
        if shopline_found:
            print("\n❌ 'Shopline' was found in the project list.")
        else:
            print("\n✅ 'Shopline' was NOT found in the project list.")

        print("\n--- Checking Vector Stores ---")
        stores = access_control.get_all_vector_stores()
        print(f"Total vector stores found: {len(stores)}")

if __name__ == "__main__":
    verify()
