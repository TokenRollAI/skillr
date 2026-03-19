import 'dotenv/config';
import { getDb, closeDb } from './db.js';
import { users, namespaces, nsMembers } from './models/schema.js';
import * as argon2 from 'argon2';

async function seed() {
  const db = getDb();

  console.log('Seeding database...');

  // Create admin user
  const passwordHash = await argon2.hash('admin123');
  const [admin] = await db.insert(users).values({
    username: 'admin',
    email: 'admin@skillr.dev',
    passwordHash,
    role: 'admin',
  }).onConflictDoNothing().returning();

  if (admin) {
    console.log(`Created admin user: ${admin.username}`);

    // Create default namespace
    const [ns] = await db.insert(namespaces).values({
      name: '@default',
      description: 'Default namespace',
      visibility: 'public',
    }).onConflictDoNothing().returning();

    if (ns) {
      await db.insert(nsMembers).values({
        userId: admin.id,
        namespaceId: ns.id,
        role: 'maintainer',
      }).onConflictDoNothing();
      console.log(`Created namespace: ${ns.name}`);
    }
  }

  console.log('Seed complete.');
  await closeDb();
}

seed().catch(console.error);
