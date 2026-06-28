from pydantic import BaseModel


class ChatRequest(BaseModel):
    message: str
    history: list[dict] = []
    token: str = ''


class ChatResponse(BaseModel):
    reply: str


class ErrorResponse(BaseModel):
    detail: str
