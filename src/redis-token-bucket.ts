import { readFileSync } from "node:fs"

export interface RedisEvalClient {
  eval<TResult = unknown>(
    script: string,
    options: { keys: string[]; arguments: string[] },
  ): Promise<TResult> | TResult
}

export interface RedisTokenBucketOptions {
  capacity: number
  refillRatePerSecond: number
  ttlSeconds: number
  keyPrefix?: string
}

type LuaResult = [number | string, number | string]

const tokenBucketScript = readFileSync(
  new URL("./token-bucket.lua", import.meta.url),
  "utf8",
)

export class RedisTokenBucket {
  constructor(
    private readonly redis: RedisEvalClient,
    private readonly options: RedisTokenBucketOptions,
  ) {
    if (!Number.isFinite(options.capacity) || options.capacity <= 0) {
      throw new RangeError("capacity must be a positive number")
    }

    if (
      !Number.isFinite(options.refillRatePerSecond) ||
      options.refillRatePerSecond <= 0
    ) {
      throw new RangeError("refillRatePerSecond must be a positive number")
    }

    if (!Number.isFinite(options.ttlSeconds) || options.ttlSeconds <= 0) {
      throw new RangeError("ttlSeconds must be a positive number")
    }
  }

  async tryConsume(clientId: string, now: number = Date.now()): Promise<boolean> {
    const result = await this.redis.eval<LuaResult>(tokenBucketScript, {
      keys: [this.keyFor(clientId)],
      arguments: [
        String(this.options.capacity),
        String(this.options.refillRatePerSecond),
        String(now),
        String(this.options.ttlSeconds),
      ],
    })

    const [allowed] = this.parseResult(result)
    return allowed === 1
  }

  private keyFor(clientId: string): string {
    const prefix = this.options.keyPrefix ?? "throttlex:token-bucket"
    return `${prefix}:${clientId}`
  }

  private parseResult(result: LuaResult | readonly unknown[]): [number, number] {
    if (!Array.isArray(result) || result.length < 2) {
      throw new TypeError("unexpected Lua result from Redis")
    }

    const [allowedRaw, remainingRaw] = result
    const allowed = Number(allowedRaw)
    const remaining = Number(remainingRaw)

    if (!Number.isFinite(allowed) || !Number.isFinite(remaining)) {
      throw new TypeError("Redis returned a non-numeric Lua result")
    }

    return [allowed, remaining]
  }
}
