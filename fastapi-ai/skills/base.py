from abc import ABC, abstractmethod
from dataclasses import dataclass, field


@dataclass
class SkillMetadata:
    name: str
    version: str
    description: str
    dependencies: list[str] = field(default_factory=list)


@dataclass
class SkillContext:
    query: str
    conversation_history: list[dict]
    trip_state: dict | None = None
    user_preferences: dict = field(default_factory=dict)
    rag_context: str = ''


class BaseSkill(ABC):
    metadata: SkillMetadata = SkillMetadata(name='', version='', description='')

    @abstractmethod
    async def execute(self, context: SkillContext) -> str:
        ...
