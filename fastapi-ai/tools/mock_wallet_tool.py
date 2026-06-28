from tools.base import BaseTool


class MockWalletTool(BaseTool):
    name = 'mock_wallet_tool'
    description = 'Get the user\'s wallet balance and recent transactions. Use this when the user asks about their balance, money, wallet, or payment history.'
    parameters = {
        'type': 'object',
        'properties': {
            'user_id': {
                'type': 'string',
                'description': 'Optional user identifier',
            },
        },
    }

    async def execute(self, **kwargs) -> dict:
        return {
            'balance_inr': 850,
            'currency': 'INR',
            'recent_transactions': [
                {'type': 'charge', 'amount': 240, 'date': '2026-06-25', 'station': 'Kochi Fast Charger'},
                {'type': 'charge', 'amount': 180, 'date': '2026-06-22', 'station': 'Edapalli EV Hub'},
                {'type': 'refund', 'amount': 50, 'date': '2026-06-20', 'reason': 'Cancelled booking'},
            ],
        }
