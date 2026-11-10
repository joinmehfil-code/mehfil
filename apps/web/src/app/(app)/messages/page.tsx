'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Conversation, Message } from '@mehfil/shared';
import { SOCKET_EVENTS } from '@mehfil/shared';
import { useI18n } from '@/i18n/provider';
import { useAuth } from '@/lib/auth';
import { messagesApi, usersApi } from '@/lib/services';
import { getSocket } from '@/lib/socket';
import { cn, timeAgo } from '@/lib/cn';
import { Avatar, Button, EmptyState, Input, Spinner } from '@/components/ui';

function conversationName(conv: Conversation, myId?: string): string {
  if (conv.title) return conv.title;
  const other = conv.participants.find((p) => p.user.id !== myId)?.user;
  return other?.displayName ?? conv.type;
}
function conversationAvatar(conv: Conversation, myId?: string): string | null {
  if (conv.type === 'GROUP') return null;
  return conv.participants.find((p) => p.user.id !== myId)?.user.avatarUrl ?? null;
}

export default function MessagesPage() {
  const { t, locale } = useI18n();
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingThread, setLoadingThread] = useState(false);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQ, setSearchQ] = useState('');
  const [results, setResults] = useState<{ id: string; displayName: string; avatarUrl: string | null; username: string }[]>([]);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    setLoadingList(true);
    messagesApi
      .conversations(1, 30)
      .then((res) => !cancelled && setConversations(res.items))
      .catch(() => undefined)
      .finally(() => !cancelled && setLoadingList(false));
    return () => {
      cancelled = true;
    };
  }, []);

  const openConversation = useCallback(async (id: string) => {
    setActiveId(id);
    setLoadingThread(true);
    try {
      const res = await messagesApi.messages(id, 1, 100);
      setMessages(res.items.slice().reverse());
      await messagesApi.markRead(id).catch(() => undefined);
    } catch {
      setMessages([]);
    } finally {
      setLoadingThread(false);
    }
  }, []);

  // Realtime: incoming messages
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    function onNew(payload: { conversationId: string; message: Message }) {
      setConversations((list) => {
        const idx = list.findIndex((c) => c.id === payload.conversationId);
        if (idx === -1) {
          void messagesApi.conversations(1, 30).then((r) => setConversations(r.items));
          return list;
        }
        const next = [...list];
        next[idx] = { ...next[idx], lastMessage: payload.message };
        return next;
      });
      setMessages((prev) =>
        payload.conversationId === activeId && !prev.some((m) => m.id === payload.message.id)
          ? [...prev, payload.message]
          : prev,
      );
    }
    socket.on(SOCKET_EVENTS.MESSAGE_NEW, onNew);
    return () => {
      socket.off(SOCKET_EVENTS.MESSAGE_NEW, onNew);
    };
  }, [activeId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function send() {
    const body = draft.trim();
    if (!body || !activeId) return;
    setSending(true);
    try {
      const msg = await messagesApi.send(activeId, body);
      setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
      setDraft('');
    } finally {
      setSending(false);
    }
  }

  async function runSearch() {
    const term = searchQ.trim();
    if (!term) return;
    const res = await usersApi.search({ q: term, limit: 10 });
    setResults(res.items);
  }

  async function startDirect(recipientId: string) {
    const conv = await messagesApi.start({ type: 'DIRECT', recipientId });
    setConversations((list) => (list.some((c) => c.id === conv.id) ? list : [conv, ...list]));
    setSearchOpen(false);
    setSearchQ('');
    setResults([]);
    await openConversation(conv.id);
  }

  const active = conversations.find((c) => c.id === activeId) ?? null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="gradient-text text-xl font-extrabold tracking-tight">{t.messages.title}</h1>
        <Button size="sm" variant="secondary" onClick={() => setSearchOpen((s) => !s)}>
          {t.messages.newMessage}
        </Button>
      </div>

      {searchOpen && (
        <div className="card space-y-3">
          <div className="flex gap-2">
            <Input
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && runSearch()}
              placeholder={t.common.search}
            />
            <Button onClick={runSearch}>{t.common.search}</Button>
          </div>
          {results.map((r) => (
            <button
              key={r.id}
              onClick={() => startDirect(r.id)}
              className="flex w-full items-center gap-3 rounded-lg p-2 text-start hover:bg-surface-muted"
            >
              <Avatar src={r.avatarUrl} alt={r.displayName} size={36} />
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold">{r.displayName}</div>
                <div className="truncate text-xs text-content-muted">@{r.username}</div>
              </div>
            </button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-[280px_1fr]">
        {/* Conversation list */}
        <div className="card max-h-[70vh] overflow-y-auto !p-2">
          {loadingList ? (
            <div className="grid place-items-center py-8">
              <Spinner className="h-6 w-6 text-brand-600" />
            </div>
          ) : conversations.length === 0 ? (
            <EmptyState title={t.messages.noConversations} />
          ) : (
            <ul className="space-y-1">
              {conversations.map((c) => (
                <li key={c.id}>
                  <button
                    onClick={() => openConversation(c.id)}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-lg p-2 text-start',
                      activeId === c.id ? 'bg-brand-50' : 'hover:bg-surface-muted',
                    )}
                  >
                    <Avatar src={conversationAvatar(c, user?.id)} alt={conversationName(c, user?.id)} size={40} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold">{conversationName(c, user?.id)}</div>
                      <div className="truncate text-xs text-content-muted">
                        {c.lastMessage?.body ?? '—'}
                      </div>
                    </div>
                    {c.unreadCount > 0 && (
                      <span className="grid h-5 min-w-5 place-items-center rounded-full bg-brand-600 px-1 text-[11px] font-bold text-white">
                        {c.unreadCount}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Thread */}
        <div className="card flex max-h-[70vh] flex-col !p-0">
          {!active ? (
            <EmptyState title={t.messages.noConversations} />
          ) : (
            <>
              <div className="flex items-center gap-3 border-b border-surface-border p-3">
                <Avatar src={conversationAvatar(active, user?.id)} alt={conversationName(active, user?.id)} size={40} />
                <div className="font-semibold">{conversationName(active, user?.id)}</div>
              </div>

              <div className="flex-1 space-y-2 overflow-y-auto p-3">
                {loadingThread ? (
                  <div className="grid place-items-center py-8">
                    <Spinner className="h-6 w-6 text-brand-600" />
                  </div>
                ) : (
                  messages.map((m) => {
                    const mine = m.senderId === user?.id;
                    return (
                      <div key={m.id} className={cn('flex', mine ? 'justify-end' : 'justify-start')}>
                        <div
                          className={cn(
                            'max-w-[75%] rounded-2xl px-3 py-2 text-sm',
                            mine ? 'bg-brand-600 text-white' : 'bg-surface-muted',
                          )}
                        >
                          {m.deletedAt ? (
                            <span className="italic opacity-70">message deleted</span>
                          ) : (
                            m.body
                          )}
                          <div className={cn('mt-1 text-[10px]', mine ? 'text-white/70' : 'text-content-muted')}>
                            {timeAgo(m.createdAt, locale)}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={endRef} />
              </div>

              <div className="flex items-center gap-2 border-t border-surface-border p-3">
                <Input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && send()}
                  placeholder={t.messages.typeMessage}
                  className="flex-1"
                />
                <Button onClick={send} loading={sending} disabled={!draft.trim()}>
                  {t.messages.send}
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
