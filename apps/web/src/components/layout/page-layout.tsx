import type { ReactNode } from 'react';

interface PageLayoutProps {
  children: ReactNode;
}

export function PageLayout({ children }: PageLayoutProps) {
  return <main className="max-w-7xl mx-auto px-4 py-8">{children}</main>;
}
