import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import Settings from './Settings';

// Mocking wouter's useLocation hook as it's a dependency in the component tree
vi.mock('wouter', () => ({
  useLocation: () => ['/settings', vi.fn()],
}));

describe('Settings Page', () => {
  it('renders the main heading', () => {
    // Render the component
    render(<Settings />);

    // Find the heading element
    const heading = screen.getByRole('heading', {
      name: /app settings/i,
      level: 1, // Corresponds to an <h1> tag
    });

    // Assert that the heading is in the document
    expect(heading).toBeInTheDocument();
  });

  it('renders the placeholder cards', () => {
    render(<Settings />);

    expect(screen.getByText(/general settings/i)).toBeInTheDocument();
    expect(screen.getByText(/user management/i)).toBeInTheDocument();
    expect(screen.getByText(/billing & plans/i)).toBeInTheDocument();
  });
});
