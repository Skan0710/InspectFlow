import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  TestAIProvider,
  UnconfiguredAIProvider,
  createAIProvider,
  resolveAIConfig,
  getSafeAIStatus,
  validateAndParseModelOutput,
  extractJsonString,
  validateSentimentOutput,
  createObjectValidator,
  AIConfigurationError,
  AIRateLimitError,
  AITimeoutError,
  AIValidationError,
  AIParseError,
  AIAuthError,
  sanitizeErrorMessage,
  executeWithRetry,
} from '../services/ai/index.js';

describe('InsightFlow Reusable AI Provider Service', () => {
  describe('1. Unconfigured Provider Behavior & Safe Defaults', () => {
    test('reports not configured and does not hardcode model or endpoint when credentials are absent', () => {
      const provider = new UnconfiguredAIProvider();

      assert.strictEqual(provider.isConfigured(), false);
      assert.strictEqual(provider.name, 'unconfigured');
      assert.strictEqual(provider.model, '');
    });

    test('generateCompletion throws AIConfigurationError when unconfigured', async () => {
      const provider = new UnconfiguredAIProvider();

      await assert.rejects(
        async () => {
          await provider.generateCompletion({ prompt: 'Analyze this feedback' });
        },
        (err: unknown) => {
          assert.ok(err instanceof AIConfigurationError);
          assert.strictEqual(err.code, 'UNCONFIGURED');
          assert.ok(err.message.includes('AI Provider is not configured'));
          return true;
        }
      );
    });

    test('generateStructured throws AIConfigurationError when unconfigured', async () => {
      const provider = new UnconfiguredAIProvider();

      await assert.rejects(
        async () => {
          await provider.generateStructured({
            prompt: 'Analyze feedback',
            validator: validateSentimentOutput,
          });
        },
        (err: unknown) => {
          assert.ok(err instanceof AIConfigurationError);
          assert.strictEqual(err.code, 'UNCONFIGURED');
          return true;
        }
      );
    });

    test('factory returns UnconfiguredAIProvider when provider is missing required keys', () => {
      const provider = createAIProvider({
        provider: 'gemini',
        apiKey: '', // missing
      });

      assert.strictEqual(provider.isConfigured(), false);
      assert.strictEqual(provider.name, 'unconfigured');
    });
  });

  describe('2. Deterministic Test Provider & Structured Output', () => {
    test('successfully generates valid structured JSON conforming to schema', async () => {
      const testProvider = new TestAIProvider({
        defaultResponse: {
          sentiment: 'negative',
          sentiment_score: -0.75,
          urgency: 'high',
          urgency_score: 0.85,
          primary_category: 'Product Feedback',
          topics: ['bug', 'crash'],
          summary: 'App crashes during onboarding checkout.',
        },
      });

      assert.strictEqual(testProvider.isConfigured(), true);
      assert.strictEqual(testProvider.name, 'test');

      const response = await testProvider.generateStructured({
        prompt: 'Analyze feedback: App crashed when I clicked checkout',
        validator: validateSentimentOutput,
      });

      assert.strictEqual(response.provider, 'test');
      assert.strictEqual(response.model, 'deterministic-test-model');
      assert.strictEqual(response.data.sentiment, 'negative');
      assert.strictEqual(response.data.sentiment_score, -0.75);
      assert.strictEqual(response.data.urgency, 'high');
      assert.deepStrictEqual(response.data.topics, ['bug', 'crash']);
      assert.strictEqual(typeof response.latencyMs, 'number');
      assert.ok(response.latencyMs >= 0);
      assert.ok(response.usage);
    });

    test('supports queued responses for sequential pipeline testing', async () => {
      const testProvider = new TestAIProvider();
      testProvider.enqueueResponse({
        sentiment: 'positive',
        sentiment_score: 0.90,
        urgency: 'low',
        urgency_score: 0.10,
        primary_category: 'Customer Service',
        topics: ['support', 'helpfulness'],
        summary: 'Excellent support agent response.',
      });

      const response = await testProvider.generateStructured({
        prompt: 'Analyze feedback: agent was very helpful',
        validator: validateSentimentOutput,
      });

      assert.strictEqual(response.data.sentiment, 'positive');
      assert.strictEqual(response.data.sentiment_score, 0.90);
      assert.strictEqual(response.data.urgency, 'low');
    });
  });

  describe('3. Strict Schema Validation & Rejection', () => {
    test('rejects responses with missing required schema fields', async () => {
      const testProvider = new TestAIProvider();
      // Enqueue payload missing 'sentiment' and 'sentiment_score'
      testProvider.enqueueResponse({
        urgency: 'high',
        urgency_score: 0.8,
        primary_category: 'Customer Service',
        topics: ['billing'],
        summary: 'Billing issue',
      });

      await assert.rejects(
        async () => {
          await testProvider.generateStructured({
            prompt: 'Analyze feedback',
            validator: validateSentimentOutput,
          });
        },
        (err: unknown) => {
          assert.ok(err instanceof AIValidationError);
          assert.strictEqual(err.code, 'VALIDATION_ERROR');
          assert.ok(err.validationErrors.some((e) => e.includes('sentiment')));
          return true;
        }
      );
    });

    test('rejects responses with out-of-bounds sentiment_score or invalid enum', async () => {
      const testProvider = new TestAIProvider();
      // Out of bounds score (15.5) and invalid sentiment enum ('happy')
      testProvider.enqueueResponse({
        sentiment: 'happy', // invalid enum
        sentiment_score: 15.5, // invalid range (-1.0 to 1.0)
        urgency: 'high',
        urgency_score: 0.8,
        primary_category: 'Operational Issues',
        topics: ['system'],
        summary: 'Server latency',
      });

      await assert.rejects(
        async () => {
          await testProvider.generateStructured({
            prompt: 'Analyze feedback',
            validator: validateSentimentOutput,
          });
        },
        (err: unknown) => {
          assert.ok(err instanceof AIValidationError);
          assert.ok(err.validationErrors.some((e) => e.includes('Invalid sentiment')));
          assert.ok(err.validationErrors.some((e) => e.includes('sentiment_score')));
          return true;
        }
      );
    });

    test('generic createObjectValidator strictly enforces custom specifications', () => {
      interface CustomReport {
        title: string;
        count: number;
        status: 'open' | 'closed';
      }

      const validator = createObjectValidator<CustomReport>({
        requiredFields: ['title', 'count', 'status'],
        typeChecks: {
          title: (val) => typeof val === 'string' && val.length > 0,
          count: (val) => typeof val === 'number' && !isNaN(val) && val >= 0,
          status: (val) => (val === 'open' || val === 'closed') ? true : 'status must be open or closed',
        },
      });

      // Valid
      const validRes = validator({ title: 'Report A', count: 10, status: 'open' });
      assert.strictEqual(validRes.success, true);
      assert.strictEqual(validRes.data?.title, 'Report A');

      // Invalid missing status
      const invalidRes1 = validator({ title: 'Report B', count: 5 });
      assert.strictEqual(invalidRes1.success, false);
      assert.ok(invalidRes1.errors?.some((e) => e.includes('status')));

      // Invalid status value
      const invalidRes2 = validator({ title: 'Report C', count: 5, status: 'pending' });
      assert.strictEqual(invalidRes2.success, false);
      assert.ok(invalidRes2.errors?.some((e) => e.includes('status must be open or closed')));
    });
  });

  describe('4. Robust JSON Parsing & Markdown Stripping', () => {
    test('extracts clean JSON from markdown code fences (```json ... ```)', () => {
      const markdownRaw = '```json\n{\n  "status": "ok",\n  "count": 42\n}\n```';
      const extracted = extractJsonString(markdownRaw);
      assert.strictEqual(extracted, '{\n  "status": "ok",\n  "count": 42\n}');
    });

    test('extracts JSON surrounded by conversational prose', () => {
      const conversational =
        'Certainly! Here is your requested analysis:\n\n{"result": "success", "score": 0.95}\n\nHope this helps!';
      const extracted = extractJsonString(conversational);
      assert.strictEqual(extracted, '{"result": "success", "score": 0.95}');
    });

    test('throws AIParseError when raw text is unparseable or malformed', () => {
      assert.throws(
        () => {
          validateAndParseModelOutput('not a json string at all', () => ({ success: true, data: {} }), 'test');
        },
        (err: unknown) => {
          assert.ok(err instanceof AIParseError);
          assert.strictEqual(err.code, 'PARSE_ERROR');
          return true;
        }
      );
    });
  });

  describe('5. Timeouts, Rate-Limit Handling & Bounded Retries', () => {
    test('enforces timeout and throws AITimeoutError when operation exceeds deadline', async () => {
      const testProvider = new TestAIProvider({
        simulatedDelayMs: 200, // delay 200ms
      });

      await assert.rejects(
        async () => {
          await testProvider.generateCompletion({
            prompt: 'Test timeout',
            timeoutMs: 50, // 50ms timeout
          });
        },
        (err: unknown) => {
          assert.ok(err instanceof AITimeoutError);
          assert.strictEqual(err.code, 'TIMEOUT');
          assert.strictEqual(err.isTimeout, true);
          return true;
        }
      );
    });

    test('retries transient 429 rate limit with backoff and succeeds on subsequent attempt', async () => {
      let attemptsCount = 0;

      const result = await executeWithRetry(
        async () => {
          attemptsCount++;
          if (attemptsCount === 1) {
            // First attempt hits rate limit
            throw new AIRateLimitError('test', 'Simulated 429 Too Many Requests', 0.05);
          }
          return { status: 'success', attempts: attemptsCount };
        },
        {
          maxRetries: 2,
          baseDelayMs: 20,
          maxDelayMs: 100,
          timeoutMs: 2000,
          provider: 'test',
        }
      );

      assert.strictEqual(result.status, 'success');
      assert.strictEqual(attemptsCount, 2);
    });

    test('exhausts retries on persistent 429 and throws structured AIRateLimitError', async () => {
      let attemptsCount = 0;

      await assert.rejects(
        async () => {
          await executeWithRetry(
            async () => {
              attemptsCount++;
              throw new AIRateLimitError('test', 'Persistent quota exhaustion');
            },
            {
              maxRetries: 2,
              baseDelayMs: 10,
              maxDelayMs: 50,
              timeoutMs: 1000,
              provider: 'test',
            }
          );
        },
        (err: unknown) => {
          assert.ok(err instanceof AIRateLimitError);
          assert.strictEqual(err.code, 'RATE_LIMITED');
          assert.strictEqual(err.isRateLimit, true);
          assert.strictEqual(attemptsCount, 3); // initial + 2 retries
          return true;
        }
      );
    });

    test('does not retry non-transient auth error (401)', async () => {
      let attemptsCount = 0;

      await assert.rejects(
        async () => {
          await executeWithRetry(
            async () => {
              attemptsCount++;
              throw new AIAuthError('test', 'Invalid API key provided');
            },
            {
              maxRetries: 3,
              timeoutMs: 1000,
              provider: 'test',
            }
          );
        },
        (err: unknown) => {
          assert.ok(err instanceof AIAuthError);
          assert.strictEqual(err.code, 'AUTH_ERROR');
          assert.strictEqual(attemptsCount, 1); // Failed immediately without retrying
          return true;
        }
      );
    });
  });

  describe('6. Security Invariants: No Code Execution & Secret Sanitization', () => {
    test('parses dangerous strings purely as literal data without execution', () => {
      const maliciousJson = JSON.stringify({
        sentiment: 'negative',
        sentiment_score: -0.5,
        urgency: 'high',
        urgency_score: 0.9,
        primary_category: 'Fraud and Scam',
        topics: [
          '<script>alert("XSS")</script>',
          '\'); DROP TABLE feedback; --',
          'process.exit(1)',
          'eval("require(\'fs\')")',
        ],
        summary: 'Payloads containing malicious instruction text are stored as plain text literals.',
      });

      const parsed = validateAndParseModelOutput(maliciousJson, validateSentimentOutput, 'test');

      // Invariant: parsed data is a plain object and malicious strings remain literal inert data
      assert.strictEqual(parsed.topics[0], '<script>alert("XSS")</script>');
      assert.strictEqual(parsed.topics[1], '\'); DROP TABLE feedback; --');
      assert.strictEqual(parsed.topics[2], 'process.exit(1)');
      assert.strictEqual(parsed.topics[3], 'eval("require(\'fs\')")');
    });

    test('sanitizes API keys and tokens from error messages', () => {
      const rawMessage1 = 'Error calling https://generativelanguage.googleapis.com/v1beta/models?key=AIzaSyA1234567890abcdefghijklmnopqrstuvw';
      const sanitized1 = sanitizeErrorMessage(rawMessage1);
      assert.ok(!sanitized1.includes('AIzaSyA1234567890abcdefghijklmnopqrstuvw'));
      assert.ok(sanitized1.includes('[REDACTED_GEMINI_KEY]'));

      const rawMessage2 = 'OpenAI failed with authorization Bearer sk-proj-1234567890abcdef1234567890';
      const sanitized2 = sanitizeErrorMessage(rawMessage2);
      assert.ok(!sanitized2.includes('sk-proj-1234567890abcdef1234567890'));
      assert.ok(sanitized2.includes('Bearer [REDACTED]'));
    });
  });

  describe('7. Server-Side Credential Safety & Status Inspection', () => {
    test('getSafeAIStatus does not leak sensitive API keys', () => {
      const resolved = resolveAIConfig({
        provider: 'openai',
        apiKey: 'sk-proj-secret-key-12345',
        model: 'gpt-4o-mini',
      });

      const safeStatus = getSafeAIStatus(resolved);

      // Verify safe status properties
      assert.strictEqual(safeStatus.configured, true);
      assert.strictEqual(safeStatus.provider, 'openai');
      assert.strictEqual(safeStatus.model, 'gpt-4o-mini');
      assert.strictEqual(safeStatus.requiresKey, false);

      // Verify no key field is exposed in the safe status object
      assert.strictEqual('apiKey' in safeStatus, false);
    });
  });
});
