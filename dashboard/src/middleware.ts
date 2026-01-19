import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const { pathname } = req.nextUrl;

    // オンボーディングページへのアクセス
    if (pathname === '/onboarding') {
      // 認証済みで組織に所属している場合はダッシュボードへ
      if (token?.organizationId) {
        return NextResponse.redirect(new URL('/', req.url));
      }
      return NextResponse.next();
    }

    // ダッシュボードへのアクセス（オンボーディング以外）
    // 認証済みだが組織未所属の場合はオンボーディングへ
    if (token && !token.organizationId && pathname !== '/onboarding') {
      return NextResponse.redirect(new URL('/onboarding', req.url));
    }

    return NextResponse.next();
  },
  {
    pages: {
      signIn: '/login',
    },
    callbacks: {
      // オンボーディングは認証必須
      authorized: ({ token, req }) => {
        const { pathname } = req.nextUrl;

        // 公開ページ
        if (pathname === '/login' || pathname === '/register' || pathname === '/error') {
          return true;
        }

        // 招待ページは認証不要（ページ内でログインを促す）
        if (pathname.startsWith('/invite/')) {
          return true;
        }

        // それ以外は認証必須
        return !!token;
      },
    },
  }
);

export const config = {
  // ログインページ、登録ページ、エラーページ、招待ページ、APIルート以外のすべてのルートを保護
  matcher: [
    '/((?!login|register|error|invite|api/auth|api/invitations|_next/static|_next/image|favicon.ico).*)',
  ],
};
