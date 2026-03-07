# Backend Server Startup Guide

## Issue
Python 3.14.0 has compatibility issues with `httpcore` library. Use Python 3.11 or 3.12 instead.

## Quick Start

### Option 1: Use Python 3.11 or 3.12 (Recommended)

1. Install Python 3.11 or 3.12 from https://www.python.org/downloads/
2. Create a virtual environment:
   ```bash
   python3.11 -m venv venv
   # or
   python3.12 -m venv venv
   ```

3. Activate the virtual environment:
   - Windows PowerShell:
     ```powershell
     .\venv\Scripts\Activate.ps1
     ```
   - Windows CMD:
     ```cmd
     venv\Scripts\activate.bat
     ```
   - Mac/Linux:
     ```bash
     source venv/bin/activate
     ```

4. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

5. Start the server:
   ```bash
   python app.py
   ```

### Option 2: Fix Python 3.14 Compatibility (Advanced)

If you must use Python 3.14, try updating httpcore:

```bash
pip install --upgrade httpcore httpx
```

## Verify Backend is Running

Once started, you should see:
```
🚀 Lorri backend starting on port 5000
```

Test the health endpoint:
```bash
curl http://localhost:5000/api/health
```

Or open in browser: http://localhost:5000/api/health

## Environment Variables

The backend reads from `backend/.env` file. Make sure it contains:

```
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_key
GROQ_API_KEY=your_groq_key
HF_API_KEY=your_hf_key
```

## Troubleshooting

- **Port 5000 already in use**: Change port in `app.py` or kill the process using port 5000
- **Module not found**: Run `pip install -r requirements.txt`
- **Supabase connection error**: Check your `.env` file credentials
