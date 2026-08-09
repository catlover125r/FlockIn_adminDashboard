import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/requireAdmin';
import { broadcastNotification } from '@/lib/notify';

interface NotifyRequestBody {
  title: string;
  body: string;
}

export async function POST(req: NextRequest) {
  // This route pushes to every student's device. Without a check, anyone who
  // learns the URL can notify the whole school.
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;

  try {
    const body = (await req.json()) as NotifyRequestBody;
    const { title, body: notifBody } = body;

    if (!title || !notifBody) {
      return NextResponse.json(
        { error: 'Missing required fields: title and body' },
        { status: 400 }
      );
    }

    const result = await broadcastNotification(title, notifBody);

    console.log(`[notify] Sent: ${result.sent}, Failed: ${result.failed}`);

    return NextResponse.json(result);
  } catch (error: unknown) {
    console.error('[notify] Unhandled error:', error);
    // Internal failure details stay in the server log.
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
