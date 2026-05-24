export const ExitCode = {
  success: 0,
  generic: 1,
  authRequired: 2,
  schemaInvalid: 3,
  lumaServerError: 4,
  rateLimited: 5,
  networkFailure: 6,
  interrupted: 130,
} as const;

export type ExitCodeValue = (typeof ExitCode)[keyof typeof ExitCode];
