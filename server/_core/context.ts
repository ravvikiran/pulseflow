import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

/**
 * PulseFlow is a single-user local tool with no login flow. `user` stays null
 * here and `protectedProcedure` substitutes the default local user
 * (see ./trpc.ts).
 *
 * The earlier JWT-cookie path was removed: nothing ever issued the cookie and
 * it fell back to a hard-coded signing secret, so any client could forge a
 * session. If real auth is added later, verify the session here using a
 * secret loaded from validated env config.
 */
export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  return {
    req: opts.req,
    res: opts.res,
    user: null,
  };
}
