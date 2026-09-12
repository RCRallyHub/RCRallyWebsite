import type { APIRoute } from 'astro';
import { verifyCredentials, createSession, SESSION_COOKIE_NAME } from '../../../lib/auth';

export const prerender = false;

function loginFailureRedirect(redirectParam: string): string {
  const suffix = redirectParam ? `&redirect=${encodeURIComponent(redirectParam)}` : '';
  return `/portal/login?error=1${suffix}`;
}

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const form = await request.formData();
  const username = String(form.get('username') ?? '').trim();
  const password = String(form.get('password') ?? '');
  const redirectParam = String(form.get('redirect') ?? '');

  if (!username || !password) {
    return redirect(loginFailureRedirect(redirectParam));
  }

  const user = await verifyCredentials(username, password);
  if (!user) {
    return redirect(loginFailureRedirect(redirectParam));
  }

  const { token, expiresAt } = await createSession(user.id);

  cookies.set(SESSION_COOKIE_NAME, token, {
    path: '/',
    httpOnly: true,
    secure: import.meta.env.PROD,
    sameSite: 'lax',
    expires: expiresAt,
  });

  const target = redirectParam.startsWith('/portal') ? redirectParam : '/portal/dashboard';
  return redirect(target);
};
