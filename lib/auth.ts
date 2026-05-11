import NextAuth from "next-auth";
import Discord from "next-auth/providers/discord";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { fetchOwnGuildMember, fetchGuildMember } from "@/lib/discord";

const INVITE_COOKIE = "unsc_invite";

/**
 * Look up an invite code stashed in a cookie before the OAuth redirect.
 * Returns the InviteCode row when valid + still has capacity, null otherwise.
 */
async function consumeInviteCookieCheck(): Promise<
  | { id: string; code: string; label: string }
  | null
> {
  try {
    const jar = await cookies();
    const code = jar.get(INVITE_COOKIE)?.value?.trim().toUpperCase();
    if (!code) return null;
    const inv = await prisma.inviteCode.findUnique({
      where: { code },
      select: { id: true, code: true, label: true, revoked: true, expiresAt: true, maxUses: true, uses: true },
    });
    if (!inv || inv.revoked) return null;
    if (inv.expiresAt && inv.expiresAt.getTime() < Date.now()) return null;
    if (inv.maxUses !== null && inv.uses >= inv.maxUses) return null;
    return { id: inv.id, code: inv.code, label: inv.label };
  } catch {
    return null;
  }
}

const GUILD_ID = process.env.DISCORD_GUILD_ID!;
const AUTHORIZED_ROLE_ID = process.env.AUTHORIZED_ROLE_ID!;

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(prisma),
  // JWT sessions: skips the Session table lookup on every page render (≈ -1 DB roundtrip per request).
  // We still persist the User via PrismaAdapter on first sign-in, and update lastSeenAt + DiscordRoleSnapshot in events.signIn.
  session: { strategy: "jwt" },
  trustHost: true,
  providers: [
    Discord({
      clientId: process.env.DISCORD_CLIENT_ID!,
      clientSecret: process.env.DISCORD_CLIENT_SECRET!,
      authorization: {
        url: "https://discord.com/api/oauth2/authorize",
        // Bare minimum:
        //   identify              — username + avatar + id
        //   guilds.members.read   — call /users/@me/guilds/{guild}/member
        //                           to check the AUTHORIZED_ROLE_ID
        // We deliberately do NOT request:
        //   email   — never used
        //   guilds  — we don't list the user's full server list, just
        //             check membership in our one guild
        params: { scope: "identify guilds.members.read" },
      },
    }),
  ],
  callbacks: {
    /**
     * Reject sign-in unless the user holds AUTHORIZED_ROLE_ID in the configured guild.
     * On approval, snapshot their roles + sync profile fields.
     */
    async signIn({ user, account, profile }) {
      if (account?.provider !== "discord" || !account.access_token) return false;
      if (!GUILD_ID || !AUTHORIZED_ROLE_ID) {
        // Misconfigured env -> deny (fail closed).
        console.error("[auth] DISCORD_GUILD_ID or AUTHORIZED_ROLE_ID missing");
        return false;
      }

      const discordId = account.providerAccountId;
      let member: { user?: { id: string; avatar?: string; username?: string; global_name?: string }; roles: string[] } | null = null;

      // Bypass path: if the user arrived with a valid invite cookie, accept
      // them as authorized regardless of guild role. We still try OAuth so
      // we capture their Discord member info for the snapshot, but failure
      // is non-fatal in this path.
      const inviteHit = await consumeInviteCookieCheck();

      // Pass 1: OAuth-based check. Cheap, no rate limits on the bot.
      try {
        member = await fetchOwnGuildMember(account.access_token, GUILD_ID);
      } catch (e) {
        // Discord's API sits behind Cloudflare and intermittently returns
        // 5xx HTML challenge pages instead of JSON for the OAuth member
        // endpoint. Don't deny the user over a transient CF blip — fall
        // through to the bot pass.
        console.warn("[auth] OAuth guild member fetch failed, will try bot fallback", {
          discordId,
          error: e instanceof Error ? e.message.slice(0, 200) : String(e),
        });
      }

      const oauthHasRole = !!member?.roles.includes(AUTHORIZED_ROLE_ID);

      // Pass 2: bot-token fetch. Always live (no OAuth cache, no CF challenges
      // in our experience) and authoritative. We hit it whenever OAuth either
      // failed entirely or said the user has no role — covers both the
      // CF-block case and the stale-cache-after-role-grant case.
      if (!oauthHasRole) {
        // If they have a valid invite, skip the bot fallback entirely —
        // they're authorized via the invite, not via guild role. Synthesize
        // a minimal member object if OAuth gave us nothing so the events
        // hook below has something to snapshot.
        if (inviteHit) {
          if (!member) {
            member = { roles: [], user: { id: discordId } };
          }
          console.info("[auth] sign-in via invite", {
            discordId,
            inviteCode: inviteHit.code,
          });
        } else {
          if (member) {
            console.warn("[auth] OAuth shows no AUTHORIZED_ROLE, retrying via bot", {
              discordId,
              oauthRoles: member.roles,
            });
          }
          try {
            const fresh = await fetchGuildMember(discordId, GUILD_ID);
            if (fresh && fresh.roles.includes(AUTHORIZED_ROLE_ID)) {
              member = fresh;
            } else if (!fresh) {
              console.warn("[auth] bot says user not in guild", { discordId });
              return false;
            } else {
              console.warn("[auth] bot also confirms no AUTHORIZED_ROLE", {
                discordId,
                botRoles: fresh.roles,
              });
              return false;
            }
          } catch (e) {
            console.error("[auth] bot fallback fetch failed", {
              discordId,
              error: e instanceof Error ? e.message.slice(0, 200) : String(e),
            });
            return false;
          }
        }
      }
      if (!member) {
        // Defensive — by here either OAuth, bot or invite succeeded; if none,
        // we've already returned false above.
        return false;
      }

      // Snapshot roles + sync profile (best-effort, before adapter persists user).
      // discordId was already extracted above for the bot fallback.
      const username = member.user?.global_name ?? member.user?.username ?? user.name ?? null;

      // Defer the snapshot write until after the adapter creates/updates the User
      // (we need the internal user id). We'll do it in the `events.signIn` hook.
      Object.assign(account, {
        _milsim_member: member,
        _milsim_discordId: discordId,
        _milsim_username: username,
        _milsim_inviteId: inviteHit?.id ?? null,
      });
      return true;
    },
    async jwt({ token, user }) {
      // `user` is only present on sign-in; store the internal id in the token.
      if (user) token.uid = user.id;
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.uid) {
        (session.user as { id?: string }).id = token.uid as string;
      }
      return session;
    },
  },
  events: {
    async signIn({ user, account }) {
      if (!account || account.provider !== "discord") return;
      const member = (account as Record<string, unknown>)._milsim_member as
        | { roles: string[]; user?: { id: string; avatar?: string } }
        | undefined;
      const discordId = (account as Record<string, unknown>)._milsim_discordId as string | undefined;
      const username = (account as Record<string, unknown>)._milsim_username as string | undefined;
      const inviteId = (account as Record<string, unknown>)._milsim_inviteId as string | null | undefined;
      if (!member || !user.id) return;

      // Avatar is only seeded from Discord on first login (when avatarUrl is null).
      // After that, the user manages their own avatar — we don't overwrite it on every sign-in.
      const existing = await prisma.user.findUnique({
        where: { id: user.id },
        select: { avatarUrl: true },
      });
      const seedAvatar = !existing?.avatarUrl && member.user?.avatar
        ? `https://cdn.discordapp.com/avatars/${member.user.id}/${member.user.avatar}.png?size=256`
        : undefined;

      await prisma.$transaction([
        prisma.user.update({
          where: { id: user.id },
          data: {
            discordId: discordId ?? undefined,
            discordUsername: username ?? undefined,
            avatarUrl: seedAvatar,
            lastSeenAt: new Date(),
          },
        }),
        prisma.discordRoleSnapshot.upsert({
          where: { userId: user.id },
          create: { userId: user.id, roleIds: member.roles, inGuild: true },
          update: { roleIds: member.roles, rolesFetchedAt: new Date(), inGuild: true },
        }),
      ]);

      // Stamp the invite redemption + bump the use counter when this is
      // the user's first sign-in via that code. Existing redemption row
      // (i.e. they came back through an invite link they already used)
      // is silently a no-op — we don't double-count.
      if (inviteId) {
        try {
          await prisma.$transaction(async (tx) => {
            const existingRedemption = await tx.inviteRedemption.findUnique({
              where: { userId: user.id! },
              select: { id: true },
            });
            if (existingRedemption) return;
            await tx.inviteRedemption.create({
              data: { inviteId, userId: user.id! },
            });
            await tx.inviteCode.update({
              where: { id: inviteId },
              data: { uses: { increment: 1 } },
            });
          });
        } catch (e) {
          console.error("[auth] invite redemption persist failed", e);
        }
      }

      // Clear the invite cookie so it doesn't linger.
      try {
        const jar = await cookies();
        if (jar.get(INVITE_COOKIE)) jar.delete(INVITE_COOKIE);
      } catch {
        /* cookies() not available in this context — fine */
      }
    },
  },
  pages: {
    signIn: "/login",
    error:  "/login",
  },
});

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }
}
