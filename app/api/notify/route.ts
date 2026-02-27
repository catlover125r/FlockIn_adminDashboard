import { NextRequest, NextResponse } from 'next/server';
import { getAdminDB, getAdminMessaging } from '@/lib/firebaseAdmin';

interface NotifyRequestBody {
  title: string;
  body: string;
}

// Chunk an array into batches of a given size
function chunk<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as NotifyRequestBody;
    const { title, body: notifBody } = body;

    if (!title || !notifBody) {
      return NextResponse.json(
        { error: 'Missing required fields: title and body' },
        { status: 400 }
      );
    }

    const db = getAdminDB();
    const messaging = getAdminMessaging();

    // Fetch all whitelisted students with an FCM token
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
      return NextResponse.json({ sent: 0, failed: 0, message: 'No devices to notify' });
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
            notification: {
              title,
              body: notifBody,
            },
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

    console.log(
      `[notify] Sent: ${totalSent}, Failed: ${totalFailed}, Total tokens: ${tokens.length}`
    );

    return NextResponse.json({ sent: totalSent, failed: totalFailed });
  } catch (error: unknown) {
    console.error('[notify] Unhandled error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
