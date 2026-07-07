import logging

from fastapi import APIRouter

from routes.chat import orchestrator, skill_registry

logger = logging.getLogger(__name__)

router = APIRouter(prefix='/api/admin', tags=['Admin'])


@router.get('/skills')
async def list_skills():
    return {
        'skills': [
            {
                'name': name,
                'version': skill.metadata.version,
                'description': skill.metadata.description,
            }
            for name, skill in skill_registry.get_all().items()
        ]
    }


@router.get('/health/detailed')
async def detailed_health():
    return {
        'orchestrator': True,
        'skills_count': len(skill_registry.get_all()),
        'tools_count': len(orchestrator.executor.tools) if hasattr(orchestrator, 'executor') else 0,
    }
