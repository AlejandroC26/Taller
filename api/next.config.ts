import type { NextConfig } from 'next';

const config: NextConfig = {
  // TypeORM y pg se cargan desde node_modules tal cual: no se empaquetan.
  serverExternalPackages: ['typeorm', 'pg', 'reflect-metadata'],
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: '/:ruta*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'no-referrer' },
        ],
      },
    ];
  },
};

export default config;
