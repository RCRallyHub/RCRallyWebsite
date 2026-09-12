import { defineMiddleware } from 'astro:middleware';
import { SESSION_COOKIE_NAME, validateSession } from './lib/auth';

// Paths that must stay reachable while logged out.
const PUBLIC_PATHS = new Set(['/portal/login', '/api/admin/login']);

export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname } = context.url;

  const isPortalRoute = pathname.startsWith('/portal');
  const isAdminApiRoute = pathname.startsWith('/api/admin');

  if (!isPortalRoute && !isAdminApiRoute) {
    return next();
  }

  if (PUBLIC_PATHS.has(pathname)) {
    return next();
  }

  const token = context.cookies.get(SESSION_COOKIE_NAME)?.value;
  const user = await validateSession(token);

  if (!user) {
    if (isAdminApiRoute) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    const redirectTo = encodeURIComponent(pathname + context.url.search);
    return context.redirect(`/portal/login?redirect=${redirectTo}`);
  }

  context.locals.adminUser = user;
  return next();
});
