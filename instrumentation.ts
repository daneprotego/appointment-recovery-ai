import { assertRequiredEnvironmentVariables, shouldValidateStartupEnvironment } from '@/lib/env/validation';

export function register() {
  if (shouldValidateStartupEnvironment()) {
    assertRequiredEnvironmentVariables();
  }
}
