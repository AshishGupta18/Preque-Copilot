import unittest
import httpx
from types import SimpleNamespace
from unittest.mock import Mock, patch
from fastapi.testclient import TestClient
from backend import main


class ConciergeTests(unittest.TestCase):
    def setUp(self):
        self.api = TestClient(main.app)
        self.payload = dict(project_id='sunchemical', task_id='TASK-VPN', message='How do I connect?')

    def test_reply_and_conversation_continuation(self):
        gemini = Mock()
        gemini.interactions.create.return_value = SimpleNamespace(output_text='Connect using SonicWall.', id='turn-1')
        with patch.object(main, 'gemini_client', gemini):
            response = self.api.post('/api/chat', json=self.payload)
            self.assertEqual(response.json(), dict(reply='Connect using SonicWall.', interaction_id='turn-1'))
            request = gemini.interactions.create.call_args.kwargs
            self.assertTrue(request['store'])
            self.assertNotIn('previous_interaction_id', request)
            self.assertIn('SonicWall', request['input'])
            self.assertIn(self.payload['message'], request['input'])
            response = self.api.post('/api/chat', json={**self.payload, 'previous_interaction_id': 'turn-1'})
            self.assertEqual(response.status_code, 200)
            self.assertEqual(gemini.interactions.create.call_args.kwargs['previous_interaction_id'], 'turn-1')

    def test_missing_configuration(self):
        with patch.object(main, 'gemini_client', None):
            self.assertEqual(self.api.post('/api/chat', json=self.payload).status_code, 503)

    def test_invalid_context_and_empty_question(self):
        for changes, status in [({'project_id': 'missing'}, 404), ({'task_id': 'missing'}, 404), ({'message': '  '}, 422)]:
            self.assertEqual(self.api.post('/api/chat', json={**self.payload, **changes}).status_code, status)

    def test_provider_failure_and_empty_text(self):
        gemini = Mock()
        with patch.object(main, 'gemini_client', gemini):
            gemini.interactions.create.side_effect = RuntimeError('sensitive provider detail')
            result = self.api.post('/api/chat', json=self.payload)
            self.assertEqual(result.status_code, 502)
            self.assertNotIn('sensitive', result.text)
            gemini.interactions.create.side_effect = None
            gemini.interactions.create.return_value = SimpleNamespace(output_text='', id='empty')
            self.assertEqual(self.api.post('/api/chat', json=self.payload).status_code, 502)

    def test_quota_error(self):
        gemini = Mock()
        gemini.interactions.create.side_effect = main.APIStatusError(
            'quota', response=httpx.Response(429, request=httpx.Request('POST', 'https://example.test')),
            body={'error': {'message': 'quota'}}
        )
        with patch.object(main, 'gemini_client', gemini):
            self.assertEqual(self.api.post('/api/chat', json=self.payload).status_code, 429)


if __name__ == '__main__':
    unittest.main()
