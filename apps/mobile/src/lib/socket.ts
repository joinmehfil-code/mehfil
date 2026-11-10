/**
 * Shared authenticated Socket.IO connection for mobile.
 * Mirrors the web client: lazily connects using the cached access token and
 * tears down when the token changes (login/logout).
 */
import { useEffect, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { tokenStore } from './storage';

const SOCKET_URL =
  process.env.EXPO_PUBLIC_SOCKET_URL || 'http://localhost:4000/rt';

let socket: Socket | null = null;
let socketToken: string | null = null;

/** Get (or lazily create) the shared authenticated socket connection. */
export function getSocket(): Socket | null {
  const token = tokenStore.access;
  if (!token) return null;

  if (socket?.connected && socketToken === token) return socket;
  if (socket && socketToken !== token) {
    socket.disconnect();
    socket = null;
    socketToken = null;
  }
  if (!socket) {
    socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
    });
    socketToken = token;
  }
  return socket;
}

/** Disconnect + clear the shared socket (on logout). */
export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
    socketToken = null;
  }
}

/**
 * React hook: connects when `enabled` is true and exposes the socket instance.
 */
export function useSocket(enabled = true): Socket | null {
  const [instance, setInstance] = useState<Socket | null>(null);

  useEffect(() => {
    if (!enabled) return;
    setInstance(getSocket());
  }, [enabled]);

  return instance;
}

export { SOCKET_URL };
