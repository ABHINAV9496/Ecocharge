import logging
import time

from tools.base import BaseTool

logger = logging.getLogger(__name__)


class ToolExecutor:
    """Executes a tool and returns the result.

    Responsible for:
    - Running the tool's execute() method
    - Returning structured JSON
    - Logging execution time and result
    - Handling failures gracefully
    """

    async def execute(self, tool: BaseTool, arguments: dict) -> dict:
        start = time.monotonic()
        logger.info(
            'ToolExecutor: executing %s with args=%s',
            tool.name,
            arguments,
        )

        try:
            result = await tool.execute(**arguments)
            elapsed = time.monotonic() - start
            logger.info(
                'ToolExecutor: %s completed in %.2fs — result=%s',
                tool.name,
                elapsed,
                result,
            )
            return result
        except Exception as e:
            elapsed = time.monotonic() - start
            logger.error(
                'ToolExecutor: %s failed after %.2fs — %s',
                tool.name,
                elapsed,
                str(e),
            )
            return {
                'error': True,
                'message': f'I\'m currently unable to access the {tool.name} service. Please try again later.',
            }
