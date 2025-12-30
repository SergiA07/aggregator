import type { ReactNode } from 'react';

interface PageLayoutProps {
  children: ReactNode;
}

export function PageLayout({ children }: PageLayoutProps) {
  return <main className="w-full px-4 md:px-6 lg:px-8 py-8">{children}</main>;
}
