import { getAdminDB, getAdminMessaging } from '@/lib/firebaseAdmin';

export interface NotifyResult {
  sent: number;
  failed: number;
}

// Chunk an array into batches of a given size
function chunk<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

/**
 * Pushes a notification to every whitelisted student with a registered device.
 *
 * Lives here rather than in the route handler so server-side callers can reach
 * it directly. The previous arrangement had /api/events issue an HTTP request
 * to /api/notify, which meant an extra round trip, a hard dependency on
 * NEXT_PUBLIC_SITE_URL being set correctly, and — now that the route requires
 * an admin token — a call that could not authenticate itself.
 */
export async function broadcastNotification(
  title: string,
  body: string
): Promise<NotifyResult> {
  const db = getAdminDB();
  const messaging = getAdminMessaging();

  const studentsSnap = await db
    .collection('students')
    .where('isWhitelisted', '==', true)
    .get();

  const tokens: string[] = [];
  studentsSnap.docs.forEach((doc) => {
    const token = doc.data().fcmToken as string | undefined;
    if (token && token.trim().length > 0) {
      tokens.push(token.trim());
    }
  });

  if (tokens.length === 0) {
    return { sent: 0, failed: 0 };
  }

  // FCM multicast limit is 500 tokens per request
  const batches = chunk(tokens, 500);
  let totalSent = 0;
  let totalFailed = 0;

  await Promise.all(
    batches.map(async (batchTokens) => {
      try {
        const response = await messaging.sendEachForMulticast({
          tokens: batchTokens,
          notification: { title, body },
          apns: {
            payload: {
              aps: {
                sound: 'default',
                badge: 1,
              },
            },
          },
          android: {
            priority: 'high',
            notification: {
              sound: 'default',
              channelId: 'flockin_events',
            },
          },
        });
        totalSent += response.successCount;
        totalFailed += response.failureCount;

        // Log failed tokens for debugging (don't expose to client)
        response.responses.forEach((resp, idx) => {
          if (!resp.success) {
            console.warn(
              `FCM send failed for token ${batchTokens[idx]?.slice(0, 20)}...:`,
              resp.error?.code
            );
          }
        });
      } catch (batchError) {
        console.error('FCM batch send error:', batchError);
        totalFailed += batchTokens.length;
      }
    })
  );

  return { sent: totalSent, failed: totalFailed };
}
