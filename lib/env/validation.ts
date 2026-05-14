export type EnvironmentValidationResult = {
  ok: boolean;
  missing: string[];
  placeholders: string[];
};

export const REQUIRED_PRODUCTION_ENV_VARS = [
  'NEXT_PUBLIC_APP_URL',
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'REMINDER_JOB_SECRET',
] as const;

const PLACEHOLDER_PATTERNS = [
  /^your_/i,
  /^replace-me/i,
  /^change-me/i,
  /^example-/i,
  /example\.supabase\.co/i,
  /localhost/i,
] as const;

export function validateRequiredEnvironmentVariables(
  env: NodeJS.ProcessEnv = process.env,
  requiredVariables: readonly string[] = REQUIRED_PRODUCTION_ENV_VARS,
): EnvironmentValidationResult {
  const missing: string[] = [];
  const placeholders: string[] = [];

  for (const variable of requiredVariables) {
    const value = env[variable]?.trim();

    if (!value) {
      missing.push(variable);
      continue;
    }

    if (PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(value))) {
      placeholders.push(variable);
    }
  }

  return {
    ok: missing.length === 0 && placeholders.length === 0,
    missing,
    placeholders,
  };
}

export function assertRequiredEnvironmentVariables(): void {
  const result = validateRequiredEnvironmentVariables();

  if (!result.ok) {
    const details = [
      result.missing.length ? `missing: ${result.missing.join(', ')}` : '',
      result.placeholders.length ? `placeholder values: ${result.placeholders.join(', ')}` : '',
    ]
      .filter(Boolean)
      .join('; ');

    throw new Error(`Production environment validation failed (${details}). Configure real values in Vercel before starting the app.`);
  }
}

export function shouldValidateStartupEnvironment(): boolean {
  return process.env.NODE_ENV === 'production';
}
