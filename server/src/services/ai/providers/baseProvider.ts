import type {
  AICompletionRequest,
  AICompletionResponse,
  AIProvider,
  AIStructuredRequest,
  AIStructuredResponse,
} from '../types.js';
import { validateAndParseModelOutput } from '../jsonParser.js';
import { AIValidationError } from '../errors.js';

export abstract class BaseAIProvider implements AIProvider {
  public abstract readonly name: string;
  public abstract readonly model: string;

  public abstract isConfigured(): boolean;
  public abstract generateCompletion(
    request: AICompletionRequest
  ): Promise<AICompletionResponse>;

  /**
   * Generates a structured JSON response and strictly validates it against the schema.
   *
   * SECURITY INVARIANT:
   * Model outputs are never evaluated as code (no eval, no Function, no exec) and never
   * treated as trusted SQL or database commands. Output is strictly parsed into validated data.
   */
  public async generateStructured<T>(
    request: AIStructuredRequest<T>
  ): Promise<AIStructuredResponse<T>> {
    const jsonPrompt = this.buildStructuredPrompt(
      request.prompt,
      request.schemaDescription
    );

    const completion = await this.generateCompletion({
      prompt: jsonPrompt,
      systemPrompt: request.systemPrompt
        ? `${request.systemPrompt}\nYou MUST respond with valid raw JSON only. Do not include markdown code fences or conversational filler.`
        : 'You are an AI assistant that strictly outputs valid JSON conforming to the requested schema. Do not output markdown fences or explanations.',
      temperature: request.temperature ?? 0.1,
      maxTokens: request.maxTokens,
      timeoutMs: request.timeoutMs,
      signal: request.signal,
    });

    try {
      const validatedData = validateAndParseModelOutput<T>(
        completion.content,
        request.validator,
        this.name
      );

      return {
        data: validatedData,
        rawContent: completion.content,
        provider: this.name,
        model: this.model,
        usage: completion.usage,
        latencyMs: completion.latencyMs,
      };
    } catch (err) {
      if (err instanceof AIValidationError) {
        throw err;
      }
      throw new AIValidationError(
        this.name,
        [err instanceof Error ? err.message : 'Schema validation failed'],
        completion.content
      );
    }
  }

  protected buildStructuredPrompt(prompt: string, schemaDescription?: string): string {
    const schemaInstruction = schemaDescription
      ? `\nExpected JSON Schema / Fields:\n${schemaDescription}`
      : '';

    return `${prompt}

IMPORTANT: Respond ONLY with a valid, parseable JSON object matching the required schema.
Do NOT enclose your response in backticks or markdown code blocks.
Do NOT include preamble, introduction, or postamble text.${schemaInstruction}`;
  }
}
