"""
EcoCharge AI Agent — Evaluation Suite

A fixed set of prompts covering all router intent paths.
Run: pytest tests/test_agent_eval.py -v

These tests validate the ROUTER layer (deterministic) and PLANNER layer
(deterministic), not the LLM output (non-deterministic).
"""

import sys
sys.path.insert(0, '.')

from orchestrator.planner import Planner
from orchestrator.router import Router

router = Router()
planner = Planner()

EVAL_PROMPTS = [
    # Trip planning
    {'query': 'Plan a trip from Delhi to Agra in my Tata Nexon', 'expected_intent': 'trip_planning'},
    {'query': 'Can I reach Mumbai from Pune without charging?', 'expected_intent': 'trip_planning'},
    {'query': 'How do I get from Bangalore to Mysore?', 'expected_intent': 'trip_planning'},
    {'query': 'Plan a road trip from Chennai to Pondicherry', 'expected_intent': 'trip_planning'},

    # Station search
    {'query': 'Find CCS2 chargers near Bangalore', 'expected_intent': 'station_search'},
    {'query': 'Are there any available DC fast chargers in Kochi?', 'expected_intent': 'station_search'},
    {'query': 'Where can I charge my EV in Pune?', 'expected_intent': 'station_search'},
    {'query': 'Show me charging stations along my route', 'expected_intent': 'station_search'},

    # Weather
    {'query': "What's the weather like in Delhi today?", 'expected_intent': 'weather'},
    {'query': 'Will it rain on my trip to Goa tomorrow?', 'expected_intent': 'weather'},
    {'query': 'What is the temperature in Mumbai right now?', 'expected_intent': 'weather'},

    # Booking
    {'query': 'Show my upcoming bookings', 'expected_intent': 'booking'},
    {'query': 'Do I have any active reservations?', 'expected_intent': 'booking'},

    # General EV knowledge (Tier 1 - LLM direct)
    {'query': 'How does regenerative braking work?', 'expected_intent': 'general_ev_knowledge'},
    {'query': "What's the difference between CCS2 and CHAdeMO?", 'expected_intent': 'general_ev_knowledge'},
    {'query': 'What is battery degradation?', 'expected_intent': 'general_ev_knowledge'},
    {'query': 'How does a lithium-ion battery work?', 'expected_intent': 'general_ev_knowledge'},
    {'query': 'What is the optimal charging practice for EV batteries?', 'expected_intent': 'general_ev_knowledge'},

    # General EV knowledge (Tier 2 - web search)
    {'query': "What's the range of the new Tata Harrier EV?", 'expected_intent': 'general_ev_knowledge'},
    {'query': 'What are the latest FAME subsidy rates?', 'expected_intent': 'general_ev_knowledge'},
    {'query': 'Tell me about the Kia EV9', 'expected_intent': 'general_ev_knowledge'},

    # Explain route
    {'query': 'Why did the planner suggest charging at that station?', 'expected_intent': 'explain_route'},
    {'query': 'Why was this route chosen?', 'expected_intent': 'explain_route'},

    # Edge cases
    {'query': 'Hello', 'expected_intent': 'chitchat'},
    {'query': 'Hi there!', 'expected_intent': 'chitchat'},
    {'query': 'Thanks!', 'expected_intent': 'chitchat'},
    {'query': '', 'expected_intent': 'empty'},
    {'query': '   ', 'expected_intent': 'empty'},
    {'query': 'What is the meaning of life?', 'expected_intent': 'general_ev_knowledge'},
]


class TestRouter:
    def test_all_intents(self):
        """Verify router correctly classifies every eval prompt."""
        failures = []
        for item in EVAL_PROMPTS:
            q = item['query']
            expected = item['expected_intent']
            result = router.route(q)
            if result != expected:
                failures.append(f'  "{q[:60]}..." → {result} (expected {expected})')

        if failures:
            msg = f'{len(failures)}/{len(EVAL_PROMPTS)} route failures:\n' + '\n'.join(failures)
            print(msg)

        assert len(failures) == 0, f'{len(failures)} route classification failures'


class TestPlanner:
    def test_plan_produces_valid_steps(self):
        """Verify planner produces valid actions for each intent."""
        intents = [
            'trip_planning', 'station_search', 'weather',
            'booking', 'explain_route', 'general_ev_knowledge', 'chitchat',
        ]
        for intent in intents:
            plan = planner.plan(intent, 'test query', {'rag_context': ''})
            assert isinstance(plan, list), f'{intent}: plan should be a list'
            assert len(plan) > 0, f'{intent}: plan should have at least 1 step'
            step = plan[0]
            assert 'action' in step, f'{intent}: step missing "action"'
            assert step['action'] in ('tool_call', 'skill', 'generate_response'), \
                f'{intent}: unknown action {step["action"]}'

    def test_skill_plans(self):
        """Verify skill-based intents map to correct skills."""
        assert planner.plan('general_ev_knowledge', 'q', {})[0]['skill'] == 'general_ev_knowledge'
        assert planner.plan('trip_planning', 'q', {})[0]['skill'] == 'route_planner'
        assert planner.plan('explain_route', 'q', {})[0]['skill'] == 'trip_explainer'

    def test_tool_plans(self):
        """Verify tool-based intents map to correct tools."""
        assert planner.plan('station_search', 'find in Delhi', {})[0]['tool'] == 'station_tool'
        assert planner.plan('weather', 'weather in Mumbai', {})[0]['tool'] == 'weather_tool'
        assert planner.plan('booking', 'my bookings', {})[0]['tool'] == 'booking_tool'
