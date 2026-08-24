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

    private refill(now: number): void{
        const elapsedMs = now - this.lastRefillMs
        const elapsedSeconds = elapsedMs/1000

        const tokensToAdd = elapsedSeconds * this.refillRatePerSecond

        const tokens = Math.min(
            this.capacity, this.tokens + tokensToAdd
        )

        this.lastRefillMs = now
    }
}