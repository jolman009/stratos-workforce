import { ReactNode } from 'react';
import Layout from '../components/Layout';
import { NotificationItem } from '../components/NotificationItem';
import { Notification, Screen, User } from '../types';

interface AlertsScreenProps {
  banner?: ReactNode;
  notifications: Notification[];
  unreadCount: number;
  onNavigate: (screen: Screen) => void;
  onAction: (notification: Notification) => void | Promise<void>;
  onOpen: (notification: Notification) => void | Promise<void>;
  user: User;
}

export function AlertsScreen({
  banner,
  notifications,
  unreadCount,
  onNavigate,
  onAction,
  onOpen,
  user,
}: AlertsScreenProps) {
  const unreadNotifications = notifications.filter((notification) => notification.unread);
  const readNotifications = notifications.filter((notification) => !notification.unread);

  return (
    <Layout currentScreen="alerts" onNavigate={onNavigate} user={user} title="Notifications" banner={banner}>
      <div className="mb-10">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-headline font-extrabold text-primary tracking-tight text-xl">New</h2>
          <span className="bg-primary text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-widest">{unreadCount} Unread</span>
        </div>
        <div className="space-y-4">
          {unreadNotifications.map((notification) => (
            <NotificationItem key={notification.id} notification={notification} onAction={onAction} onOpen={onOpen} />
          ))}
        </div>
      </div>
      <div>
        <h2 className="font-headline font-extrabold text-on-surface-variant tracking-tight text-lg mb-6">Earlier</h2>
        <div className="space-y-4">
          {readNotifications.map((notification) => (
            <NotificationItem key={notification.id} notification={notification} onAction={onAction} onOpen={onOpen} />
          ))}
        </div>
      </div>
    </Layout>
  );
}
