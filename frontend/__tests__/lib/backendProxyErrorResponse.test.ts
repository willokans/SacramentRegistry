import { backendErrorPayloadFromText } from '@/lib/backendErrorPayloadFromText';

describe('backendErrorPayloadFromText', () => {
  it('forwards Spring-style JSON so message is not stringified', () => {
    const body =
      '{"status":400,"error":"Bad Request","message":"No account found with that email or username."}';
    expect(backendErrorPayloadFromText(body, 'fallback')).toEqual({
      status: 400,
      error: 'Bad Request',
      message: 'No account found with that email or username.',
    });
  });

  it('uses fallback when body is empty', () => {
    expect(backendErrorPayloadFromText('  ', 'Nothing')).toEqual({ message: 'Nothing' });
  });

  it('wraps plain text bodies as message', () => {
    expect(backendErrorPayloadFromText('Gateway timeout', 'fallback')).toEqual({
      message: 'Gateway timeout',
    });
  });
});
