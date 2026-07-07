import logging

from skills.base import BaseSkill, SkillContext, SkillMetadata

logger = logging.getLogger(__name__)


class TripExplainerSkill(BaseSkill):
    metadata = SkillMetadata(
        name='trip_explainer',
        version='1.0.0',
        description='Explain route planner decisions using trip state and RAG context',
    )

    async def execute(self, context: SkillContext) -> str:
        trip = context.trip_state
        rag = context.rag_context

        if not trip:
            return 'There is no active trip to explain.'

        parts = [f'## Active Trip\n\nDestination: {trip.get("destination", "Unknown")}']

        if rag:
            parts.append(f'## How the Planner Works\n\n{rag}')

        return '\n\n'.join(parts)
