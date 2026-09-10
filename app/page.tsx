'use client';

import dynamic from 'next/dynamic';

const HistoricalMapPhoto = dynamic(() => import('@/components/HistoricalMapPhoto'), { ssr: false });

export default function HomePage() {
  return <HistoricalMapPhoto />;
}
