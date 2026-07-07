import logging

from skills.base import BaseSkill, SkillContext, SkillMetadata

logger = logging.getLogger(__name__)


class WeatherAdaptationSkill(BaseSkill):
    metadata = SkillMetadata(
        name='weather_adaptation',
        version='1.0.0',
        description='Analyze weather impact on EV trips and suggest adaptations',
    )

    async def execute(self, context: SkillContext) -> str:
        query = context.query

        return (
            f'To analyze weather impact on your trip, I need current weather data. '
            f'Please ask about weather for your specific route: {query}'
        )
