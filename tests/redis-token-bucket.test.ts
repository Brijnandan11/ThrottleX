import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
} from "vitest"

import { createClient } from "redis"

import {
  RedisTokenBucket,
} from "../src/redis-token-bucket.js"

const redis = createClient({
  url: "redis://localhost:6379",
})

let limiter: RedisTokenBucket

beforeAll(async () => {
  await redis.connect()

  limiter = new RedisTokenBucket(
    5,
    2,
    3600
  );
});

beforeEach(async () => {
  await redis.flushDb();
});

afterAll(async () => {
  await redis.quit();
});

describe("RedisTokenBucket", () => {
  test("burst allowed", async () => {
    for (let i = 0; i < 5; i++) {
      const result =
        await limiter.tryConsume(
          "user123",
          0
        );

      expect(result.allowed).toBe(true);
    }

    const result =
      await limiter.tryConsume(
        "user123",
        0
      );

    expect(result.allowed).toBe(false);
  });

  test("bucket becomes empty", async () => {
    for (let i = 0; i < 5; i++) {
      await limiter.tryConsume(
        "user123",
        0
      );
    }

    const state =
      await redis.hGetAll(
        "rate_limit:user123"
      );

    expect(
      Number(state.tokens)
    ).toBe(0);
  });

  test("empty bucket rejects", async () => {
    for (let i = 0; i < 5; i++) {
      await limiter.tryConsume(
        "user123",
        0
      );
    }

    const result =
      await limiter.tryConsume(
        "user123",
        0
      );

    expect(result.allowed).toBe(false);
  });

  test("tokens refill", async () => {
    for (let i = 0; i < 5; i++) {
      await limiter.tryConsume(
        "user123",
        0
      );
    }

    const result =
      await limiter.tryConsume(
        "user123",
        1000
      );

    expect(result.allowed).toBe(true);
    expect(
      result.remainingTokens
    ).toBe(1);
  });

  test("tokens never exceed capacity", async () => {
    const result =
      await limiter.tryConsume(
        "user123",
        100000
      )

    expect(result.allowed).toBe(true);
    expect(
      result.remainingTokens
    ).toBe(4);
  })

  test("clients have independent buckets", async () => {
    for (let i = 0; i < 5; i++) {
      await limiter.tryConsume(
        "userA",
        0
      )
    }

    const userA =
      await limiter.tryConsume(
        "userA",
        0
      )

    const userB =
      await limiter.tryConsume(
        "userB",
        0
      )

    expect(userA.allowed).toBe(false);
    expect(userB.allowed).toBe(true);
  })

  test("same client uses same bucket", async () => {
    await limiter.tryConsume(
      "user123",
      0
    )

    await limiter.tryConsume(
      "user123",
      0
    )

    const state =
      await redis.hGetAll(
        "rate_limit:user123"
      )

    expect(
      Number(state.tokens)
    ).toBe(3)

    expect(
      Number(state.last_refill)
    ).toBe(0)
  })

  test("bucket expires", async () => {
    const shortLimiter =
      new RedisTokenBucket(
        5,
        2,
        1
      )

    await shortLimiter.tryConsume(
      "user123",
      0
    )

    expect(
      await redis.exists(
        "rate_limit:user123"
      )
    ).toBe(1)

    await new Promise(
      (resolve) =>
        setTimeout(resolve, 1100)
    )

    expect(
      await redis.exists(
        "rate_limit:user123"
      )
    ).toBe(0)
  })

  test("new bucket after expiration", async () => {
    const shortLimiter =
      new RedisTokenBucket(
        2,
        1,
        1
      )

    await shortLimiter.tryConsume(
      "user123",
      0
    )

    await shortLimiter.tryConsume(
      "user123",
      0
    )

    const rejected =
      await shortLimiter.tryConsume(
        "user123",
        0
      )

    expect(
      rejected.allowed
    ).toBe(false)

    await new Promise(
      (resolve) =>
        setTimeout(resolve, 1100)
    )

    const fresh =
      await shortLimiter.tryConsume(
        "user123",
        2000
      )

    expect(
      fresh.allowed
    ).toBe(true)
  })

  test("concurrent requests are atomic", async () => {
    const requests =
      Array.from(
        { length: 20 },
        () =>
          limiter.tryConsume(
            "user123",
            0
          )
      );

    const results =
      await Promise.all(requests);

    const allowed =
      results.filter(
        (result) => result.allowed
      ).length

    expect(allowed).toBe(5)
  })
})