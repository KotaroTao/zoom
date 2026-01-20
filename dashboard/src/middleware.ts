import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';

// basePath設定（next.config.jsと同期が必要）
const basePath = '/zoom';

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const { pathname } = req.nextUrl;

    // オンボーディングページへのアクセス
    if (pathname === '/onboarding') {
      // 認証済みで組織に所属している場合はダッシュボードへ
      if (token?.organizationId) {
        const url = req.nextUrl.clone();
        url.pathname = `${basePath}/`;
        return NextResponse.redirect(url);
      }
      return NextResponse.next();
    }

    // ダッシュボードへのアクセス（オンボーディング以外）
    // 認証済みだが組織未所属の場合はオンボーディングへ
    if (token && !token.organizationId && pathname !== '/onboarding') {
      const url = req.nextUrl.clone();
      url.pathname = `${basePath}/onboarding`;
      return NextResponse.redirect(url);
    }

    return NextResponse.next();
  },
  {
    pages: {
      signIn: `${basePath}/login`,
    },
    callbacks: {
      // オンボーディングは認証必須
      authorized: ({ token, req }) => {
        const { pathname } = req.nextUrl;

        // 公開ページ（認証不要）
        if (pathname === '/login' || pathname === '/register' || pathname === '/error') {
          return true;
        }

        // 招待ページは認証不要（ページ内でログインを促す）
        if (pathname.startsWith('/invite/')) {
          return true;
        }

        // オンボーディングページは認証必須（ページ内でセッションチェック）
        // Note: 認証されていない場合はログインページにリダイレクト
        if (pathname === '/onboarding') {
          return !!token;
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
