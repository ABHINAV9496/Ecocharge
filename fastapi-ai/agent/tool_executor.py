import json
import logging
import time

from tools.base import BaseTool

logger = logging.getLogger(__name__)


class ToolExecutor:
    """Executes a tool and returns the result."""

    async def execute(self, tool: BaseTool, arguments: dict) -> dict:
        start = time.monotonic()
        logger.info('--- TOOL EXECUTOR ---')
        logger.info('Tool name: %s', tool.name)
        logger.info('Kwargs: %s', json.dumps(arguments, indent=2))

        try:
            result = await tool.execute(**arguments)
            elapsed = time.monotonic() - start
            logger.info('Tool %s completed in %.2fs', tool.name, elapsed)
            logger.info('Result: %s', json.dumps(result, indent=2, default=str)[:2000])
            logger.info('--- END TOOL EXECUTOR ---')
            return result
        except Exception:
            elapsed = time.monotonic() - start
            logger.exception('Tool %s raised an exception after %.2fs', tool.name, elapsed)
            logger.info('--- END TOOL EXECUTOR (EXCEPTION) ---')
            return {
                'error': True,
                'message': f'The {tool.name} service encountered an error. Please try again later.',
            }
