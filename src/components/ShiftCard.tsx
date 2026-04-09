import { MapPin, Users, ChevronRight } from 'lucide-react';
import { Shift } from '../types';

interface ShiftCardProps {
  shift: Shift;
  variant?: 'history' | 'schedule';
  key?: string | number;
}

export function ShiftCard({ shift, variant = 'history' }: ShiftCardProps) {
  const isCompleted = shift.status === 'Completed';
  const isUpcoming = shift.status === 'Upcoming';
  const isInProgress = shift.status === 'In Progress';

  if (variant === 'schedule') {
    return (
      <div className={`rounded-xl p-5 flex items-center justify-between transition-colors cursor-pointer ${
        isInProgress ? 'bg-surface-container-highest border border-primary/20' : 'bg-surface-container-low hover:bg-surface-container-highest'
      } ${isCompleted ? 'opacity-70 grayscale-[0.5]' : ''}`}>
        <div className="flex items-center gap-4">
          <div className={`w-12 h-12 rounded-lg flex flex-col items-center justify-center ${
            isInProgress ? 'bg-primary text-white' : 'bg-surface-container-highest text-primary'
          }`}>
            <span className="text-[10px] font-bold uppercase">{shift.day}</span>
            <span className="text-lg font-extrabold leading-none">{shift.date.split(' ')[1]}</span>
          </div>
          <div>
            <h4 className="font-bold text-on-surface">{shift.startTime} - {shift.endTime}</h4>
            <p className="text-xs text-on-surface-variant">{shift.location}</p>
          </div>
        </div>
        <div className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-tighter ${
          isInProgress ? 'bg-secondary text-white' : 
          isUpcoming ? 'bg-primary-fixed text-primary' : 
          'bg-secondary-container text-on-secondary-container'
        }`}>
          {shift.status}
        </div>
      </div>
    );
  }

  return (
    <div className="group relative bg-surface-container-lowest rounded-xl p-6 transition-all duration-300 hover:bg-surface-container-low border border-outline-variant/10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-5">
          <div className="flex flex-col items-center justify-center w-14 h-14 bg-surface-container rounded-lg">
            <span className="font-label text-[10px] uppercase font-bold text-on-surface-variant">{shift.day}</span>
            <span className="font-headline text-xl font-extrabold text-primary">{shift.date.split(' ')[1]}</span>
          </div>
          <div>
            <h3 className="font-headline font-bold text-on-surface">{shift.location}</h3>
            <div className="flex items-center gap-2 mt-1">
              <div className={`w-1.5 h-1.5 rounded-full ${isCompleted ? 'bg-secondary' : 'bg-primary'}`}></div>
              <span className="text-sm text-on-surface-variant font-medium">{shift.status}</span>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-12 flex-grow md:justify-end">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-outline mb-1 font-semibold">Start Time</p>
            <p className="font-headline font-bold text-primary">{shift.startTime}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-widest text-outline mb-1 font-semibold">End Time</p>
            <p className="font-headline font-bold text-primary">{shift.endTime}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-widest text-outline mb-1 font-semibold">Break</p>
            <p className="font-headline font-bold text-primary">{shift.break}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-widest text-outline mb-1 font-semibold">Total</p>
            <p className="font-headline font-bold text-primary">{shift.total}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
