import logging

from skills.base import BaseSkill, SkillContext, SkillMetadata

logger = logging.getLogger(__name__)


class RoutePlannerSkill(BaseSkill):
    metadata = SkillMetadata(
        name='route_planner',
        version='1.0.0',
        description='Plan EV road trips with battery and charging stop calculations',
    )

    async def execute(self, context: SkillContext) -> str:
        query = context.query

        return (
            f'I need to call the trip planner tool to plan this route. '
            f'Please tell me your origin, destination, and vehicle details: {query}'
        )
