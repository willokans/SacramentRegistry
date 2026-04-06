import { NextResponse } from 'next/server';
import { backendErrorPayloadFromText } from '@/lib/backendErrorPayloadFromText';

export { backendErrorPayloadFromText } from '@/lib/backendErrorPayloadFromText';

export function nextJsonFromBackendErrorBody(
  text: string,
  fallbackMessage: string,
  status: number,
): NextResponse {
  return NextResponse.json(backendErrorPayloadFromText(text, fallbackMessage), { status });
}
