// Serialization helpers for the domain model.
//
// Domain values are plain JSON-friendly objects, so serialization is just
// `JSON.stringify`. Deserialization parses the JSON and then runs the matching
// type guard, throwing a descriptive {@link DomainParseError} when the data is
// not a valid domain value — callers get a typed value or a clear failure, with
// no silent coercion.

import { isPattern, isProject } from './guards';
import type { Pattern, Project } from './types';

/** Thrown when JSON does not deserialize into a valid domain value. */
export class DomainParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DomainParseError';
  }
}

function parseJson(json: string, typeName: string): unknown {
  try {
    return JSON.parse(json);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new DomainParseError(`Invalid JSON for ${typeName}: ${detail}`);
  }
}

/** Serializes a {@link Pattern} to a JSON string. */
export function serializePattern(pattern: Pattern): string {
  return JSON.stringify(pattern);
}

/**
 * Parses and validates a JSON string into a {@link Pattern}.
 *
 * @throws DomainParseError when the string is not valid JSON or not a Pattern.
 */
export function deserializePattern(json: string): Pattern {
  const value = parseJson(json, 'Pattern');
  if (!isPattern(value)) {
    throw new DomainParseError('Parsed value is not a valid Pattern');
  }
  return value;
}

/** Serializes a {@link Project} to a JSON string. */
export function serializeProject(project: Project): string {
  return JSON.stringify(project);
}

/**
 * Parses and validates a JSON string into a {@link Project}.
 *
 * @throws DomainParseError when the string is not valid JSON or not a Project.
 */
export function deserializeProject(json: string): Project {
  const value = parseJson(json, 'Project');
  if (!isProject(value)) {
    throw new DomainParseError('Parsed value is not a valid Project');
  }
  return value;
}
