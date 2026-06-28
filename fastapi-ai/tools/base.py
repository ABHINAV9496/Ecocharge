from abc import ABC, abstractmethod


class BaseTool(ABC):
    """Every tool must implement name, description, parameters, and execute()."""

    name: str = ''
    description: str = ''
    parameters: dict = {}

    @abstractmethod
    async def execute(self, **kwargs) -> dict:
        pass

    def to_openai_tool(self) -> dict:
        return {
            'type': 'function',
            'function': {
                'name': self.name,
                'description': self.description,
                'parameters': self.parameters,
            },
        }
