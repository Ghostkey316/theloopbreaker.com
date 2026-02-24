/**
 * Shared error classes used by server modules.
 */
class ForbiddenErrorClass extends Error {
  constructor(message = "Forbidden") {
    super(message);
    this.name = "ForbiddenError";
  }
}

/**
 * Can be called as ForbiddenError(msg) or new ForbiddenError(msg).
 */
export const ForbiddenError = ((message?: string) => new ForbiddenErrorClass(message)) as unknown as {
  (message?: string): ForbiddenErrorClass;
  new (message?: string): ForbiddenErrorClass;
};

export class UnauthorizedError extends Error {
  constructor(message = "Unauthorized") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export class NotFoundError extends Error {
  constructor(message = "Not Found") {
    super(message);
    this.name = "NotFoundError";
  }
}
