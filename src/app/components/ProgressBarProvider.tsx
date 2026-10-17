'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

const ProgressBarProvider = ({ children }: { children: ReactNode }) => {
  const pathname = usePathname();
  return <div key={pathname} className="page-enter">{children}</div>;
};

export default ProgressBarProvider;
