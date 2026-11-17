import type {
  AccuseRequest,
  AccuseResponse,
  CaseResponse,
  ErrorResponse,
} from '../../shared/api';

function isError(value: unknown): value is ErrorResponse {
  return (
    typeof value === 'object' &&
    value !== null &&
    Reflect.get(value, 'type') === 'error'
  );
}

export async function fetchCase(): Promise<CaseResponse> {
  const res = await fetch('/api/case');
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
