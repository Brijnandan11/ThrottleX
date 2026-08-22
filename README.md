# ThrottleX — Token Bucket Rate Limiter

A small, focused system project: cap request rate per client fairly, while
still allowing short bursts.

## Problem

Naive rate limiting (fixed window counters) either lets clients burst
way over their allowed rate at window boundaries, or is too strict and
rejects legitimate bursty traffic. Need an algorithm that allows short
bursts up to a cap, then throttles to a sustained average rate.

## Concept

**Token bucket vs leaky bucket**

- **Token bucket**: a bucket holds up to `N` tokens. Tokens refill at a
  fixed rate (`r` tokens/sec). Each request consumes 1 token. If the
  bucket has tokens, the request is allowed and a token is removed. If
  empty, the request is rejected. Because tokens accumulate while idle
  (up to the cap), a client that hasn't made requests in a while can
  burst up to `N` requests instantly.
- **Leaky bucket**: requests fill a queue (the bucket) that drains
  (leaks) at a fixed rate. Output rate is smoothed to exactly the leak
  rate regardless of input burstiness — no bursting allowed, and
  requests queue instead of executing immediately.

Token bucket is chosen as the primary implementation because it
tolerates bursts (more realistic for API clients), while leaky bucket
is built afterward as a comparison extension.

## Build plan

1. **In-memory token bucket** — single process, `Map<clientId, {tokens, lastRefill}>`.
   Prove the algorithm and refill math work before adding network calls.
2. **Redis-backed, naive** — `INCR` + `EXPIRE` per client per window.
   Simple but has a race condition: INCR and EXPIRE are two round trips,
   not atomic, so concurrent requests can double-count or miss the TTL reset.
3. **Redis-backed, atomic** — a Lua script (`EVAL`) that reads the
   current token count and last-refill timestamp, computes the refill,
   checks/decrements, and writes the new state back — all in one atomic
   round trip. This is the version that's actually correct under
   concurrency and is what ships.

## Explicitly out of scope

- A full API gateway (routing, auth, request transformation, etc.) —
  this is a rate-limiting primitive only, not a gateway.

## Tests

- **Burst allowed** — a client with a full bucket can fire `N` requests
  back-to-back and all succeed.
- **Sustained rate rejected** — a client firing requests faster than the
  refill rate gets throttled once the bucket empties, even if under the
  burst cap initially.
- **TTL / reset behavior** — bucket state correctly expires/resets after
  a period of inactivity (Redis key TTL, or in-memory cleanup).

## Failure mode: Redis unavailable

Decision: **[fail open or fail closed — decide and document here once
built, including why]**.

- *Fail open* (allow all requests when Redis is down) prioritizes
  availability — rate limiting is a protection layer, not the core
  service, so an outage in it shouldn't take down the API. Risk:
  no protection against abuse/overload during the outage.
- *Fail closed* (reject all requests when Redis is down) prioritizes
  safety — never let unlimited traffic through. Risk: a Redis blip
  becomes a full outage for legitimate clients.

Document the actual choice made, the reasoning, and any mitigation
(e.g. local in-memory fallback bucket, circuit breaker around Redis)
once implemented.

## Extension

- **Leaky-bucket variant** implemented alongside the token-bucket
  version for direct comparison — same interface, different algorithm,
  so behavior differences (burst vs no-burst) can be demonstrated with
  the same test suite/benchmark.

## What production actually uses instead

- [`redis-cell`](https://github.com/brandur/redis-cell) — a Redis
  module implementing the generic cell rate limiting algorithm (GCRA),
  battle-tested and more efficient than a hand-rolled Lua script.
- Kong / Envoy rate-limit plugins — for gateway-level rate limiting at
  the infrastructure layer rather than in application code.

This project is for understanding the mechanism, not replacing these.

## Stack

Node.js, TypeScript, Redis (Lua via `EVAL`), Docker.

## Research

- "token bucket vs leaky bucket rate limiting"
- "redis rate limiter lua script"