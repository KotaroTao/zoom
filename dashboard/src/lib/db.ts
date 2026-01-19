/**
 * Prisma Client for Dashboard
 *
 * Next.js開発環境でのホットリロード時に複数インスタンスが
 * 作成されるのを防ぐためのシングルトンパターン
 */

import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
