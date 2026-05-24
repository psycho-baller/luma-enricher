export class AuthExpiredError extends Error {
  constructor(message = "Your Luma session has expired. Run `luma-enricher login` to refresh.") {
    super(message);
    this.name = "AuthExpiredError";
  }
}

export class LumaApiError extends Error {
  readonly status: number;
  readonly url: string | undefined;
  readonly body: string | undefined;
  readonly retryAfterMs: number | undefined;

  constructor(args: {
    status: number;
    message: string;
    url?: string | undefined;
    body?: string | undefined;
    retryAfterMs?: number | undefined;
  }) {
    super(args.message);
    this.name = "LumaApiError";
    this.status = args.status;
    this.url = args.url;
    this.body = args.body;
    this.retryAfterMs = args.retryAfterMs;
  }
}

export class GuestListHiddenError extends LumaApiError {
  constructor(eventApiId: string, message = "guest list hidden by host") {
    super({
      status: 403,
      message,
      url: `/event/get-guests?event_api_id=${eventApiId}`,
    });
    this.name = "GuestListHiddenError";
  }
}

export class RateLimitedError extends LumaApiError {
  constructor(args: {
    message: string;
    url?: string | undefined;
    body?: string | undefined;
    retryAfterMs?: number | undefined;
  }) {
    super({
      status: 429,
      message: args.message,
      url: args.url,
      body: args.body,
      retryAfterMs: args.retryAfterMs,
    });
    this.name = "RateLimitedError";
  }
}

export class NetworkError extends Error {
  constructor(
    message: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = "NetworkError";
  }
}
