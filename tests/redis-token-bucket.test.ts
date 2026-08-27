import { describe, expect, test } from "vitest"
import {
  type RedisEvalClient,
  RedisTokenBucket,
} from "../src/redis-token-bucket.js"

class FakeRedis implements RedisEvalClient {
  public readonly calls: Array<{
    script: string
    keys: string[]
    arguments: string[]
  }> = []

  constructor(private readonly response: unknown) {}

  async eval<TResult = unknown>(
    script: string,
    options: { keys: string[]; arguments: string[] },
  ): Promise<TResult> {
    this.calls.push({ script, ...options })
    return this.response as TResult
  }
}

describe("RedisTokenBucket", () => {
  test("forwards the right arguments to Redis", async () => {
    const redis = new FakeRedis([1, 3])
    const bucket = new RedisTokenBucket(redis, {
      capacity: 5,
      refillRatePerSecond: 2,
      ttlSeconds: 60,
      keyPrefix: "rate-limit",
    })

    await expect(bucket.tryConsume("client-a", 1234)).resolves.toBe(true)
    expect(redis.calls).toHaveLength(1)
    const firstCall = redis.calls.at(0)
    if (!firstCall) {
      throw new Error("expected one redis call")
    }

    expect(firstCall).toMatchObject({
      keys: ["rate-limit:client-a"],
      arguments: ["5", "2", "1234", "60"],
    })
    expect(firstCall.script).toContain("redis.call")
  })

  test("rejects when Redis says the bucket is empty", async () => {
    const redis = new FakeRedis([0, 0])
    const bucket = new RedisTokenBucket(redis, {
      capacity: 1,
      refillRatePerSecond: 1,
      ttlSeconds: 30,
    })

    await expect(bucket.tryConsume("client-b", 5000)).resolves.toBe(false)
  })

  test("validates configuration", () => {
    const redis = new FakeRedis([1, 0])

    expect(
      () =>
        new RedisTokenBucket(redis, {
          capacity: 0,
          refillRatePerSecond: 1,
          ttlSeconds: 30,
        }),
    ).toThrow(RangeError)
  })
})
