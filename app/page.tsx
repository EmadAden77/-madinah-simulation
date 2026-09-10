'use client';

import dynamic from 'next/dynamic';
import ExplorerDeck from '@/components/ExplorerDeck';

const HistoricalMapPhoto = dynamic(() => import('@/components/HistoricalMapPhoto'), { ssr: false });
const AmbientSoundscape = dynamic(() => import('@/components/AmbientSoundscape'), { ssr: false });

export default function HomePage() {
  return (
    <>
      <HistoricalMapPhoto />
      <ExplorerDeck />
      <AmbientSoundscape />
    </>
  );
}
