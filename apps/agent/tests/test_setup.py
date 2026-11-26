import json
import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from dotenv import dotenv_values

from grasp_agent.client import GraspError
from grasp_agent.setup import Agent, SERVER_ARGS, agent_checks, configure_workspace


class SetupTests(unittest.TestCase):
    def setUp(self):
        directory = tempfile.TemporaryDirectory()
        self.addCleanup(directory.cleanup)
        self.root = Path(directory.name)
        self.settings = self.root / "grasp.env"
        self.agent = Agent("claude-code", ["fixture"], self.root / "claude.json", self.root / "skills")
        self.skill = self.agent.skills / "grasp-canvas" / "SKILL.md"
        clean_environment = {
            key: value for key, value in os.environ.items()
            if key not in ("ACCESS_TOKEN", "GRASP_AGENT_TOKEN", "API_PORT", "WEB_PORT", "GRASP_API_URL", "GRASP_WEB_URL")
        }
        clean_environment["GRASP_ENV_FILE"] = str(self.settings)
        mock = patch.dict(os.environ, clean_environment, clear=True)
        mock.start()
        self.addCleanup(mock.stop)

    def test_setup_creates_distinct_credentials_and_preserves_existing_settings(self):
        self.settings.write_text("MOCK_LLM=1\nACCESS_TOKEN=owner-fixture\nWEB_PORT=5179\n", encoding="utf-8")
        self.assertTrue(configure_workspace())
        configured = self.settings.read_bytes()
        values = dotenv_values(self.settings)
        self.assertEqual(values["MOCK_LLM"], "1")
        self.assertEqual(values["ACCESS_TOKEN"], "owner-fixture")
        self.assertEqual(values["WEB_PORT"], "5179")
        self.assertTrue(values["GRASP_AGENT_TOKEN"])
        self.assertNotEqual(values["GRASP_AGENT_TOKEN"], values["ACCESS_TOKEN"])
        self.assertFalse(configure_workspace())
        self.assertEqual(self.settings.read_bytes(), configured)

    def test_conflicting_tokens_are_preserved(self):
        text = "ACCESS_TOKEN=same\nGRASP_AGENT_TOKEN=same\n"
        self.settings.write_text(text, encoding="utf-8")
        with self.assertRaises(GraspError) as failure:
            configure_workspace()
        self.assertEqual(failure.exception.code, "sharedToken")
        self.assertEqual(self.settings.read_text(encoding="utf-8"), text)

    def test_install_uses_host_registration_once_and_verifies_the_installed_skill(self):
        self.agent.config.write_text('{"mcpServers": {"other": {"command": "other"}}}', encoding="utf-8")

        def register(agent, env):
            data = json.loads(agent.config.read_text(encoding="utf-8"))
            data["mcpServers"]["grasp"] = {"command": sys.executable, "args": SERVER_ARGS, "env": env}
            agent.config.write_text(json.dumps(data), encoding="utf-8")

        with patch.object(Agent, "register", autospec=True, side_effect=register) as called:
            first = agent_checks([self.agent], None, None, install=True)[0]
            second = agent_checks([self.agent], None, None, install=True)[0]
        called.assert_called_once()
        self.assertEqual(first, {"agent": "claude-code", "registration": "ready", "skill": "installed"})
        self.assertEqual(second["skill"], "ready")
        saved = json.loads(self.agent.config.read_text(encoding="utf-8"))["mcpServers"]
        self.assertEqual(saved["other"], {"command": "other"})
        self.assertEqual(set(saved["grasp"]["env"]), {"GRASP_ENV_FILE"})
        self.assertEqual(Path(saved["grasp"]["env"]["GRASP_ENV_FILE"]), self.settings)

        self.skill.write_text("Custom skill", encoding="utf-8")
        check = agent_checks([self.agent], None, None, install=True)[0]
        self.assertEqual(check["error"]["code"], "skillConflict")
        self.assertEqual(self.skill.read_text(encoding="utf-8"), "Custom skill")

    def test_different_registration_is_reported_without_replacing_it(self):
        text = json.dumps({"mcpServers": {"grasp": {
            "command": sys.executable, "args": SERVER_ARGS, "env": {"GRASP_ENV_FILE": str(self.settings)},
        }}})
        self.agent.config.write_text(text, encoding="utf-8")
        check = agent_checks([self.agent], "http://127.0.0.1:8100/api", None, install=True)[0]
        self.assertEqual(check["error"]["code"], "registrationConflict")
        self.assertEqual(self.agent.config.read_text(encoding="utf-8"), text)
        self.assertFalse(self.skill.exists())
