import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import path from "node:path"
import { createClient } from "redis"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const LUA_SCRIPT = readFileSync(
  path.join(__dirname, "token-bucket.lua"),
  "utf8"
)

const redis = createClient({
  url: "redis://localhost:6379",
})

redis.on("error", (error) => {
  console.error("Redis error:", error)
})

export type RateLimitResult = {
  allowed: boolean;
  remainingTokens: number;
}

export class RedisTokenBucket {
  constructor(
    private readonly capacity: number,
    private readonly refillRatePerSecond: number,
    private readonly ttlSeconds = 3600
  ) {
    if (capacity <= 0) {
      throw new Error("capacity must be > 0")
    }

    if (refillRatePerSecond <= 0) {
      throw new Error(
        "refillRatePerSecond must be > 0"
      )
    }

    if (ttlSeconds <= 0) {
      throw new Error("ttlSeconds must be > 0")
    }
  }

  async tryConsume(
    clientId: string,
    now: number = Date.now()
  ): Promise<RateLimitResult> {
    const key = `rate_limit:${clientId}`

    const result = await redis.eval(
      LUA_SCRIPT,
      {
        keys: [key],
        arguments: [
          String(this.capacity),
          String(this.refillRatePerSecond),
          String(now),
          String(this.ttlSeconds),
        ],
      }
    )

    const [allowed, remainingTokens] =
      result as [number, number]

    return {
      allowed: allowed === 1,
      remainingTokens: Number(
        remainingTokens
      ),
    }
  }
}