"use client";

/**
 * Things this session has successfully rendered.
 *
 * Visibility is changeable at any time, so an auction can go private while
 * somebody is reading it, and a link already sitting in a WhatsApp thread stops
 * working. The API cannot tell "private now" from "never existed" without
 * confirming that private things exist — that 404 is deliberate and correct.
 *
 * The client can tell, though, because it had the thing a moment ago. That is
 * the whole job of this set: a 404 on something previously rendered says "no
 * longer available", a 404 on first load says not found. It is the difference
 * between "the app is broken" and "the sale closed to the public".
 */
const seen = new Set<string>();

export function noteSeen(id: string): void {
  seen.add(id);
}

export function wasSeen(id: string): boolean {
  return seen.has(id);
}
