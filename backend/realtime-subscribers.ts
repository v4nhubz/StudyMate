import { db, ws, json, error } from '@appdeploy/sdk';

const SUBSCRIPTIONS_TABLE = 'entity_subscriptions';

type SubscriptionRecord = {
  id: string;
  entity_type: string;
  entity_id: string;
  connection_id: string;
  player_id?: string;
  created_at: number;
};

type QuizPlayerRecord = { id: string; name: string; score: number; answers: Record<string, number> };
type QuizQuestionRecord = { prompt: string; choices: string[]; correctIndex: number };
type QuizRoomRecord = {
  id: string;
  roomCode: string;
  hostId: string;
  hostToken: string;
  status: 'waiting' | 'playing' | 'finished';
  currentQuestionIndex: number;
  players: QuizPlayerRecord[];
  questions: QuizQuestionRecord[];
  createdAt: number;
};

async function listSubscriptions(): Promise<SubscriptionRecord[]> {
  const { items } = await db.list<SubscriptionRecord>(SUBSCRIPTIONS_TABLE, { limit: 1000 });
  return items;
}

function publicQuizRoom(room: QuizRoomRecord) {
  return {
    roomCode: room.roomCode,
    hostId: room.hostId,
    status: room.status,
    currentQuestionIndex: room.currentQuestionIndex,
    players: room.players.map(player => ({
      id: player.id,
      name: player.name,
      score: player.score,
      answeredCurrent: player.answers[String(room.currentQuestionIndex)] !== undefined,
      isHost: player.id === room.hostId,
    })),
    questions: room.questions.map(question => ({
      prompt: question.prompt,
      choices: question.choices,
      ...(room.status === 'finished' ? { correctIndex: question.correctIndex } : {}),
    })),
  };
}

async function removePlayerFromRoom(roomCode: string, playerId: string) {
  if (!/^\d{6}$/.test(roomCode) || !playerId) return;
  const table = 'quiz_room_' + roomCode;
  const { items } = await db.list<QuizRoomRecord>(table, { limit: 1 });
  const room = items[0];
  if (!room || !room.players.some(player => player.id === playerId)) return;

  room.players = room.players.filter(player => player.id !== playerId);
  if (room.hostId === playerId) {
    if (room.players.length) {
      room.hostId = room.players[0].id;
      room.hostToken = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
    } else {
      room.status = 'finished';
    }
  }
  const { id, ...record } = room;
  const [saved] = await db.update(table, [{ id, record }]);
  if (saved) {
    const fresh = await db.list<QuizRoomRecord>(table, { limit: 1 });
    if (fresh.items[0]) {
      await notifySubscribers('quiz_room', roomCode, publicQuizRoom(fresh.items[0]));
    }
  }
}

async function cleanupSubscriptions(items: SubscriptionRecord[]) {
  for (const item of items) {
    if (item.entity_type === 'quiz_room' && item.player_id) {
      await removePlayerFromRoom(item.entity_id, item.player_id);
    }
  }
  const ids = items.map(item => item.id);
  if (ids.length) await db.delete(SUBSCRIPTIONS_TABLE, ids);
}

export async function removeSubscriptionsByConnection(connectionId: string) {
  const items = (await listSubscriptions()).filter(item => item.connection_id === connectionId);
  await cleanupSubscriptions(items);
}

async function addSubscription(entityType: string, entityId: string, connectionId: string, playerId?: string) {
  const existing = (await listSubscriptions()).find(item =>
    item.entity_type === entityType &&
    item.entity_id === entityId &&
    item.connection_id === connectionId
  );
  if (existing) {
    if (playerId && existing.player_id !== playerId) {
      await db.update(SUBSCRIPTIONS_TABLE, [{
        id: existing.id,
        record: { entity_type: entityType, entity_id: entityId, connection_id: connectionId, player_id: playerId, created_at: existing.created_at },
      }]);
    }
    return;
  }
  await db.add(SUBSCRIPTIONS_TABLE, [{
    entity_type: entityType,
    entity_id: entityId,
    connection_id: connectionId,
    ...(playerId ? { player_id: playerId } : {}),
    created_at: Date.now(),
  }]);
}

async function removeSubscription(entityType: string, entityId: string, connectionId: string) {
  const items = (await listSubscriptions()).filter(item =>
    item.entity_type === entityType &&
    item.entity_id === entityId &&
    item.connection_id === connectionId
  );
  await cleanupSubscriptions(items);
}

export async function notifySubscribers(entityType: string, entityId: string, payload: unknown, excludeConnectionId?: string) {
  const items = await listSubscriptions();
  const targets = Array.from(new Set(items
    .filter(item => item.entity_type === entityType && item.entity_id === entityId && item.connection_id !== excludeConnectionId)
    .map(item => item.connection_id)));
  if (targets.length) {
    await ws.send(targets, { v: 1, type: 'entity.update', payload: { entity_type: entityType, entity_id: entityId, data: payload } });
  }
}

export const realtimeSubscriptionRoutes = {
  'POST /api/subscriptions': [async ({ body }: { body: unknown }) => {
    const value = body as { entity_type?: string; entity_id?: string; connection_id?: string; player_id?: string } | null;
    if (!value?.entity_type || !value.entity_id || !value.connection_id) {
      return error('entity_type, entity_id, and connection_id are required.', 400);
    }
    await addSubscription(value.entity_type, value.entity_id, value.connection_id, value.player_id);
    return json({ ok: true });
  }],
  'POST /api/subscriptions/remove': [async ({ body }: { body: unknown }) => {
    const value = body as { entity_type?: string; entity_id?: string; connection_id?: string } | null;
    if (!value?.entity_type || !value.entity_id || !value.connection_id) {
      return error('entity_type, entity_id, and connection_id are required.', 400);
    }
    await removeSubscription(value.entity_type, value.entity_id, value.connection_id);
    return json({ ok: true });
  }],
};