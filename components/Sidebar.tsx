'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from './AuthProvider';

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
}

function OverviewIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}

function EventsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function StudentsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 00-3-3.87" />
      <path d="M16 3.13a4 4 0 010 7.75" />
    </svg>
  );
}

function HoursIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

const navItems: NavItem[] = [
  { href: '/', label: 'Overview', icon: <OverviewIcon /> },
  { href: '/events', label: 'Events', icon: <EventsIcon /> },
  { href: '/students', label: 'Students', icon: <StudentsIcon /> },
  { href: '/hours', label: 'Hours', icon: <HoursIcon /> },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { user, signOutUser } = useAuth();

  function isActive(href: string) {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  }

  return (
    <aside
      className="fixed top-0 left-0 h-screen flex flex-col bg-white border-r border-gray-100 z-20"
      style={{ width: 240 }}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-gray-100">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{
            background: 'linear-gradient(145deg, #8B5CF6 0%, #7C3AED 100%)',
            boxShadow: '0 2px 8px rgba(139,92,246,0.3)',
          }}
        >
          <svg width="18" height="18" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="20" cy="13" r="5" fill="white" />
            <path d="M11 33c0-4.97 4.03-9 9-9s9 4.03 9 9" stroke="white" strokeWidth="2.5" strokeLinecap="round" fill="none" />
            <circle cx="9" cy="15" r="4" fill="white" fillOpacity="0.65" />
            <path d="M1 33c0-4.42 3.58-8 8-8" stroke="white" strokeWidth="2.5" strokeLinecap="round" fill="none" strokeOpacity="0.65" />
            <circle cx="31" cy="15" r="4" fill="white" fillOpacity="0.65" />
            <path d="M39 33c0-4.42-3.58-8-8-8" stroke="white" strokeWidth="2.5" strokeLinecap="round" fill="none" strokeOpacity="0.65" />
          </svg>
        </div>
        <div>
          <div className="font-bold text-gray-900 text-sm leading-tight">Flock In</div>
          <div className="text-xs text-gray-400 leading-tight">Admin Dashboard</div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                active
                  ? 'bg-violet-100 text-violet-700'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              }`}
            >
              <span className={active ? 'text-violet-600' : 'text-gray-400'}>
                {item.icon}
              </span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* User section */}
      <div className="border-t border-gray-100 px-3 py-4">
        {user && (
          <div className="mb-2 px-3 py-2">
            <div className="text-xs font-medium text-gray-700 truncate">
              {user.displayName ?? 'Admin'}
            </div>
            <div className="text-xs text-gray-400 truncate">{user.email}</div>
          </div>
        )}
        <button
          onClick={signOutUser}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-500 hover:bg-red-50 hover:text-red-600 transition-all duration-150"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          Sign Out
        </button>
      </div>
    </aside>
  );
}
