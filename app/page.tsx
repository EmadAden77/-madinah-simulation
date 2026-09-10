'use client';

import dynamic from 'next/dynamic';

const HistoricalMap = dynamic(() => import('@/components/HistoricalMap'), { ssr: false });

export default function HomePage() {
  return <HistoricalMap />;
}
