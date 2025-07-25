import unittest
from partner_plugins.ghostkey_ai_trader import GhostkeyAITrader

def verify(wallet: str) -> bool:
    return wallet == "verified_wallet"

class TraderTest(unittest.TestCase):
    def test_trade_requires_opt_in_and_verified_wallet(self):
        trader = GhostkeyAITrader(verify)
        with self.assertRaises(RuntimeError):
            trader.execute_trade("verified_wallet", {"pair": "BTC/USD", "amount": 1})
        trader.activate()
        with self.assertRaises(RuntimeError):
            trader.execute_trade("bad_wallet", {"pair": "BTC/USD", "amount": 1})
        result = trader.execute_trade("verified_wallet", {"pair": "BTC/USD", "amount": 1})
        self.assertEqual(result["wallet"], "verified_wallet")
        self.assertEqual(len(trader.get_audit_log()), 1)

if __name__ == "__main__":
    unittest.main()
