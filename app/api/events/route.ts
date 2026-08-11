import { NextRequest, NextResponse } from 'next/server';
import { getAdminDB } from '@/lib/firebaseAdmin';
import admin from '@/lib/firebaseAdmin';
import { requireStaff } from '@/lib/requireAdmin';
import { broadcastNotification } from '@/lib/notify';

interface CreateEventBody {
  title: string;
  task: string;
  date: string;
  time: string;
  location: string;
  latitude: number | null;
  longitude: number | null;
  isActive?: boolean;
  hours?: number;
  positions?: number;
}

export async function POST(req: NextRequest) {
  // Writes to /events with Admin SDK credentials, which bypass Firestore
  // rules — the check has to happen here. requireStaff, not requireAdmin:
  // creating events is the one thing a chair is for.
  const auth = await requireStaff(req);
  if (!auth.ok) return auth.response;

  try {
    const body = (await req.json()) as CreateEventBody;
    const { title, task, date, time, location, latitude, longitude, isActive = false, hours = 1, positions = 0 } = body;

    // Validate required fields
    if (!title || !task || !date || !time || !location) {
      return NextResponse.json(
        { error: 'Missing required fields: title, task, date, time, location' },
        { status: 400 }
      );
    }

    if (typeof hours !== 'number' || !isFinite(hours) || hours < 0) {
      return NextResponse.json(
        { error: 'hours must be a non-negative number' },
        { status: 400 }
      );
    }

    if (!Number.isInteger(positions) || positions < 0) {
      return NextResponse.json(
        { error: 'positions must be a non-negative whole number' },
        { status: 400 }
      );
    }

    const db = getAdminDB();

    // Create the event
    const eventRef = await db.collection('events').add({
      title,
      task,
      date,
      time,
      location,
      latitude: latitude ?? null,
      longitude: longitude ?? null,
      isActive,
      hours,
      positions,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Send push notification to all whitelisted students
    let notifResult = { sent: 0, failed: 0 };
    try {
      notifResult = await broadcastNotification(
        `New Event: ${title}`,
        `${task} on ${date} at ${time}`
      );
    } catch (notifError) {
      console.warn('[events/POST] Failed to send notification:', notifError);
    }

    return NextResponse.json(
      {
        id: eventRef.id,
        message: 'Event created successfully',
        notification: notifResult,
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    console.error('[events/POST] Unhandled error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
