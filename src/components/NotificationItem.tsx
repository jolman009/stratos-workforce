import { CheckCircle2, AlarmClock, Calendar, CalendarDays, MoreVertical } from 'lucide-react';
import { Notification } from '../types';

interface NotificationItemProps {
  key?: string | number;
  notification: Notification;
  onAction?: (notification: Notification) => void;
  onOpen?: (notification: Notification) => void;
}

export function NotificationItem({ notification, onAction, onOpen }: NotificationItemProps) {
  const Icon = notification.type === 'approval' ? CheckCircle2 : 
               notification.type === 'reminder' ? AlarmClock : 
               notification.type === 'update' ? Calendar : CalendarDays;
  
  const iconBg = notification.type === 'approval' ? 'bg-secondary-container text-on-secondary-container' : 
                 notification.type === 'reminder' ? 'bg-surface-container-highest text-primary' : 
                 'bg-primary-container/10 text-primary-container';

  return (
    <div
      className={`bg-surface-container-lowest rounded-xl p-5 flex items-start gap-4 transition-all hover:bg-surface-container-low group ${!notification.unread ? 'opacity-80' : ''}`}
      onClick={() => onOpen?.(notification)}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onOpen?.(notification);
        }
      }}
    >
      <div className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center ${iconBg}`}>
        <Icon size={24} fill={notification.type === 'approval' ? 'currentColor' : 'none'} />
      </div>
      <div className="flex-1">
        <div className="flex justify-between items-start mb-1">
          <h3 className="font-headline font-bold text-on-surface text-base">{notification.title}</h3>
          <span className="text-[11px] font-medium text-on-surface-variant">{notification.time}</span>
        </div>
        <p className="text-on-surface-variant text-sm leading-relaxed">{notification.message}</p>
        {notification.action && (
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onAction?.(notification);
              }}
              className={`text-xs font-bold px-4 py-1.5 rounded-lg transition-colors ${
              notification.action.type === 'start' 
                ? 'bg-secondary text-white hover:opacity-90' 
                : 'bg-surface-container-highest text-primary hover:bg-primary hover:text-white'
            }`}
            >
              {notification.action.label}
            </button>
          </div>
        )}
      </div>
      {notification.unread && <div className="w-2 h-2 rounded-full bg-primary mt-2"></div>}
    </div>
  );
}
