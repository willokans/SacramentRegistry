import React from 'react';
import { render, type RenderOptions } from '@testing-library/react';
import { SWRConfig } from 'swr';

/**
 * Default useParish mock value. Include all fields required by AuthenticatedLayout.
 * Tests can spread and override: { ...defaultParishContext, parishes: [] }
 */
export const defaultParishContext = {
  parishId: 10,
  setParishId: jest.fn(),
  dioceseId: null as number | null,
  setDioceseId: jest.fn(),
  sidebarCountryKey: null as string | null,
  setSidebarCountryKey: jest.fn(),
  parishes: [{ id: 10, parishName: 'St Mary', dioceseId: 1 }],
  dioceses: [] as { id: number; dioceseName: string; parishes?: unknown[] }[],
  loading: false,
  error: null,
  refetch: jest.fn(),
};

/**
 * Wraps components in SWRConfig with a fresh cache per render.
 * Use this for pages that use useBaptisms, useCommunions, etc. to avoid
 * SWR cache persisting between tests.
 */
function AllTheProviders({ children }: { children: React.ReactNode }) {
  return (
    <SWRConfig value={{ provider: () => new Map() }}>
      {children}
    </SWRConfig>
  );
}

function renderWithSWR(
  ui: React.ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) {
  return render(ui, {
    wrapper: AllTheProviders,
    ...options,
  });
}

export { renderWithSWR };
