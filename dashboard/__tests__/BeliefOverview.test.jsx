/**
 * @jest-environment jsdom
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import BeliefOverview from '../src/components/BeliefOverview.jsx';

describe('BeliefOverview dashboard truth check', () => {
  it('renders belief metrics and matches snapshot', () => {
    const session = {
      wallet: '0x1234567890abcdef1234567890abcdef12345678',
      ens: 'aligned.eth',
      tier: 'Blaze',
      multiplier: 1.2456,
      lastSync: new Date('2024-01-01T00:00:00Z').toISOString(),
    };
    const summary = {
      beliefScore: 1.4321,
      totalPartners: 8,
      healthyPartners: 7,
      tier: 'Ascendant',
    };

    const { container } = render(<BeliefOverview session={session} summary={summary} />);

    expect(screen.getByText('Vaultfire Dashboard v1')).toBeInTheDocument();
    expect(screen.getByText('Blaze')).toBeInTheDocument();
    expect(screen.getByText('1.2456')).toBeInTheDocument();

    expect(container).toMatchSnapshot();
  });
});
