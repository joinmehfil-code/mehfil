/* eslint-disable no-console */
/**
 * Mehfil Platform — Phase 1 seed data.
 *
 * Creates a realistic demo dataset spanning every module so the client can
 * exercise the web + mobile apps immediately after `npm run prisma:migrate`:
 *   • users (incl. a SUPER_ADMIN) with skills, follows
 *   • communities, spaces, memberships
 *   • posts (text + poll), comments, reactions, bookmarks
 *   • events, ticket tiers, orders, payments, e-tickets (QR), RSVPs, promo code
 *   • a direct conversation with messages
 *   • notifications and a moderation report
 *
 * The seed is idempotent: it wipes existing rows (children first) then re-creates.
 * Demo password for every seeded account: Password123!
 *
 * Run: npm run prisma:seed  (from apps/backend)
 */
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const DEMO_PASSWORD = 'Password123!';

const now = new Date();
const daysFromNow = (d: number, hourOffset = 0) => {
  const dt = new Date(now.getTime() + d * 24 * 60 * 60 * 1000);
  dt.setHours(19 + hourOffset, 0, 0, 0);
  return dt;
};

async function wipe() {
  // Delete children before parents to respect FK constraints.
  const models = [
    'checkIn', 'eTicket', 'refund', 'payment', 'orderLine', 'order',
    'promoCode', 'eventReminder', 'eventRsvp', 'ticketTier', 'event',
    'pollVote', 'pollOption', 'poll', 'bookmark', 'reaction', 'comment',
    'media', 'post', 'communityInvite', 'communitySpace', 'communityMember',
    'community', 'skillExchangeRequest', 'userSkill', 'follow', 'block',
    'deviceToken', 'verificationToken', 'refreshToken', 'notificationPreference',
    'notification', 'subscription', 'message', 'conversationParticipant',
    'conversation', 'report', 'user',
  ] as const;
  for (const m of models) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (prisma[m] as any).deleteMany({});
  }
}

async function main() {
  console.log('🌱 Seeding Mehfil platform (Phase 1)…');
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  await wipe();

  // ------------------------------- USERS ---------------------------------
  const baseUser = {
    passwordHash,
    emailVerified: true,
    phoneVerified: false,
    isVerified: true,
    status: 'ACTIVE' as const,
    ageAcceptedAt: now,
    locale: 'en',
    timezone: 'Asia/Karachi',
  };

  const admin = await prisma.user.create({
    data: {
      ...baseUser,
      email: 'admin@joinmehfil.co',
      username: 'admin',
      displayName: 'Mehfil Admin',
      role: 'SUPER_ADMIN',
      bio: 'Platform administrator for joinmehfil.co',
      city: 'Lahore',
      country: 'Pakistan',
    },
  });

  const ayesha = await prisma.user.create({
    data: {
      ...baseUser,
      email: 'ayesha@example.com',
      username: 'ayesha',
      displayName: 'Ayesha Khan',
      bio: 'Singer & event organizer. Bringing mehfil culture back to Lahore. 🎶',
      aboutMe: 'I host live music and poetry sessions across Lahore.',
      city: 'Lahore',
      country: 'Pakistan',
      interests: ['music', 'poetry', 'events'],
      avatarUrl: 'https://i.pravatar.cc/200?img=47',
    },
  });

  const bilal = await prisma.user.create({
    data: {
      ...baseUser,
      email: 'bilal@example.com',
      username: 'bilal',
      displayName: 'Bilal Ahmed',
      role: 'USER',
      bio: 'Startup founder · Karachi. Building things for Pakistan. 🚀',
      city: 'Karachi',
      country: 'Pakistan',
      interests: ['tech', 'startups', 'networking'],
      avatarUrl: 'https://i.pravatar.cc/200?img=12',
    },
  });

  const sana = await prisma.user.create({
    data: {
      ...baseUser,
      email: 'sana@example.com',
      username: 'sana',
      displayName: 'Sana Tariq',
      role: 'MODERATOR',
      bio: 'Community moderator & poetry lover. Islamabad. ✒️',
      city: 'Islamabad',
      country: 'Pakistan',
      interests: ['poetry', 'literature', 'art'],
      avatarUrl: 'https://i.pravatar.cc/200?img=32',
    },
  });

  const hamza = await prisma.user.create({
    data: {
      ...baseUser,
      email: 'hamza@example.com',
      username: 'hamza',
      displayName: 'Hamza Raza',
      bio: 'Musician & sound engineer. Lahore.',
      city: 'Lahore',
      country: 'Pakistan',
      interests: ['music', 'production', 'qawwali'],
      avatarUrl: 'https://i.pravatar.cc/200?img=15',
    },
  });

  // ------------------------------- SKILLS --------------------------------
  await prisma.userSkill.createMany({
    data: [
      { userId: ayesha.id, name: 'Singing', relation: 'OFFER', level: 'Expert' },
      { userId: ayesha.id, name: 'Guitar', relation: 'WANT', level: 'Beginner' },
      { userId: bilal.id, name: 'Web Development', relation: 'OFFER', level: 'Advanced' },
      { userId: bilal.id, name: 'Urdu Poetry', relation: 'WANT', level: 'Beginner' },
      { userId: sana.id, name: 'Urdu Poetry', relation: 'OFFER', level: 'Expert' },
      { userId: sana.id, name: 'Public Speaking', relation: 'OFFER', level: 'Advanced' },
      { userId: hamza.id, name: 'Sound Engineering', relation: 'OFFER', level: 'Advanced' },
      { userId: hamza.id, name: 'Qawwali', relation: 'OFFER', level: 'Expert' },
    ],
  });

  // ------------------------------ FOLLOWS --------------------------------
  await prisma.follow.createMany({
    data: [
      { followerId: bilal.id, followingId: ayesha.id, status: 'ACCEPTED' },
      { followerId: hamza.id, followingId: ayesha.id, status: 'ACCEPTED' },
      { followerId: ayesha.id, followingId: sana.id, status: 'ACCEPTED' },
      { followerId: sana.id, followingId: bilal.id, status: 'ACCEPTED' },
    ],
  });

  // ---------------------------- COMMUNITIES ------------------------------
  const lahoreMusic = await prisma.community.create({
    data: {
      name: 'Lahore Music Society',
      slug: 'lahore-music',
      description: 'A community for Lahore’s musicians, listeners and event organizers. Monthly mehfil nights, jam sessions and workshops.',
      access: 'PUBLIC',
      category: 'Music',
      city: 'Lahore',
      country: 'Pakistan',
      ownerId: ayesha.id,
      avatarUrl: 'https://picsum.photos/seed/lahoremusic/200',
      coverUrl: 'https://picsum.photos/seed/lahoremusiccover/1200/400',
    },
  });

  const pakTech = await prisma.community.create({
    data: {
      name: 'Pakistan Tech Founders',
      slug: 'pak-tech-founders',
      description: 'Founders, operators and investors building Pakistan’s tech ecosystem. Pitch nights, AMA sessions and co-working meetups.',
      access: 'PUBLIC',
      category: 'Technology',
      city: 'Karachi',
      country: 'Pakistan',
      ownerId: bilal.id,
      avatarUrl: 'https://picsum.photos/seed/paktech/200',
      coverUrl: 'https://picsum.photos/seed/paktechcover/1200/400',
    },
  });

  const urduPoetry = await prisma.community.create({
    data: {
      name: 'Urdu Poetry Club',
      slug: 'urdu-poetry',
      description: 'A private circle for sharing and critiquing Urdu poetry, ghazals and nazms. Weekly online readings.',
      access: 'PRIVATE',
      category: 'Poetry',
      city: 'Islamabad',
      country: 'Pakistan',
      ownerId: sana.id,
      avatarUrl: 'https://picsum.photos/seed/urdu-poetry/200',
    },
  });

  // ------------------------- SPACES + MEMBERS ----------------------------
  await prisma.communitySpace.createMany({
    data: [
      { communityId: lahoreMusic.id, name: 'General Discussion', slug: 'general', type: 'DISCUSSION', order: 0 },
      { communityId: lahoreMusic.id, name: 'Announcements', slug: 'announcements', type: 'ANNOUNCEMENTS', order: 1 },
      { communityId: lahoreMusic.id, name: 'Upcoming Events', slug: 'events', type: 'EVENTS', order: 2 },
      { communityId: pakTech.id, name: 'General', slug: 'general', type: 'DISCUSSION', order: 0 },
      { communityId: pakTech.id, name: 'Announcements', slug: 'announcements', type: 'ANNOUNCEMENTS', order: 1 },
      { communityId: urduPoetry.id, name: 'Ghazal Corner', slug: 'ghazal', type: 'DISCUSSION', order: 0 },
    ],
  });

  await prisma.communityMember.createMany({
    data: [
      { communityId: lahoreMusic.id, userId: ayesha.id, role: 'OWNER', status: 'ACTIVE' },
      { communityId: lahoreMusic.id, userId: hamza.id, role: 'MEMBER', status: 'ACTIVE' },
      { communityId: lahoreMusic.id, userId: bilal.id, role: 'MEMBER', status: 'ACTIVE' },
      { communityId: lahoreMusic.id, userId: sana.id, role: 'MODERATOR', status: 'ACTIVE' },
      { communityId: pakTech.id, userId: bilal.id, role: 'OWNER', status: 'ACTIVE' },
      { communityId: pakTech.id, userId: hamza.id, role: 'MEMBER', status: 'ACTIVE' },
      { communityId: urduPoetry.id, userId: sana.id, role: 'OWNER', status: 'ACTIVE' },
      { communityId: urduPoetry.id, userId: ayesha.id, role: 'MEMBER', status: 'ACTIVE' },
    ],
  });

  await prisma.community.update({ where: { id: lahoreMusic.id }, data: { memberCount: 4, postCount: 2 } });
  await prisma.community.update({ where: { id: pakTech.id }, data: { memberCount: 2, postCount: 1 } });
  await prisma.community.update({ where: { id: urduPoetry.id }, data: { memberCount: 2, postCount: 0 } });

  const musicGeneral = await prisma.communitySpace.findFirst({ where: { communityId: lahoreMusic.id, slug: 'general' } });
  const techGeneral = await prisma.communitySpace.findFirst({ where: { communityId: pakTech.id, slug: 'general' } });

  // ------------------------------- POSTS ---------------------------------
  const post1 = await prisma.post.create({
    data: {
      authorId: ayesha.id,
      type: 'TEXT',
      status: 'PUBLISHED',
      content: 'Our first Mehfil night was absolutely incredible! Thank you to everyone who came out and made it special. Next one is going to be even bigger — qawwali edition. Stay tuned! 🎤✨',
      communityId: lahoreMusic.id,
      spaceId: musicGeneral?.id,
      hashtags: ['mehfil', 'music', 'lahore'],
      likeCount: 2,
      commentCount: 1,
    },
  });

  const post2 = await prisma.post.create({
    data: {
      authorId: bilal.id,
      type: 'TEXT',
      status: 'PUBLISHED',
      content: 'Hot take: Pakistan’s startup scene is finally maturing. Fewer copy-paste ideas, more real problem-solving. Proud of what this community is building. What are you working on this quarter?',
      communityId: pakTech.id,
      spaceId: techGeneral?.id,
      hashtags: ['startups', 'pakistan', 'tech'],
      likeCount: 1,
      commentCount: 1,
    },
  });

  // Poll post
  const pollPost = await prisma.post.create({
    data: {
      authorId: ayesha.id,
      type: 'POLL',
      status: 'PUBLISHED',
      content: 'What genre should our next Mehfil night feature?',
      communityId: lahoreMusic.id,
      spaceId: musicGeneral?.id,
      hashtags: ['poll', 'mehfil'],
    },
  });

  const poll = await prisma.poll.create({
    data: {
      postId: pollPost.id,
      question: 'What genre should our next Mehfil night feature?',
      endsAt: daysFromNow(10),
      options: {
        create: [
          { text: 'Qawwali', votes: 3 },
          { text: 'Classical', votes: 1 },
          { text: 'Fusion', votes: 2 },
          { text: 'Pop', votes: 0 },
        ],
      },
    },
  });

  const hamzaPost = await prisma.post.create({
    data: {
      authorId: hamza.id,
      type: 'TEXT',
      status: 'PUBLISHED',
      content: 'Spent the weekend mixing a live qawwali recording. There is nothing like the energy of a real mehfil. 🎚️',
      hashtags: ['music', 'production'],
      likeCount: 1,
    },
  });

  // Comments
  await prisma.comment.create({
    data: { postId: post1.id, authorId: hamza.id, content: 'That night was magical — can’t wait for the qawwali edition!', likeCount: 1 },
  });
  await prisma.comment.create({
    data: { postId: post2.id, authorId: sana.id, content: 'So true. The quality of founders coming up right now is impressive.' },
  });

  // Reactions
  await prisma.reaction.createMany({
    data: [
      { userId: bilal.id, postId: post1.id, type: 'LOVE' },
      { userId: hamza.id, postId: post1.id, type: 'CELEBRATE' },
      { userId: ayesha.id, postId: post2.id, type: 'INSIGHTFUL' },
      { userId: sana.id, postId: hamzaPost.id, type: 'LIKE' },
    ],
  });

  // Bookmark
  await prisma.bookmark.create({ data: { userId: ayesha.id, postId: post2.id } });

  // ------------------------------- EVENTS --------------------------------
  const qawwaliEvent = await prisma.event.create({
    data: {
      slug: 'mehfil-night-qawwali',
      title: 'Mehfil Night: Live Qawwali',
      description: 'An unforgettable evening of traditional qawwali with Lahore’s finest vocalists. Food stalls, seating on the floor and ceiling, and a true mehfil atmosphere.',
      coverUrl: 'https://picsum.photos/seed/qawwali/1200/500',
      type: 'IN_PERSON',
      status: 'PUBLISHED',
      startsAt: daysFromNow(14),
      endsAt: daysFromNow(14, 3),
      timezone: 'Asia/Karachi',
      isOnline: false,
      venueName: 'Alhamra Arts Council',
      venueAddress: 'The Mall, Lahore',
      venueCity: 'Lahore',
      venueCountry: 'Pakistan',
      communityId: lahoreMusic.id,
      organizerId: ayesha.id,
      currency: 'PKR',
      priceMin: 1500,
      refundPolicy: 'Refunds available up to 48 hours before the event.',
      hasWaitlist: true,
      attendeeCount: 2,
      ticketCount: 2,
    },
  });

  const pitchEvent = await prisma.event.create({
    data: {
      slug: 'startup-pitch-night-karachi',
      title: 'Startup Pitch Night Karachi',
      description: 'Ten early-stage startups pitch to a panel of investors. Networking, feedback and prizes for the top three.',
      coverUrl: 'https://picsum.photos/seed/pitch/1200/500',
      type: 'IN_PERSON',
      status: 'PUBLISHED',
      startsAt: daysFromNow(7),
      endsAt: daysFromNow(7, 3),
      timezone: 'Asia/Karachi',
      isOnline: false,
      venueName: 'Nestio Coworking',
      venueAddress: 'Shahrah-e-Faisal, Karachi',
      venueCity: 'Karachi',
      venueCountry: 'Pakistan',
      communityId: pakTech.id,
      organizerId: bilal.id,
      currency: 'PKR',
      priceMin: 500,
      attendeeCount: 0,
      ticketCount: 0,
    },
  });

  const poetryEvent = await prisma.event.create({
    data: {
      slug: 'online-poetry-reading',
      title: 'Online Poetry Reading: Shaam-e-Ghazal',
      description: 'A free online reading session where members share their favourite ghazals and original work. Link shared after RSVP.',
      type: 'ONLINE',
      status: 'PUBLISHED',
      startsAt: daysFromNow(3),
      endsAt: daysFromNow(3, 2),
      timezone: 'Asia/Karachi',
      isOnline: true,
      onlineUrl: 'https://meet.joinmehfil.co/shaam-e-ghazal',
      communityId: urduPoetry.id,
      organizerId: sana.id,
      currency: 'PKR',
      priceMin: 0,
      attendeeCount: 0,
      ticketCount: 0,
    },
  });

  // Ticket tiers
  const qawwaliGeneral = await prisma.ticketTier.create({
    data: { eventId: qawwaliEvent.id, name: 'General', type: 'PAID', price: 1500, currency: 'PKR', quantityTotal: 100, quantitySold: 2, minPerOrder: 1, maxPerOrder: 6, order: 0 },
  });
  await prisma.ticketTier.create({
    data: { eventId: qawwaliEvent.id, name: 'VIP (front seating + dinner)', type: 'VIP', price: 3500, currency: 'PKR', quantityTotal: 20, quantitySold: 0, minPerOrder: 1, maxPerOrder: 4, order: 1 },
  });
  await prisma.ticketTier.createMany({
    data: [
      { eventId: pitchEvent.id, name: 'Early Bird', type: 'EARLY_BIRD', price: 500, currency: 'PKR', quantityTotal: 50, quantitySold: 0, order: 0 },
      { eventId: pitchEvent.id, name: 'Standard', type: 'PAID', price: 1000, currency: 'PKR', quantityTotal: 100, quantitySold: 0, order: 1 },
      { eventId: poetryEvent.id, name: 'Free Admission', type: 'FREE', price: 0, currency: 'PKR', quantityTotal: 200, quantitySold: 0, order: 0 },
    ],
  });

  // Promo code
  await prisma.promoCode.create({
    data: { code: 'MEHFIL10', eventId: qawwaliEvent.id, type: 'PERCENT', value: 10, maxUses: 100, usedCount: 0, active: true, startsAt: now, endsAt: daysFromNow(14) },
  });

  // Order + payment + e-tickets (bilal buys 2 General for qawwali)
  const order = await prisma.order.create({
    data: {
      code: 'ORD-1001',
      eventId: qawwaliEvent.id,
      buyerId: bilal.id,
      status: 'PAID',
      paymentMethod: 'MOCK_CARD',
      paymentStatus: 'APPROVED',
      subtotal: 3000,
      discount: 0,
      platformFee: 150,
      total: 3150,
      currency: 'PKR',
      attendeeInfo: [{ name: 'Bilal Ahmed', email: 'bilal@example.com' }, { name: 'Guest', email: 'guest@example.com' }],
      paidAt: now,
      lines: {
        create: [{ ticketTierId: qawwaliGeneral.id, ticketTierName: 'General', quantity: 2, unitPrice: 1500, total: 3000 }],
      },
      payment: {
        create: { provider: 'mock', method: 'MOCK_CARD', status: 'APPROVED', amount: 3150, currency: 'PKR', providerRef: 'mock_pi_1001', approvedById: admin.id, approvedAt: now },
      },
      tickets: {
        create: [
          { code: 'TKT-QAW-0001', eventId: qawwaliEvent.id, ticketTierId: qawwaliGeneral.id, ticketTierName: 'General', qrPayload: 'TKT-QAW-0001', status: 'VALID', attendeeName: 'Bilal Ahmed', attendeeEmail: 'bilal@example.com' },
          { code: 'TKT-QAW-0002', eventId: qawwaliEvent.id, ticketTierId: qawwaliGeneral.id, ticketTierName: 'General', qrPayload: 'TKT-QAW-0002', status: 'VALID', attendeeName: 'Guest', attendeeEmail: 'guest@example.com' },
        ],
      },
    },
  });

  // RSVPs
  await prisma.eventRsvp.createMany({
    data: [
      { eventId: qawwaliEvent.id, userId: bilal.id, status: 'GOING' },
      { eventId: qawwaliEvent.id, userId: hamza.id, status: 'GOING' },
      { eventId: qawwaliEvent.id, userId: sana.id, status: 'INTERESTED' },
    ],
  });

  // ----------------------------- MESSAGING -------------------------------
  const convo = await prisma.conversation.create({
    data: {
      type: 'DIRECT',
      lastMessageAt: now,
      participants: {
        create: [
          { userId: ayesha.id, lastReadAt: now },
          { userId: bilal.id },
        ],
      },
      messages: {
        create: [
          { senderId: bilal.id, type: 'TEXT', body: 'Salam Ayesha! Just grabbed two tickets for the qawwali night 🎟️', readBy: [ayesha.id] },
          { senderId: ayesha.id, type: 'TEXT', body: 'Walaikum salam Bilal! So excited to have you. VIP front rows still open if you want to upgrade 😊', readBy: [bilal.id] },
        ],
      },
    },
  });

  // --------------------------- NOTIFICATIONS -----------------------------
  await prisma.notification.createMany({
    data: [
      { userId: bilal.id, type: 'TICKET_PURCHASED', title: 'Tickets confirmed', body: 'Your 2 tickets for Mehfil Night: Live Qawwali are ready in your wallet.', targetId: order.id, targetType: 'order', read: true },
      { userId: ayesha.id, type: 'EVENT_REMINDER', title: 'Your event is coming up', body: 'Mehfil Night: Live Qawwali starts in 14 days. Share it with your community!', targetId: qawwaliEvent.id, targetType: 'event' },
      { userId: ayesha.id, type: 'POST_LIKE', title: 'Bilal reacted to your post', body: 'Bilal Ahmed loved your post in Lahore Music Society.', actorId: bilal.id, targetId: post1.id, targetType: 'post' },
      { userId: hamza.id, type: 'NEW_FOLLOWER', title: 'New follower', body: 'Ayesha Khan started following you.', actorId: ayesha.id },
    ],
  });

  // ------------------------------ MODERATION -----------------------------
  await prisma.report.create({
    data: {
      reporterId: hamza.id,
      targetType: 'POST',
      targetId: post2.id,
      reason: 'SPAM',
      details: 'Possible self-promotion / spam — flagging for review.',
      status: 'OPEN',
    },
  });

  // Summary
  const [users, communities, events, posts, tickets] = await Promise.all([
    prisma.user.count(),
    prisma.community.count(),
    prisma.event.count(),
    prisma.post.count(),
    prisma.eTicket.count(),
  ]);
  console.log('✅ Seed complete:');
  console.log(`   users=${users} communities=${communities} events=${events} posts=${posts} tickets=${tickets}`);
  console.log(`   conversation=${convo.id.slice(0, 8)}…`);
  console.log('   Login (any account): password = Password123!');
  console.log('   Admin: admin@joinmehfil.co · User: ayesha@example.com / bilal@example.com');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
