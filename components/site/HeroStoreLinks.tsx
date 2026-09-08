import React from 'react';
import type { SiteCopy } from '@/lib/site/types';
import { StoreLinks } from './StoreLinks';

export function HeroStoreLinks({ copy }: { copy: SiteCopy['download'] }) {
  return <StoreLinks copy={copy} compact placement="hero" />;
}
