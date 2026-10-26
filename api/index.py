# api/index.py
import sys
import os

# Add parent directory to path so it can import backend/main.py
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from backend.main import app