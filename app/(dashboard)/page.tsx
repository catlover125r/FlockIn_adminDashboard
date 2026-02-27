'use client';

import { useEffect, useState } from 'react';
import {
  getEvents,
  getStudents,
  getRecentCheckins,
  getTodayCheckinCount,
} from '@/lib/firebase';
import type { FlockEvent, Student, Checkin } from '@/lib/types';
import { formatTimestamp } from '@/lib/types';

interface StatCardProps {
  title: string;
  value: number | string;
  icon: React.ReactNode;
  accent: string;
  loading?: boolean;
}

function StatCard({ title, value, icon, accent, loading }: StatCardProps) {
  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex items-center gap-4">
      <div
        className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: accent + '18' }}
      >
        <span style={{ color: accent }}>{icon}</span>
      </div>
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{title}</p>
        {loading ? (
          <div className="h-7 w-12 bg-gray-200 rounded-md animate-pulse mt-1" />
        ) : (
          <p className="text-2xl font-bold text-gray-900 mt-0.5">{value}</p>
        )}
      </div>
    </div>
  );
}

export default function DashboardOverviewPage() {
  const [events, setEvents] = useState<FlockEvent[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [recentCheckins, setRecentCheckins] = useState<Checkin[]>([]);
  const [todayCount, setTodayCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const [eventsData, studentsData, checkinsData, todayData] = await Promise.all([
          getEvents() as Promise<FlockEvent[]>,
          getStudents() as Promise<Student[]>,
          getRecentCheckins(10) as Promise<Checkin[]>,
          getTodayCheckinCount(),
        ]);
        setEvents(eventsData);
        setStudents(studentsData);
        setRecentCheckins(checkinsData);
        setTodayCount(todayData);
      } catch (err) {
        console.error('Failed to load dashboard data:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const whitelistedCount = students.filter((s) => s.isWhitelisted).length;
  const activeEventsCount = events.filter((e) => e.isActive).length;

  return (
    <div>
      {/* Page header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Overview</h1>
        <p className="text-sm text-gray-500 mt-1">
          {new Date().toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          title="Whitelisted Students"
          value={whitelistedCount}
          loading={loading}
          accent="#8B5CF6"
          icon={
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
            </svg>
          }
        />
        <StatCard
          title="Total Events"
          value={events.length}
          loading={loading}
          accent="#3B82F6"
          icon={
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
          }
        />
        <StatCard
          title="Active Events"
          value={activeEventsCount}
          loading={loading}
          accent="#10B981"
          icon={
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
            </svg>
          }
        />
        <StatCard
          title="Check-ins Today"
          value={todayCount}
          loading={loading}
          accent="#F59E0B"
          icon={
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 12l2 2 4-4" />
              <path d="M21 12c0 4.97-4.03 9-9 9S3 16.97 3 12 7.03 3 12 3s9 4.03 9 9z" />
            </svg>
          }
        />
      </div>

      {/* Recent check-ins table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Recent Check-ins</h2>
          <span className="text-xs text-gray-400 font-medium">Last 10</span>
        </div>

        {loading ? (
          <div className="px-6 py-12 flex items-center justify-center">
            <svg className="animate-spin h-6 w-6 text-violet-400" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        ) : recentCheckins.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="text-gray-400">
                <path d="M9 12l2 2 4-4M21 12c0 4.97-4.03 9-9 9S3 16.97 3 12 7.03 3 12 3s9 4.03 9 9z" />
              </svg>
            </div>
            <p className="text-sm text-gray-500 font-medium">No check-ins yet</p>
            <p className="text-xs text-gray-400 mt-1">Check-ins will appear here as students attend events</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-6 py-3">Student</th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-6 py-3">Event</th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-6 py-3">Location</th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-6 py-3">Hours</th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-6 py-3">Checked In</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {recentCheckins.map((checkin) => (
                  <tr key={checkin.id} className="table-row-hover">
                    <td className="px-6 py-3.5">
                      <div className="font-medium text-sm text-gray-900">{checkin.studentName}</div>
                      <div className="text-xs text-gray-400">{checkin.studentEmail}</div>
                    </td>
                    <td className="px-6 py-3.5 text-sm text-gray-700">{checkin.eventTitle}</td>
                    <td className="px-6 py-3.5 text-sm text-gray-500">{checkin.eventLocation}</td>
                    <td className="px-6 py-3.5">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-violet-100 text-violet-700">
                        {checkin.hoursEarned}h
                      </span>
                    </td>
                    <td className="px-6 py-3.5 text-sm text-gray-500 whitespace-nowrap">
                      {formatTimestamp(checkin.checkedInAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
