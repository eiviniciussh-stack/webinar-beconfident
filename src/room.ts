// Which webinar room the participant is in ("principal" = the always-on room).
let currentRoomId = 'principal';

export const getRoomId = () => currentRoomId;
export const setRoomId = (id: string) => {
  currentRoomId = id || 'principal';
};

/** Slug from a /w/<slug> URL, or null for the main room. */
export function roomSlugFromLocation(): string | null {
  if (typeof window === 'undefined') return null;
  const m = window.location.pathname.match(/^\/w\/([A-Za-z0-9_-]+)\/?$/);
  return m ? m[1].toLowerCase() : null;
}
