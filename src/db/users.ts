import { db } from './index.ts';
import { users } from './schema.ts';
import { eq } from 'drizzle-orm';

export async function getOrCreateUser(uid: string, email: string) {
  try {
    const result = await db.insert(users)
      .values({ uid, email })
      .onConflictDoUpdate({
        target: users.uid,
        set: { email },
      })
      .returning();
    return result[0];
  } catch (error) {
    console.error("Database query failed in getOrCreateUser:", error);
    throw new Error("Database query failed.", { cause: error });
  }
}

export async function updateUpstoxTokens(uid: string, apiKey: string, redirectUri: string, accessToken: string) {
  try {
    const result = await db.update(users)
      .set({ upstoxApiKey: apiKey, upstoxRedirectUri: redirectUri, upstoxAccessToken: accessToken })
      .where(eq(users.uid, uid))
      .returning();
    return result[0];
  } catch (error) {
    console.error("Database query failed in updateUpstoxTokens:", error);
    throw new Error("Database query failed.", { cause: error });
  }
}

export async function getUser(uid: string) {
    try {
      const result = await db.select().from(users).where(eq(users.uid, uid)).limit(1);
      return result[0] || null;
    } catch (error) {
      console.error("Database query failed in getUser:", error);
      throw new Error("Database query failed.", { cause: error });
    }
}
