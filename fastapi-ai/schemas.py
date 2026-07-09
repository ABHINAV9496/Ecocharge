from typing import Optional

from pydantic import BaseModel, Field


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=2000)
    history: list[dict] = []
    token: str = ''


class ChatResponse(BaseModel):
    reply: str


class ErrorResponse(BaseModel):
    detail: str


class TripPlanRequest(BaseModel):
    origin: str = Field(..., min_length=2, max_length=200)
    destination: str = Field(..., min_length=2, max_length=200)
    vehicle: Optional[str] = None
    battery: Optional[float] = Field(None, ge=0, le=100)
    strategy: str = Field('fastest', pattern=r'^(fastest|cheapest)$')


class StationSearchRequest(BaseModel):
    location: str = Field(..., min_length=2, max_length=200)
    charger_type: str = Field('any', pattern=r'^(DC|AC|DC_FAST|DC_ULTRA|AC_FAST|AC_SLOW|any)$')
    connector_type: str = Field('any', pattern=r'^(CCS2|CHAdeMO|Type 2 AC|any)$')
    available_only: bool = False
    limit: int = Field(10, ge=1, le=50)


class WeatherRequest(BaseModel):
    location: str = Field(..., min_length=2, max_length=200)
    type: str = Field('current', pattern=r'^(current|forecast|7day)$')
