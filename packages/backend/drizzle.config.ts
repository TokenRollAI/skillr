import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/models/drizzle-schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL || 'postgresql://skillhub:skillhub@localhost:5432/skillhub',
  },
});
