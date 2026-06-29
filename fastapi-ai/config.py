import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / '.env')


class Settings:
    GROQ_API_KEY: str = os.getenv('GROQ_API_KEY', '')
    GROQ_MODEL: str = os.getenv('GROQ_MODEL', 'llama-3.3-70b-versatile')
    MAX_TOKENS: int = int(os.getenv('AI_MAX_TOKENS', '1024'))
    TEMPERATURE: float = float(os.getenv('AI_TEMPERATURE', '0.7'))
    HOST: str = os.getenv('AI_HOST', '0.0.0.0')
    PORT: int = int(os.getenv('AI_PORT', '8001'))
    CORS_ORIGINS: list[str] = os.getenv(
        'AI_CORS_ORIGINS',
        'http://localhost:5173,http://localhost:5174,http://127.0.0.1:5173,http://127.0.0.1:5174',
    ).split(',')
    REDIS_URL: str = os.getenv('REDIS_URL', 'redis://redis:6379/0')
    DJANGO_BASE: str = os.getenv('DJANGO_BASE', 'http://django:8000')


settings = Settings()
