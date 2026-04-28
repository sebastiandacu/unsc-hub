import NextAuth from "next-auth";
import Discord from "next-auth/providers/discord";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/db";
import { fetchOwnGuildMember } from "@/lib/discord";

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
        params: { scope: "identify email guilds guilds.members.read" },
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

      let member;
      try {
        member = await fetchOwnGuildMember(account.access_token, GUILD_ID);
      } catch (e) {
        console.error("[auth] guild member fetch failed", e);
        return false;
      }
      if (!member) return false;
      if (!member.roles.includes(AUTHORIZED_ROLE_ID)) return false;

      // Snapshot roles + sync profile (best-effort, before adapter persists user).
      const discordId = (profile as { id?: string } | undefined)?.id ?? account.providerAccountId;
      const username = member.user?.global_name ?? member.user?.username ?? user.name ?? null;

      // Defer the snapshot write until after the adapter creates/updates the User
      // (we need the internal user id). We'll do it in the `events.signIn` hook.
      Object.assign(account, { _milsim_member: member, _milsim_discordId: discordId, _milsim_username: username });
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
