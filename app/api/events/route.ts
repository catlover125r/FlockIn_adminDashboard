import { NextRequest, NextResponse } from 'next/server';
import { getAdminDB } from '@/lib/firebaseAdmin';
import admin from '@/lib/firebaseAdmin';

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
      const notifRes = await fetch(
        `${process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'}/api/notify`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: `New Event: ${title}`,
            body: `${task} on ${date} at ${time}`,
          }),
        }
      );
      if (notifRes.ok) {
        notifResult = await notifRes.json();
      }
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
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
