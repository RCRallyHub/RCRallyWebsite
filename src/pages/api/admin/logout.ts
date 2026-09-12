import type { APIRoute } from 'astro';
import { deleteSession, SESSION_COOKIE_NAME } from '../../../lib/auth';

export const prerender = false;

export const POST: APIRoute = async ({ cookies, redirect }) => {
  const token = cookies.get(SESSION_COOKIE_NAME)?.value;
  await deleteSession(token);
  cookies.delete(SESSION_COOKIE_NAME, { path: '/' });
  return redirect('/portal/login');
};
