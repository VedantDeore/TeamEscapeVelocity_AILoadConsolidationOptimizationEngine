"""
Supabase client singleton for the Lorri backend.
Imports are deferred to avoid slow SSL initialization blocking server startup.
"""

_client = None


def get_supabase():
    global _client
    if _client is None:
        from supabase import create_client
        from config import SUPABASE_URL, SUPABASE_KEY
        _client = create_client(SUPABASE_URL, SUPABASE_KEY)
    return _client
