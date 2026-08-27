export interface TokenBucketOptions {
  capacity: number
  refillRatePerSecond: number
  now?: number
}

export class TokenBucket {
  private tokens: number
  private lastRefillMs: number

  constructor(
    private readonly capacity: number,
    private readonly refillRatePerSecond: number,
    now: number = Date.now(),
  ) {
    if (!Number.isFinite(capacity) || capacity <= 0) {
      throw new RangeError("capacity must be a positive number")
    }

    if (!Number.isFinite(refillRatePerSecond) || refillRatePerSecond <= 0) {
      throw new RangeError("refillRatePerSecond must be a positive number")
    }

    this.tokens = capacity
    this.lastRefillMs = now
  }

  get remainingTokens(): number {
    return this.tokens
  }

  private refill(now: number): void {
    if (now <= this.lastRefillMs) {
      this.lastRefillMs = now
      return
    }

    const elapsedMs = now - this.lastRefillMs
    const elapsedSeconds = elapsedMs / 1000
    const tokensToAdd = elapsedSeconds * this.refillRatePerSecond

    this.tokens = Math.min(this.capacity, this.tokens + tokensToAdd)
    this.lastRefillMs = now
  }

  tryConsume(now: number = Date.now()): boolean {
    this.refill(now)

    if (this.tokens < 1) {
      return false
    }

    this.tokens -= 1
    return true
  }
}
