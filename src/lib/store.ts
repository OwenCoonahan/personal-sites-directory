import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { Site } from "./types";

// Submission queue + rate limit.
// Prod: Upstash Redis via its REST API (set UPSTASH_REDIS_REST_URL + _TOKEN).
// Dev:  local JSON files under data/_queue/ so everything runs with no accounts.

export type Pending = {
  id: string;
  url: string;
  name?: string;
  note?: string;
  ip: string;
  ts: number;
};

const URL_ = process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const useRedis = Boolean(URL_ && TOKEN);

const PENDING = "hp:pending";
const APPROVED = "hp:approved";

// ---- Upstash REST ----------------------------------------------------------
async function redis(cmd: (string | number)[]): Promise<unknown> {
  const res = await fetch(URL_!, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(cmd),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`upstash ${res.status}`);
  const json = (await res.json()) as { result: unknown };
  return json.result;
}

// ---- local file fallback ---------------------------------------------------
const DIR = join(process.cwd(), "data", "_queue");
function filePath(name: string) {
  return join(DIR, `${name}.json`);
}
function readFile<T>(name: string, fallback: T): T {
  try {
    return JSON.parse(readFileSync(filePath(name), "utf8")) as T;
  } catch {
    return fallback;
  }
}
function writeFile(name: string, data: unknown) {
  mkdirSync(DIR, { recursive: true });
  writeFileSync(filePath(name), JSON.stringify(data, null, 2));
}
const mem = new Map<string, { n: number; exp: number }>();

// ---- public API ------------------------------------------------------------
export async function addPending(p: Pending) {
  if (useRedis) await redis(["LPUSH", PENDING, JSON.stringify(p)]);
  else writeFile("pending", [p, ...(await listPending())]);
}

export async function listPending(): Promise<Pending[]> {
  if (useRedis) {
    const arr = (await redis(["LRANGE", PENDING, 0, -1])) as string[];
    return arr.map((s) => JSON.parse(s) as Pending);
  }
  return readFile<Pending[]>("pending", []);
}

export async function removePending(id: string) {
  if (useRedis) {
    const arr = (await redis(["LRANGE", PENDING, 0, -1])) as string[];
    for (const s of arr) {
      if ((JSON.parse(s) as Pending).id === id) await redis(["LREM", PENDING, 1, s]);
    }
  } else {
    writeFile("pending", (await listPending()).filter((p) => p.id !== id));
  }
}

export async function addApproved(site: Site) {
  if (useRedis) await redis(["LPUSH", APPROVED, JSON.stringify(site)]);
  else writeFile("approved", [site, ...(await listApproved())]);
}

export async function listApproved(): Promise<Site[]> {
  try {
    if (useRedis) {
      const arr = (await redis(["LRANGE", APPROVED, 0, -1])) as string[];
      return arr.map((s) => JSON.parse(s) as Site);
    }
    return readFile<Site[]>("approved", []);
  } catch {
    return [];
  }
}

// Returns true if allowed, false if over the limit. limit per windowSeconds.
export async function rateLimit(ip: string, limit = 3, windowSeconds = 86400): Promise<boolean> {
  const key = `hp:rl:${ip}`;
  if (useRedis) {
    const n = (await redis(["INCR", key])) as number;
    if (n === 1) await redis(["EXPIRE", key, windowSeconds]);
    return n <= limit;
  }
  const now = Date.now();
  const cur = mem.get(key);
  if (!cur || cur.exp < now) {
    mem.set(key, { n: 1, exp: now + windowSeconds * 1000 });
    return true;
  }
  cur.n++;
  return cur.n <= limit;
}

export const storageMode = useRedis ? "upstash" : "local-file";
