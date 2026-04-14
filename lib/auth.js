import { PrismaAdapter } from "@next-auth/prisma-adapter";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import prisma from "./prisma";

export const authOptions = {
  adapter: PrismaAdapter(prisma),
  session: {
    strategy: "jwt",
  },
  providers: [
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
    async jwt({ token, user, trigger }) {
      // On first sign-in, populate from the authorize() return value
      if (user) {
        token.id = user.id;
        token.plan = user.plan;
      }
      // On session update (e.g. after Stripe upgrade) or any refresh,
      // re-fetch the latest plan from the DB so it stays accurate
      if (trigger === "update" || (!user && token.id)) {
        try {
          const fresh = await prisma.user.findUnique({
            where: { id: token.id },
            select: { plan: true },
          });
          if (fresh) token.plan = fresh.plan;
        } catch (_) {
          // DB unavailable — keep existing token values
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
