import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // `reference/` holds the audited prototype. It is documentation, never source.
  // It is excluded from TypeScript (tsconfig) and from linting; nothing imports it.
};

export default withNextIntl(nextConfig);
