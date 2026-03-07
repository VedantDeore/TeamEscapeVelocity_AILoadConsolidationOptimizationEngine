"""
Configuration settings for the Lorri backend.
Reads from .env file.
"""

import os
from dotenv import load_dotenv

load_dotenv()

# Supabase
SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "")

# Groq
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
GROQ_MODEL   = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")

# Hugging Face
HF_API_KEY = os.getenv("HF_API_KEY", "")

# OpenRouteService
ORS_API_KEY = os.getenv("ORS_API_KEY", "")
