import { PrismaAdapter } from "@next-auth/prisma-adapter";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import prisma from "./prisma";

export const authOptions = {
  adapter: PrismaAdapter(prisma),
  session: {
    strategy: "jwt",
  },
  trustHost: true,
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        });

        if (!user || !user.password) return null;

        const valid = await bcrypt.compare(credentials.password, user.password);
        if (!valid) return null;

        return { id: user.id, email: user.email, name: user.name, plan: user.plan };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, account }) {
      // First sign-in: populate id and plan
      if (user) {
        token.id = user.id;
        token.plan = user.plan;
        // For OAuth providers, plan won't be on the user object — fetch from DB
        if (!user.plan) {
          try {
            const dbUser = await prisma.user.findUnique({
              where: { email: user.email },
              select: { id: true, plan: true },
            });
            if (dbUser) { token.id = dbUser.id; token.plan = dbUser.plan; }
          } catch (_) {}
        }
        return token;
      }
      // Explicit update() call (e.g. after Stripe upgrade): re-fetch plan from DB
      if (trigger === "update" && token.id) {
        try {
          const fresh = await prisma.user.findUnique({
            where: { id: token.id },
            select: { plan: true },
          });
          if (fresh) token.plan = fresh.plan;
        } catch (_) {
          // Keep existing token values if DB is unreachable
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id;
        session.user.plan = token.plan;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  secret: process.env.NEXTAUTH_SECRET,
};
