/**
 * NextAuth.js 認証設定
 * マルチテナント対応版
 */

import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import bcrypt from 'bcryptjs';
import { prisma } from './db';

// 型拡張
declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      image?: string | null;
      organizationId?: string;
      organizationName?: string;
      role?: string;
    };
  }

  interface User {
    id: string;
    email: string;
    name?: string | null;
    image?: string | null;
    organizationId?: string;
    organizationName?: string;
    role?: string;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    organizationId?: string;
    organizationName?: string;
    role?: string;
  }
}

// Google OAuth が設定されているかチェック
const isGoogleOAuthConfigured = !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

export const authOptions: NextAuthOptions = {
  providers: [
    // Google OAuth（設定されている場合のみ）
    ...(isGoogleOAuthConfigured
      ? [
          GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
            allowDangerousEmailAccountLinking: true, // 同じメールでの認証方法切り替えを許可
          }),
        ]
      : []),

    // メール/パスワード認証
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'メールアドレス', type: 'email' },
        password: { label: 'パスワード', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        try {
          // ユーザーを検索
          const user = await prisma.user.findUnique({
            where: { email: credentials.email },
            include: {
              memberships: {
                include: {
                  organization: true,
                },
                take: 1, // 最初の組織を取得
              },
            },
          });

          if (!user || !user.passwordHash) {
            return null;
          }

          // パスワード照合
          const isValid = await bcrypt.compare(credentials.password, user.passwordHash);
          if (!isValid) {
            return null;
          }

          // 組織情報を取得
          const membership = user.memberships[0];

          return {
            id: user.id,
            email: user.email,
            name: user.name,
            image: user.image,
            organizationId: membership?.organizationId,
            organizationName: membership?.organization.name,
            role: membership?.role,
          };
        } catch (error) {
          console.error('[AUTH] Credentials error:', error);
          return null;
        }
      },
    }),
  ],

  session: {
    strategy: 'jwt',
    maxAge: 7 * 24 * 60 * 60, // 7日間
  },

  pages: {
    signIn: '/login',
    error: '/login',
    newUser: '/onboarding', // 新規ユーザーのリダイレクト先
  },

  callbacks: {
    async signIn({ user, account, profile }) {
      // Google OAuth の場合
      if (account?.provider === 'google' && profile?.email) {
        try {
          // 既存ユーザーを検索
          let dbUser = await prisma.user.findUnique({
            where: { email: profile.email },
            include: {
              memberships: {
                include: {
                  organization: true,
                },
                take: 1,
              },
            },
          });

          // 新規ユーザーの場合は作成
          if (!dbUser) {
            dbUser = await prisma.user.create({
              data: {
                email: profile.email,
                name: profile.name || null,
                image: (profile as { picture?: string }).picture || null,
                googleId: account.providerAccountId,
                emailVerified: new Date(),
              },
              include: {
                memberships: {
                  include: {
                    organization: true,
                  },
                  take: 1,
                },
              },
            });
          } else if (!dbUser.googleId) {
            // GoogleIDを紐付け
            await prisma.user.update({
              where: { id: dbUser.id },
              data: {
                googleId: account.providerAccountId,
                image: dbUser.image || (profile as { picture?: string }).picture || null,
              },
            });
          }

          // ユーザーIDをセット（callbacksで使用）
          user.id = dbUser.id;
          user.organizationId = dbUser.memberships[0]?.organizationId;
          user.organizationName = dbUser.memberships[0]?.organization.name;
          user.role = dbUser.memberships[0]?.role;

          return true;
        } catch (error) {
          console.error('[AUTH] Google sign in error:', error);
          return false;
        }
      }

      return true;
    },

    async jwt({ token, user, trigger, session }) {
      // 初回サインイン時
      if (user) {
        token.id = user.id;
        token.organizationId = user.organizationId;
        token.organizationName = user.organizationName;
        token.role = user.role;
      }

      // セッション更新時（組織変更など）
      if (trigger === 'update' && session) {
        token.organizationId = session.organizationId;
        token.organizationName = session.organizationName;
        token.role = session.role;
      }

      return token;
    },

    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id;
        session.user.organizationId = token.organizationId;
        session.user.organizationName = token.organizationName;
        session.user.role = token.role;
      }

      return session;
    },
  },

  events: {
    async signIn({ user, account }) {
      console.log('[AUTH] User signed in:', {
        userId: user.id,
        email: user.email,
        provider: account?.provider,
      });
    },
  },

  secret: process.env.NEXTAUTH_SECRET || 'development-secret-key-change-in-production',
};

/**
 * パスワードをハッシュ化
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

/**
 * パスワードを検証
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * スラッグを生成（組織URL用）
 */
export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 50) || `org-${Date.now()}`;
}

/**
 * 招待トークンを生成
 */
export function generateInviteToken(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  for (let i = 0; i < 32; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}
