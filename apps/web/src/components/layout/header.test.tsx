import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@/__tests__/test-utils';
import { Header } from './header';

describe('Header', () => {
  const mockUser = { email: 'test@example.com' } as Parameters<typeof Header>[0]['user'];
  const mockOnImportClick = vi.fn();
  const mockOnSignOut = vi.fn();

  it('import button receives focus on tab', async () => {
    const user = userEvent.setup();
    render(<Header user={mockUser} onImportClick={mockOnImportClick} onSignOut={mockOnSignOut} />);

    const importButton = screen.getByRole('button', { name: /import/i });

    await user.tab();

    expect(document.activeElement).toBe(importButton);
  });
});
