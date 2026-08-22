'use client';

import { Card } from '@payloadcms/ui';
import type { ReactNode } from 'react';

export const SchemaCard = ({
  actions,
  badges,
  name,
  subtitle,
}: {
  actions: ReactNode;
  badges: ReactNode;
  name: string;
  subtitle?: string;
}) => (
  <div className="seo-schema-card">
    <Card
      actions={
        <div className="st-flex st-w-max st-flex-nowrap st-items-center st-gap-1 st-whitespace-nowrap">
          <div className="st-flex st-flex-nowrap st-gap-[5px]">{badges}</div>
          <div className="st-flex st-flex-nowrap st-items-center st-gap-1">
            {actions}
          </div>
        </div>
      }
      title={subtitle ? `${name} — ${subtitle}` : name}
      titleAs="h4"
    />
  </div>
);
