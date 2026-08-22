import type { ReactNode } from 'react';

const FrontendLayout = ({ children }: { children: ReactNode }) => (
  <html lang="en">
    <body>{children}</body>
  </html>
);

export default FrontendLayout;
