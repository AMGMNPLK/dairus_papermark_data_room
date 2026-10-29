import bcrypt from "bcryptjs";
import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

import prisma from "@/lib/prisma";
import { ratelimit } from "@/lib/redis";

// Owner-only local authentication. No registration, external identity service,
// account linking, invitations, analytics, or email delivery is enabled.
export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  useSecureCookies: process.env.NEXTAUTH_URL?.startsWith("https://"),
  pages: { signIn: "/login", error: "/login" },
  session: { strategy: "jwt", maxAge: 8 * 60 * 60 },
  providers: [
    CredentialsProvider({
      id: "owner",
      name: "Owner access",
      credentials: { password: { label: "Owner password", type: "password" } },
      async authorize(credentials, req) {
        const ownerId = process.env.PAPERMARK_OWNER_ID;
        const hash = process.env.PAPERMARK_OWNER_PASSWORD_HASH;
        if (
          !ownerId ||
          !hash ||
          !credentials?.password ||
          credentials.password.length > 256
        )
          return null;
        try {
          // Gateway replaces this header; the app port is never public.
          const ip = String(req.headers?.["x-real-ip"] || "private");
          const limited = await ratelimit(10, "1 m").limit(`owner-login:${ip}`);
          if (!limited.success) return null;
          if (!(await bcrypt.compare(credentials.password, hash))) return null;
          const user = await prisma.user.findUnique({ where: { id: ownerId } });
          if (!user?.email) return null;
          return { id: user.id, email: user.email, name: user.name };
        } catch {
          return null;
        }
      },
    }),
    CredentialsProvider({
      id: "monthly-principal",
      name: "Monthly reviewer access",
      credentials: { email: { label: "Email", type: "email" }, password: { label: "Password", type: "password" } },
      async authorize(credentials, req) {
        const email = credentials?.email?.trim().toLowerCase();
        const password = credentials?.password;
        if (!email || email.length > 320 || !password || password.length > 256) return null;
        try {
          const ip = String(req.headers?.["x-real-ip"] || "private");
          if (!(await ratelimit(10, "1 m").limit(`monthly-login:${ip}`)).success) return null;
          const principal = await prisma.monthlyPrincipal.findUnique({ where: { email } });
          if (!principal || !principal.verifiedAt || principal.revokedAt || !["finance", "legal", "investor"].includes(principal.role) || !(await bcrypt.compare(password, principal.passwordHash))) return null;
          return { id: `monthly:${principal.id}:${principal.sessionVersion}`, email: principal.email, name: null };
        } catch { return null; }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger }) {
      if (user) token.sub = user.id;
      if(trigger==="update" && token.sub && token.sub===process.env.PAPERMARK_OWNER_ID){const current=await prisma.user.findUnique({where:{id:token.sub},select:{name:true}});token.name=current?.name;}
      return token;
    },
    async session({ session, token }) {
      if (session.user)
        (session.user as typeof session.user & { id: string }).id =
          token.sub || "";
      return session;
    },
  },
};
