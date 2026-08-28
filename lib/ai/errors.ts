export class AIProviderError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "AIProviderError";
  }
}

export class AIValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AIValidationError";
  }
}
