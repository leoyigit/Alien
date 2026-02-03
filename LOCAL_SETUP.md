# Running Alien Portal Locally

## Prerequisites
- Python 3.x installed
- Node.js and npm installed
- Environment variables configured (`.env` file in backend)

## Backend (Flask API)

### 1. Navigate to backend directory
```bash
cd /Users/leo/Downloads/_Development/Alien/backend
```

### 2. Install dependencies (first time only)
```bash
pip install -r requirements.txt
```

### 3. Run the Flask server
```bash
python main.py
```

**Backend will run on**: `http://localhost:5000`

---

## Frontend (React + Vite)

### 1. Open a NEW terminal window and navigate to frontend directory
```bash
cd /Users/leo/Downloads/_Development/Alien/frontend
```

### 2. Install dependencies (first time only)
```bash
npm install
```

### 3. Run the development server
```bash
npm run dev
```

**Frontend will run on**: `http://localhost:5173` (or similar port shown in terminal)

---

## Testing Your Changes

### Test 1: Going Live Date in Reports
1. Open browser to `http://localhost:5173`
2. Login to the portal
3. Navigate to **Reports** page
4. Generate a **PM Status Report**
5. Check that projects show:
   - Actual date if `launch_date_public` is set
   - "TBD" if `launch_date_public` is not set

### Test 2: Email Categorization
1. Send a test email to the mailbox channel from:
   - Internal email (e.g., `leo@flyrank.com`)
   - External email (e.g., client email)
2. Check the communication logs in the database or UI
3. Verify:
   - Internal emails → `visibility: "internal"`
   - External emails → `visibility: "external"`

---

## Stopping the Servers

- **Backend**: Press `Ctrl+C` in the backend terminal
- **Frontend**: Press `Ctrl+C` in the frontend terminal
