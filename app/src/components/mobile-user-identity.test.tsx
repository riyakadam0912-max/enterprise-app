import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import { UserIdentity } from '@/src/components/UserIdentity';
import { filesByEntity } from '@/src/api/files';

jest.mock('@/src/api/files', () => ({
  filesByEntity: jest.fn(),
}));

describe('UserIdentity', () => {
  beforeEach(() => {
    (filesByEntity as jest.Mock).mockResolvedValue([]);
  });

  it('renders initials and contact details for a user with a profile avatar slot', async () => {
    const { getByText } = await render(<UserIdentity userId={7} name="John Doe" subtitle="john@company.com" size="md" />);

    expect(getByText('JD')).toBeTruthy();
    expect(getByText('John Doe')).toBeTruthy();
    expect(getByText('john@company.com')).toBeTruthy();
  });

  it('falls back to initials when no avatar is available', async () => {
    const { getByText } = await render(<UserIdentity userId={null} name="Jane Smith" subtitle="HR" size="sm" />);

    expect(getByText('JS')).toBeTruthy();
    expect(getByText('Jane Smith')).toBeTruthy();
    expect(getByText('HR')).toBeTruthy();
  });

  it('uses a lowercase profile photo category when resolving the avatar', async () => {
    (filesByEntity as jest.Mock).mockResolvedValue([
      { category: 'profile photo', previewUrl: 'https://example.com/avatar.png' },
    ]);

    const { getByTestId } = await render(<UserIdentity userId={9} name="Alex Green" subtitle="Eng" size="sm" />);

    await waitFor(() => {
      expect(getByTestId('user-avatar-image')).toBeTruthy();
    });
  });
});
