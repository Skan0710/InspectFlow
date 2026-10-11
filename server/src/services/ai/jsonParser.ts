import { AIParseError, AIValidationError } from './errors.js';
import type { SchemaValidator } from './types.js';

/**
 * Strips markdown formatting code blocks, leading commentary, and trailing notes
 * to extract raw JSON payload.
 */
export function extractJsonString(raw: string): string {
  if (!raw || typeof raw !== 'string') {
    return '';
  }

  let text = raw.trim();

  // Remove markdown code fences if present (e.g. ```json ... ``` or ``` ... ```)
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (codeBlockMatch && codeBlockMatch[1]) {
    text = codeBlockMatch[1].trim();
  }

  // Find the first opening brace or bracket
  const firstBrace = text.indexOf('{');
  const firstBracket = text.indexOf('[');

  let startIndex = -1;
  let endIndex = -1;

  if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
    // Outer is an object
    startIndex = firstBrace;
    endIndex = text.lastIndexOf('}');
  } else if (firstBracket !== -1) {
    // Outer is an array
    startIndex = firstBracket;
    endIndex = text.lastIndexOf(']');
  }

  if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
    return text.substring(startIndex, endIndex + 1).trim();
  }

  return text;
}

/**
 * Safely parses raw text into a JavaScript data object without code execution.
 *
 * SECURITY INVARIANT:
 * Model output is strictly parsed via standard JSON.parse into plain data structures.
 * It is NEVER evaluated with eval(), new Function(), executed as shell scripts,
 * or interpolated directly into raw SQL strings.
 */
export function parseRawJson(rawContent: string, provider: string): unknown {
  const jsonString = extractJsonString(rawContent);

  if (!jsonString) {
    throw new AIParseError(provider, 'Received empty or non-JSON response from model', rawContent);
  }

  try {
    return JSON.parse(jsonString);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Invalid JSON syntax';
    throw new AIParseError(provider, errorMsg, rawContent);
  }
}

/**
 * Parses raw model output and enforces strict schema validation.
 * Throws AIValidationError if validation fails.
 */
export function validateAndParseModelOutput<T>(
  rawContent: string,
  validator: SchemaValidator<T>,
  provider: string
): T {
  const parsedData = parseRawJson(rawContent, provider);
  const validation = validator(parsedData);

  if (!validation.success || validation.data === undefined) {
    const errors = validation.errors && validation.errors.length > 0
      ? validation.errors
      : ['Data did not meet schema requirements'];
    throw new AIValidationError(provider, errors, rawContent);
  }

  return validation.data;
}
