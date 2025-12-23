import { describe, expect, it, vi } from 'vitest';
import { render } from '@/__tests__/test-utils';
import { getTailwindColor } from '@/__tests__/utils';
import { Header } from './header';

/**
 * Browser-only tests for Header component
 *
 * These tests require a real browser because they test actual computed CSS values.
 * jsdom cannot compute real CSS - it returns empty strings for computed styles.
 */
describe('Header (browser)', () => {
  const mockUser = { email: 'test@example.com' } as Parameters<typeof Header>[0]['user'];
  const mockOnImportClick = vi.fn();
  const mockOnSignOut = vi.fn();

  it('header background matches --color-slate-800', () => {
    render(<Header user={mockUser} onImportClick={mockOnImportClick} onSignOut={mockOnSignOut} />);

    const header = document.querySelector('header');
    const headerBg = getComputedStyle(header!).backgroundColor;

    expect(headerBg).toBe(getTailwindColor('--color-slate-800'));
  });
});
