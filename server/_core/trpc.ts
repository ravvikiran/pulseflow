import { UNAUTHED_ERR_MSG, NOT_ADMIN_ERR_MSG } from '@shared/const';
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

// Default local user for when no auth system is configured
const DEFAULT_USER = {
  id: 1,
  openId: "local-user",
  name: "Local User",
  email: null,
  loginMethod: "local",
  role: "admin" as const,
  createdAt: new Date(),
  updatedAt: new Date(),
  lastSignedIn: new Date(),
};

const requireUser = t.middleware(async opts => {
  const { ctx, next } = opts;

  // Use authenticated user if available, otherwise use default local user
  const user = ctx.user ?? DEFAULT_USER;

  return next({
    ctx: {
      ...ctx,
      user,
    },
  });
});

export const protectedProcedure = t.procedure.use(requireUser);

export const adminProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;

    // In local mode, always allow admin access
    const user = ctx.user ?? DEFAULT_USER;

    return next({
      ctx: {
        ...ctx,
        user,
      },
    });
  }),
);
