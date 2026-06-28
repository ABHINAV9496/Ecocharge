from __future__ import annotations

import logging
from typing import Any

logger = logging.getLogger(__name__)

# Mapping of internal keys → user-facing labels
_PREFERENCE_LABELS: dict[str, tuple[str, str]] = {
    'preferred_vehicle': ('Vehicle', 'Your vehicle is set to **{value}**.'),
    'preferred_strategy': (
        'Charging strategy',
        'You prefer the **{value}** charging strategy.',
    ),
    'preferred_connector': (
        'Connector preference',
        'You prefer **{value}** connectors.',
    ),
    'preferred_language': (
        'Language',
        'Your preferred language is **{value}**.',
    ),
    'home_city': (
        'Home city',
        'Your home city is **{value}**.',
    ),
    'frequent_destinations': (
        'Frequent destinations',
        'Your frequent destinations include: **{value}**.',
    ),
    'typical_battery_percent': (
        'Typical battery level',
        'Your battery is typically at **{value}%** when starting a trip.',
    ),
}


def build_memory_context(preferences: dict[str, Any]) -> str:
    """Build a natural-language context block from stored preferences.

    Returns an empty string when there are no preferences.
    """
    if not preferences:
        return ''

    lines = ['## User Preferences', '']
    for key, (label, template) in _PREFERENCE_LABELS.items():
        value = preferences.get(key)
        if value is None:
            continue
        if key == 'frequent_destinations' and isinstance(value, list):
            value = ', '.join(value)
        lines.append(f'- **{label}**: {template.format(value=value)}')

    if len(lines) == 2:
        return ''

    lines.extend([
        '',
        (
            'Use these preferences when relevant. '
            'If the user says something contradictory, '
            'prefer their current request over stored preferences.'
        ),
    ])
    return '\n'.join(lines)
