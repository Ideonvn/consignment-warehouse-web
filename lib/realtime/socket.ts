import { createWsTicket } from "@/lib/api/endpoints";
import { serverMessageSchema } from "@/lib/api/schemas";
import { useRealtimeStore } from "@/lib/realtime/store";
import type { ClientMessage, ServerMessage } from "@/types/api";

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:8000/api/v1/ws";

/** A reused or expired ticket is refused with this code before the accept. */
const TICKET_REJECTED = 4401;
/** The server pings every 30s and drops idle connections at 120s. */
const IDLE_TIMEOUT_MS = 120_000;
const MAX_BACKOFF_MS = 30_000;
const MAX_LOTS = 200;

type Listener = (message: ServerMessage) => void;

/**
 * One socket for the whole app.
 *
 * Components declare which lots they care about; this keeps the subscription
 * set, reconnects with a per-lot `after_sequences` map so nothing is missed, and
 * hands parsed messages to a single listener that writes them into the cache.
 */
class RealtimeClient {
  private socket: WebSocket | null = null;
  private listener: Listener | null = null;
  /** Reference counted: two screens can want the same lot. */
  private wanted = new Map<string, number>();
  private confirmed = new Set<string>();
  private attempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private idleTimer: ReturnType<typeof setTimeout> | null = null;
  private enabled = false;
  private connecting = false;
  /** The lot ids of the most recent subscribe, for recovering a rejected resume. */
  private lastBatch: string[] = [];
  private onResumeRejected: ((lotIds: string[]) => void) | null = null;

  setListener(listener: Listener | null): void {
    this.listener = listener;
  }

  /** Called with the lots whose replay was refused and must be refetched. */
  setResumeRejectedHandler(handler: ((lotIds: string[]) => void) | null): void {
    this.onResumeRejected = handler;
  }

  start(): void {
    this.enabled = true;
    void this.open();
  }

  stop(): void {
    this.enabled = false;
    this.clearTimers();
    this.confirmed.clear();
    this.attempt = 0;
    const socket = this.socket;
    this.socket = null;
    socket?.close(1000, "client stop");
    useRealtimeStore.getState().setStatus("idle");
  }

  retain(lotIds: string[]): void {
    const added: string[] = [];
    for (const lotId of lotIds) {
      const count = this.wanted.get(lotId) ?? 0;
      this.wanted.set(lotId, count + 1);
      if (count === 0) added.push(lotId);
    }
    if (added.length > 0) this.sendSubscribe(added);
  }

  release(lotIds: string[]): void {
    const removed: string[] = [];
    for (const lotId of lotIds) {
      const count = this.wanted.get(lotId) ?? 0;
      if (count <= 1) {
        this.wanted.delete(lotId);
        if (this.confirmed.delete(lotId)) removed.push(lotId);
      } else {
        this.wanted.set(lotId, count - 1);
      }
    }
    if (removed.length > 0) this.send({ action: "unsubscribe", lot_ids: removed });
  }

  /** Ask the server to replay everything after our last known sequence. */
  resync(lotId: string): void {
    const after = useRealtimeStore.getState().lastSequence[lotId] ?? 0;
    this.send({ action: "resync", lot_id: lotId, after_sequence: after });
  }

  private send(message: ClientMessage): boolean {
    if (this.socket?.readyState !== WebSocket.OPEN) return false;
    this.socket.send(JSON.stringify(message));
    return true;
  }

  private sendSubscribe(lotIds: string[]): void {
    const room = MAX_LOTS - this.confirmed.size;
    const batch = lotIds.slice(0, Math.max(0, room));
    if (batch.length === 0) return;

    const { lastSequence } = useRealtimeStore.getState();
    // Sequences are per lot, so each lot resumes from its own position. The
    // scalar `after_sequence` could only ever be one compromise for the batch.
    const afterSequences: Record<string, number> = {};
    for (const lotId of batch) {
      const sequence = lastSequence[lotId] ?? 0;
      if (sequence > 0) afterSequences[lotId] = sequence;
    }

    this.lastBatch = batch;
    this.send({
      action: "subscribe",
      lot_ids: batch,
      ...(Object.keys(afterSequences).length > 0 ? { after_sequences: afterSequences } : {}),
    });
  }

  /**
   * The server rejected our resume map, so the replay we asked for never
   * happened. Resubscribe plainly and tell the app to refill those lots over
   * REST — rendering the gap silently would lose bids.
   */
  private handleRejectedResume(detail: string | null | undefined): void {
    const batch = this.lastBatch;
    console.error("Realtime rejected after_sequences", { detail, lotIds: batch });
    if (batch.length === 0) return;

    this.send({ action: "subscribe", lot_ids: batch });
    this.onResumeRejected?.(batch);
  }

  private async open(): Promise<void> {
    if (!this.enabled || this.connecting) return;
    if (this.socket && this.socket.readyState <= WebSocket.OPEN) return;

    this.connecting = true;
    const store = useRealtimeStore.getState();
    store.setStatus(this.attempt === 0 ? "connecting" : "reconnecting");

    let ticket: string;
    try {
      // Tickets are single-use and live 30s, so one is minted per attempt.
      ticket = (await createWsTicket()).ticket;
    } catch {
      this.connecting = false;
      this.scheduleReconnect();
      return;
    }

    if (!this.enabled) {
      this.connecting = false;
      return;
    }

    const socket = new WebSocket(`${WS_URL}?ticket=${encodeURIComponent(ticket)}`);
    this.socket = socket;
    this.connecting = false;

    socket.onopen = () => {
      this.attempt = 0;
      useRealtimeStore.getState().setStatus("live");
      this.confirmed.clear();
      this.armIdleTimer();
      const lotIds = [...this.wanted.keys()];
      if (lotIds.length > 0) this.sendSubscribe(lotIds);
    };

    socket.onmessage = (event) => {
      this.armIdleTimer();
      this.handleFrame(event.data);
    };

    socket.onerror = () => {
      // `onclose` always follows; the reconnect is handled there.
    };

    socket.onclose = (event) => {
      if (this.socket === socket) this.socket = null;
      this.confirmed.clear();
      this.clearTimers();
      if (!this.enabled || event.code === 1000) return;
      // A rejected ticket is routine on reconnect: mint another and retry.
      if (event.code === TICKET_REJECTED) this.attempt = Math.min(this.attempt, 2);
      this.scheduleReconnect();
    };
  }

  private handleFrame(raw: unknown): void {
    if (typeof raw !== "string") return;

    let payload: unknown;
    try {
      payload = JSON.parse(raw);
    } catch {
      return;
    }

    const parsed = serverMessageSchema.safeParse(payload);
    // An unknown message type is a server we're older than, not an error.
    if (!parsed.success) return;

    const message = parsed.data;

    if (message.type === "ping") {
      this.send({ action: "ping" });
      return;
    }
    if (message.type === "pong") return;

    if (message.type === "error" && message.code === "bad_after_sequences") {
      this.handleRejectedResume(message.detail);
      return;
    }

    if (message.type === "subscribed") {
      for (const lotId of message.lot_ids) this.confirmed.add(lotId);
    } else if (message.type === "unsubscribed") {
      for (const lotId of message.lot_ids) this.confirmed.delete(lotId);
    }

    this.listener?.(message);
  }

  private armIdleTimer(): void {
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.idleTimer = setTimeout(() => {
      // Silence past the server's own idle timeout means the link is dead even
      // if the socket still claims to be open.
      this.socket?.close(4000, "idle");
      this.socket = null;
      this.scheduleReconnect();
    }, IDLE_TIMEOUT_MS);
  }

  private scheduleReconnect(): void {
    if (!this.enabled || this.reconnectTimer) return;

    const store = useRealtimeStore.getState();
    store.setStatus(this.attempt < 3 ? "reconnecting" : "offline");

    const base = Math.min(MAX_BACKOFF_MS, 500 * 2 ** this.attempt);
    // Jitter keeps a restarted server from being hit by every client at once.
    const delay = base * (0.5 + Math.random() * 0.5);
    this.attempt += 1;

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      void this.open();
    }, delay);
  }

  private clearTimers(): void {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }
}

export const realtime = new RealtimeClient();

export function disconnectRealtime(): void {
  realtime.stop();
  useRealtimeStore.getState().reset();
}
