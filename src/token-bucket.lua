local key = KEYS[1]

local capacity = tonumber(ARGV[1])
local refill_rate = tonumber(ARGV[2])
local now = tonumber(ARGV[3])
local ttl_seconds = tonumber(ARGV[4])

local tokens = redis.call("HGET", key, "tokens")
local last_refill = redis.call("HGET", key, "last_refill")

if tokens == false or last_refill == false then
  tokens = capacity
  last_refill = now
else
  tokens = tonumber(tokens)
  last_refill = tonumber(last_refill)
end

local elapsed_ms = math.max(0, now - last_refill)
local tokens_to_add = (elapsed_ms / 1000) * refill_rate

tokens = math.min(capacity, tokens + tokens_to_add)

local allowed = 0
if tokens >= 1 then
  tokens = tokens - 1
  allowed = 1
end

redis.call("HSET", key, "tokens", tokens, "last_refill", now)
redis.call("EXPIRE", key, ttl_seconds)

return { allowed, tokens }
