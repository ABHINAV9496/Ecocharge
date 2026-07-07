import logging

from skills.base import BaseSkill

logger = logging.getLogger(__name__)


class SkillRegistry:
    """Registry for loaded skills."""

    def __init__(self):
        self._skills: dict[str, BaseSkill] = {}

    def register(self, skill: BaseSkill) -> None:
        self._skills[skill.metadata.name] = skill
        logger.info(
            'Registered skill: %s v%s — %s',
            skill.metadata.name,
            skill.metadata.version,
            skill.metadata.description[:60],
        )

    def get(self, name: str) -> BaseSkill | None:
        return self._skills.get(name)

    def get_all(self) -> dict[str, BaseSkill]:
        return dict(self._skills)

    def get_skill_names(self) -> list[str]:
        return list(self._skills.keys())
