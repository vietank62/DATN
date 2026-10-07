"""Regression checks for integrating main without reverting newer dev behavior."""
import unittest
import ast
from pathlib import Path
from unittest.mock import MagicMock, patch

import main  # Register SQLModel relationships before importing routes.
from alembic.config import Config
from alembic.script import ScriptDirectory
from fastapi import BackgroundTasks
from routers.deposits import gateway_ipn


class MergeRegressionTests(unittest.TestCase):
    def test_migrations_have_unique_revisions_and_one_head(self):
        root = Path(__file__).resolve().parents[1]
        ids = []
        for file in (root / "alembic" / "versions").glob("*.py"):
            for node in ast.parse(file.read_text(encoding="utf-8-sig")).body:
                if isinstance(node, ast.Assign) and any(isinstance(target, ast.Name) and target.id == "revision" for target in node.targets):
                    ids.append(ast.literal_eval(node.value))
        self.assertEqual(len(ids), len(set(ids)), "Migration revision IDs must be unique")
        config = Config(str(root / "alembic.ini"))
        config.set_main_option("script_location", str(root / "alembic"))
        script = ScriptDirectory.from_config(config)
        revisions = list(script.walk_revisions())
        self.assertEqual(len(revisions), len({row.revision for row in revisions}))
        self.assertEqual(len(script.get_heads()), 1)

    def test_fee_ipn_uses_fee_handler(self):
        payload = {"order": {"order_invoice_number": "TNFEE-123"}}
        session = MagicMock()
        tasks = BackgroundTasks()
        with patch("routers.deposits.process_fee_payment_ipn", return_value={"success": True}) as fee, patch("routers.deposits.process_gateway_ipn") as deposit:
            gateway_ipn(payload=payload, session=session, background_tasks=tasks, x_secret_key="secret")
        fee.assert_called_once_with(payload, session, "secret")
        deposit.assert_not_called()

    def test_deposit_ipn_retains_background_delivery(self):
        payload = {"order": {"order_invoice_number": "TNBOOK-123"}}
        session = MagicMock()
        tasks = BackgroundTasks()
        with patch("routers.deposits.process_fee_payment_ipn") as fee, patch("routers.deposits.process_gateway_ipn", return_value={"success": True}) as deposit:
            gateway_ipn(payload=payload, session=session, background_tasks=tasks, x_secret_key="secret")
        deposit.assert_called_once_with(session, payload, "secret", tasks)
        fee.assert_not_called()


if __name__ == "__main__":
    unittest.main()
