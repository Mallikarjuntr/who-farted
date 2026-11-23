import type {
  AccuseRequest,
  AccuseResponse,
  AvatarResponse,
  CaseResponse,
  CommentResponse,
  ErrorResponse,
  JoinResponse,
  ResetResponse,
} from '../../shared/api';

function isError(value: unknown): value is ErrorResponse {
  return (
    typeof value === 'object' &&
    value !== null &&
    Reflect.get(value, 'type') === 'error'
  );
}

/** `date` is only honoured by the server in the private test subreddit. */
export async function fetchCase(date?: string | null): Promise<CaseResponse> {
  const res = await fetch(
    date ? `/api/case?date=${encodeURIComponent(date)}` : '/api/case'
  );
  const data: CaseResponse | ErrorResponse = await res.json();
  if (!res.ok || isError(data)) {
    throw new Error(isError(data) ? data.message : `HTTP ${res.status}`);
  }
  return data;
}

export async function postAccuse(body: AccuseRequest): Promise<AccuseResponse> {
  const res = await fetch('/api/accuse', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data: AccuseResponse | ErrorResponse = await res.json();
  if (!res.ok || isError(data)) {
    throw new Error(isError(data) ? data.message : `HTTP ${res.status}`);
  }
  return data;
}

/** Test mode only: forget my accusation for this day so I can replay it. */
export async function resetPlay(date: string): Promise<ResetResponse> {
  const res = await fetch('/api/test/reset', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ date }),
  });
  const data: ResetResponse | ErrorResponse = await res.json();
  if (!res.ok || isError(data)) {
    throw new Error(isError(data) ? data.message : `HTTP ${res.status}`);
  }
  return data;
}

/** Posts the spoiler-free verdict as a comment. Only called from the explicit button. */
export async function postComment(date: string): Promise<CommentResponse> {
  const res = await fetch('/api/comment', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ date }),
  });
  const data: CommentResponse | ErrorResponse = await res.json();
  if (!res.ok || isError(data)) {
    throw new Error(isError(data) ? data.message : `HTTP ${res.status}`);
  }
  return data;
}

/** Joins the subreddit. Only called from the explicit button. */
export async function postJoin(): Promise<JoinResponse> {
  const res = await fetch('/api/join', { method: 'POST' });
  const data: JoinResponse | ErrorResponse = await res.json();
  if (!res.ok || isError(data)) {
    throw new Error(isError(data) ? data.message : `HTTP ${res.status}`);
  }
  return data;
}

/** The player's snoovatar, or null. Never throws: the card works without it. */
export async function fetchAvatar(): Promise<AvatarResponse | null> {
  try {
    const res = await fetch('/api/avatar');
    const data: AvatarResponse | ErrorResponse = await res.json();
    return res.ok && !isError(data) ? data : null;
  } catch {
    return null;
  }
}
