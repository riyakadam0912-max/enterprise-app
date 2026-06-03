'use client';

import { useState } from 'react';

export function useStableNow() {
  const [now] = useState(() => Date.now());
  return now;
}