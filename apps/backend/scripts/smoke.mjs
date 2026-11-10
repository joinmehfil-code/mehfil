/**
 * Mehfil API smoke test — exercises the Phase 1 backend end-to-end.
 * Usage: node scripts/smoke.mjs  (expects the API on http://localhost:4000/api)
 */
const BASE = process.env.API_URL || 'http://localhost:4000/api';
const stamp = Date.now();
const email = `smoke_${stamp}@example.com`;
const username = `smoke_${stamp}`;
const password = 'Passw0rd!123';

let pass = 0;
let fail = 0;
const results = [];

async function call(method, path, { token, body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  const text = await res.text();
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { status: res.status, data };
}

function check(name, cond, extra = '') {
  if (cond) {
    pass++;
    results.push(`  ✓ ${name}`);
  } else {
    fail++;
    results.push(`  ✗ ${name} ${extra}`);
  }
}

async function main() {
  // Health (mounted at root, not under /api prefix guard)
  const health = await fetch(`${BASE.replace('/api', '')}/health`).then((r) => r.status);
  check('GET /health → 200', health === 200, `(got ${health})`);

  // Register
  const reg = await call('POST', '/auth/register', {
    body: {
      email,
      password,
      username,
      displayName: 'Smoke Tester',
      dateOfBirth: '1995-01-01',
      acceptedAge: true,
    },
  });
  check('POST /auth/register → 200/201', reg.status < 300, `(got ${reg.status})`);

  // Login
  const login = await call('POST', '/auth/login', { body: { email, password } });
  check('POST /auth/login → 200/201', login.status < 300, `(got ${login.status})`);
  const token =
    login.data?.tokens?.accessToken ||
    login.data?.accessToken ||
    login.data?.data?.tokens?.accessToken;
  check('login returned accessToken', !!token);

  if (!token) {
    console.log(results.join('\n'));
    console.log(`\n${pass} passed, ${fail} failed`);
    process.exit(1);
  }

  // Me
  const me = await call('GET', '/auth/me', { token });
  check('GET /auth/me → 200', me.status === 200, `(got ${me.status})`);

  // Create a post
  const post = await call('POST', '/posts', {
    token,
    body: { content: 'Hello Mehfil smoke test #welcome', type: 'TEXT' },
  });
  check('POST /posts → 200/201', post.status < 300, `(got ${post.status})`);
  const postId = post.data?.id || post.data?.data?.id;

  // Feed
  const feed = await call('GET', '/posts/feed', { token });
  check('GET /posts/feed → 200', feed.status === 200, `(got ${feed.status})`);

  if (postId) {
    const react = await call('POST', `/posts/${postId}/reactions`, {
      token,
      body: { type: 'LIKE' },
    });
    check('POST /posts/:id/reactions → 200/201', react.status < 300, `(got ${react.status})`);

    const comment = await call('POST', `/posts/${postId}/comments`, {
      token,
      body: { content: 'Nice post!' },
    });
    check('POST /posts/:id/comments → 200/201', comment.status < 300, `(got ${comment.status})`);
  }

  // Communities
  const commDiscover = await call('GET', '/communities/discover', { token });
  check('GET /communities/discover → 200', commDiscover.status === 200, `(got ${commDiscover.status})`);

  const community = await call('POST', '/communities', {
    token,
    body: { name: `Smoke Community ${stamp}`, description: 'A test community', access: 'PUBLIC' },
  });
  check('POST /communities → 200/201', community.status < 300, `(got ${community.status})`);

  // Events
  const evDiscover = await call('GET', '/events/discover', { token });
  check('GET /events/discover → 200', evDiscover.status === 200, `(got ${evDiscover.status})`);

  const event = await call('POST', '/events', {
    token,
    body: {
      title: `Smoke Event ${stamp}`,
      description: 'A test event',
      startsAt: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
      type: 'IN_PERSON',
      venueName: 'Test Venue',
      venueCity: 'Karachi',
    },
  });
  check('POST /events → 200/201', event.status < 300, `(got ${event.status})`);

  // Conversations / notifications
  const convos = await call('GET', '/conversations', { token });
  check('GET /conversations → 200', convos.status === 200, `(got ${convos.status})`);

  const notifs = await call('GET', '/notifications', { token });
  check('GET /notifications → 200', notifs.status === 200, `(got ${notifs.status})`);

  // Reports (mine)
  const myReports = await call('GET', '/reports/mine', { token });
  check('GET /reports/mine → 200', myReports.status === 200, `(got ${myReports.status})`);

  // Admin must be forbidden for a normal user
  const adminStats = await call('GET', '/admin/stats', { token });
  check('GET /admin/stats → 403 for normal user', adminStats.status === 403, `(got ${adminStats.status})`);

  // Unauthenticated must be 401
  const noAuth = await call('GET', '/posts/feed');
  check('GET /posts/feed without token → 401', noAuth.status === 401, `(got ${noAuth.status})`);

  // ---- Admin flow: promote self, re-login for an ADMIN token, hit admin APIs ----
  try {
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();
    await prisma.user.update({ where: { id: me.data?.id }, data: { role: 'ADMIN' } });
    await prisma.$disconnect();

    const adminLogin = await call('POST', '/auth/login', { body: { email, password } });
    const adminToken = adminLogin.data?.tokens?.accessToken;
    check('admin re-login issued token', !!adminToken);

    if (adminToken) {
      const stats = await call('GET', '/admin/stats', { token: adminToken });
      check('GET /admin/stats (admin) → 200', stats.status === 200, `(got ${stats.status})`);
      check(
        'admin stats has expected shape',
        !!(stats.data?.users && stats.data?.orders && stats.data?.reports),
      );

      const users = await call('GET', '/admin/users?limit=5', { token: adminToken });
      check('GET /admin/users (admin) → 200', users.status === 200, `(got ${users.status})`);

      const growth = await call('GET', '/admin/analytics/users?days=7', { token: adminToken });
      check('GET /admin/analytics/users → 200', growth.status === 200, `(got ${growth.status})`);
      check('user growth returns 7 buckets', Array.isArray(growth.data) && growth.data.length === 7);

      const revenue = await call('GET', '/admin/analytics/revenue?days=7', { token: adminToken });
      check('GET /admin/analytics/revenue → 200', revenue.status === 200, `(got ${revenue.status})`);

      // Moderator-gated reports list should now be reachable by an admin
      const allReports = await call('GET', '/reports', { token: adminToken });
      check('GET /reports (staff) → 200', allReports.status === 200, `(got ${allReports.status})`);
    }
  } catch (e) {
    fail++;
    results.push(`  ✗ admin flow crashed: ${e.message}`);
  }

  console.log(results.join('\n'));
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Smoke test crashed:', err);
  process.exit(1);
});
