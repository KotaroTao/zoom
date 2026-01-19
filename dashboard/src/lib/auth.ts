/**
 * NextAuth.js 認証設定
 */

import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';

// 環境変数から管理者認証情報を取得
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'mail@function-t.com';
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH;

// デフォルトパスワード: MUNP1687
// 本番環境では必ずADMIN_PASSWORD_HASHを環境変数で設定すること
const DEFAULT_PASSWORD_HASH = '$2b$10$Byky4nH6dcljde5Vww4d7ONdGKQu/IOqdALMO5En2fWqdKNLrMPfW';

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'メールアドレス', type: 'email' },
        password: { label: 'パスワード', type: 'password' },
      },
      async authorize(credentials) {
        console.log('[AUTH] Credentials received:', credentials?.email);
        console.log('[AUTH] ADMIN_EMAIL:', ADMIN_EMAIL);
        console.log('[AUTH] ADMIN_PASSWORD_HASH set:', !!ADMIN_PASSWORD_HASH);

        if (!credentials?.email || !credentials?.password) {
          console.log('[AUTH] Missing credentials');
          return null;
        }

        // メールアドレスをチェック
        if (credentials.email !== ADMIN_EMAIL) {
          console.log('[AUTH] Email mismatch:', credentials.email, '!==', ADMIN_EMAIL);
          return null;
        }

        // パスワードをハッシュと照合
        const passwordHash = ADMIN_PASSWORD_HASH || DEFAULT_PASSWORD_HASH;
        console.log('[AUTH] Using hash:', passwordHash?.substring(0, 20) + '...');
        const isValid = await bcrypt.compare(credentials.password, passwordHash);
        console.log('[AUTH] Password valid:', isValid);

        if (!isValid) {
          return null;
        }

        // 認証成功
        return {
          id: '1',
          email: credentials.email,
          name: 'Administrator',
          role: 'admin',
        };
      },
    }),
  ],
  session: {
    strategy: 'jwt',
    maxAge: 24 * 60 * 60, // 24時間
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as { role?: string }).role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as { role?: string }).role = token.role as string;
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET || 'development-secret-key-change-in-production',
};
