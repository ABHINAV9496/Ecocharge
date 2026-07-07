import json
import logging
from typing import Any

from core.llm import GroqLLMClient
from skills.registry import SkillRegistry
from tools.base import BaseTool

logger = logging.getLogger(__name__)


class Executor:
    """Executes a plan step by step, feeding results back into context."""

    def __init__(
        self,
        tools: dict[str, BaseTool],
        skills: SkillRegistry,
        llm: GroqLLMClient,
    ):
        self.tools = tools
        self.skills = skills
        self.llm = llm

    async def execute(
        self,
        plan: list[dict],
        query: str,
        conversation_history: list[dict],
    ) -> str:
        context = ''
        tool_results_log = []

        for step in plan:
            action = step.get('action')
            logger.info('Executor step: %s — %s', action, step.get('tool', step.get('skill', '')))

            if action == 'tool_call':
                tool_name = step.get('tool', '')
                tool = self.tools.get(tool_name)
                if not tool:
                    logger.warning('Tool not found: %s', tool_name)
                    continue

                try:
                    result = await tool.execute(**step.get('params', {}))
                    text = json.dumps(result, indent=2, default=str)
                    context += f'\n\n## {tool_name} Result\n\n{text}'
                    tool_results_log.append({'tool': tool_name, 'result': result})
                except Exception as e:
                    logger.error('Tool %s failed: %s', tool_name, e)
                    context += f'\n\n## {tool_name} Error\n\nFailed: {str(e)[:200]}'

            elif action == 'skill':
                skill_name = step.get('skill', '')
                skill = self.skills.get(skill_name)
                if skill:
                    from skills.base import SkillContext

                    skill_ctx = SkillContext(
                        query=query,
                        conversation_history=conversation_history,
                        trip_state=step.get('params', {}).get('trip_state'),
                        rag_context=context + '\n' + step.get('params', {}).get('rag_context', ''),
                    )
                    try:
                        result = await skill.execute(skill_ctx)
                        context += f'\n\n## {skill_name} Result\n\n{result}'
                    except Exception as e:
                        logger.error('Skill %s failed: %s', skill_name, e)
                        context += f'\n\n## {skill_name} Error\n\nFailed: {str(e)[:200]}'

            elif action == 'generate_response':
                from schemas import ChatRequest

                final_prompt = context or query
                messages = list(conversation_history)
                messages.append({'role': 'user', 'content': final_prompt})

                full_response = ''
                async for token in self.llm.generate_stream(messages):
                    full_response += token
                return full_response

        messages = list(conversation_history)
        if tool_results_log:
            tool_summary = '\n'.join(
                f'{r["tool"]}: {json.dumps(r["result"], default=str)[:300]}'
                for r in tool_results_log
            )
            messages.append({
                'role': 'user',
                'content': f'The following data was retrieved:\n{tool_summary}\n\nNow answer the user\'s question naturally: {query}',
            })
        else:
            messages.append({'role': 'user', 'content': context + '\n\n' + query})

        full_response = ''
        async for token in self.llm.generate_stream(messages):
            full_response += token
        return full_response
