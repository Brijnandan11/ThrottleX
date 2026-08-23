class TokenBucket{
    private tokens: number
    private lastRefillMs: number

    constructor(
        private readonly capacity: number,
        private readonly refillRatePerSecond: number,
        now: number = Date.now()
    ){
        this.tokens = capacity,
        this.lastRefillMs = now
    }
}