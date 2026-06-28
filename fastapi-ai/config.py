import os


class Settings:
    OPENAI_API_KEY: str = os.getenv('OPENAI_API_KEY', '')
    OPENAI_MODEL: str = os.getenv('OPENAI_MODEL', 'gpt-4o-mini')
    MAX_TOKENS: int = int(os.getenv('AI_MAX_TOKENS', '1024'))
    TEMPERATURE: float = float(os.getenv('AI_TEMPERATURE', '0.7'))
    HOST: str = os.getenv('AI_HOST', '0.0.0.0')
    PORT: int = int(os.getenv('AI_PORT', '8001'))
    CORS_ORIGINS: list[str] = os.getenv(
        'AI_CORS_ORIGINS',
        'http://localhost:5173,http://localhost:5174,http://127.0.0.1:5173,http://127.0.0.1:5174',
    ).split(',')
    REDIS_URL: str = os.getenv('REDIS_URL', 'redis://redis:6379/0')


settings = Settings()
