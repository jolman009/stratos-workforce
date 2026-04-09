import { Umbrella, Stethoscope, User, CalendarDays, Activity, ChevronRight, CheckCircle2, Clock } from 'lucide-react';
import { TimeOffRequest } from '../types';

interface BalanceCardProps {
  type: 'Vacation' | 'Sick' | 'Personal';
  balance: number;
  maxBalance: number;
  expiry?: string;
  description?: string;
  variant?: 'large' | 'small' | 'wide';
}

export function BalanceCard({ type, balance, maxBalance, expiry, description, variant = 'small' }: BalanceCardProps) {
  const progress = Math.min((balance / maxBalance) * 100, 100);

  if (variant === 'large') {
    return (
      <div className="bg-primary-container rounded-xl p-8 text-white relative overflow-hidden group shadow-lg">
        <div className="relative z-10">
          <Umbrella className="w-10 h-10 mb-4 opacity-80" />
          <h3 className="font-headline text-lg font-bold opacity-90">{type}</h3>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-5xl font-black tracking-tighter">{balance}</span>
            <span className="text-xl font-medium opacity-70 tracking-tight">/ {maxBalance} days</span>
          </div>
          <div className="mt-8 space-y-2">
            <div className="h-2 w-full bg-white/20 rounded-full overflow-hidden">
              <div 
                className="bg-white h-full transition-all duration-1000 ease-out" 
                style={{ width: `${progress}%` }}
              ></div>
            </div>
            <p className="text-xs font-medium text-on-primary-container/80">{Math.round(progress)}% of annual allowance accrued</p>
          </div>
          {expiry && <p className="mt-6 text-sm font-medium text-on-primary-container">Expires {expiry}</p>}
        </div>
        <div className="absolute top-0 right-0 w-full h-full opacity-20 pointer-events-none bg-gradient-to-br from-primary-container via-transparent to-black"></div>
      </div>
    );
  }

  if (variant === 'wide') {
    return (
      <div className="bg-white rounded-xl p-6 shadow-[0px_20px_40px_rgba(7,30,39,0.06)] border border-outline-variant/10">
        <User className="text-tertiary w-8 h-8 mb-3" />
        <h3 className="font-headline text-on-surface-variant font-bold text-sm uppercase tracking-widest">{type}</h3>
        <div className="flex items-baseline gap-1 mt-1">
          <span className="text-4xl font-extrabold text-on-surface tracking-tighter">{balance}</span>
          <span className="text-sm font-medium text-on-surface-variant">/ {maxBalance} days</span>
        </div>
        <div className="mt-6 h-1.5 w-full bg-surface-container rounded-full overflow-hidden">
          <div 
            className="bg-tertiary h-full transition-all duration-1000 ease-out" 
            style={{ width: `${progress}%` }}
          ></div>
        </div>
        {description && <p className="mt-6 text-xs text-on-surface-variant leading-relaxed">{description}</p>}
      </div>
    );
  }

  return (
    <div className="bg-surface-container-highest rounded-xl p-6 border-l-4 border-secondary shadow-sm">
      <Stethoscope className="text-secondary w-8 h-8 mb-3" />
      <h3 className="font-headline text-on-surface-variant font-bold text-sm uppercase tracking-widest">{type}</h3>
      <div className="flex items-baseline gap-1 mt-1">
        <span className="text-4xl font-extrabold text-on-surface tracking-tighter">{balance}</span>
        <span className="text-sm font-medium text-on-surface-variant">/ {maxBalance} days</span>
      </div>
      <div className="mt-8 h-1.5 w-full bg-surface-container rounded-full overflow-hidden">
        <div 
          className="bg-secondary h-full transition-all duration-1000 ease-out" 
          style={{ width: `${progress}%` }}
        ></div>
      </div>
    </div>
  );
}

export function RequestItem({ request, key }: { request: TimeOffRequest; key?: string | number }) {
  const isPending = request.status === 'Pending';
  const isApproved = request.status === 'Approved';

  return (
    <div className="group bg-surface-container-low hover:bg-surface-container transition-all duration-300 rounded-xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div className="flex items-center gap-5">
        <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${isApproved ? 'text-secondary' : 'text-primary'} bg-surface-container-highest`}>
          {request.type === 'Sick' ? <Activity size={24} /> : <CalendarDays size={24} />}
        </div>
        <div>
          <h4 className="font-bold text-on-surface">{request.title}</h4>
          <p className="text-sm text-on-surface-variant font-medium">{request.dates} • {request.duration}</p>
        </div>
      </div>
      <div className="flex items-center justify-between md:justify-end gap-6">
        <div className={`flex items-center gap-2 px-3 py-1 rounded-full ${isApproved ? 'bg-secondary-container' : 'bg-surface-container-highest'}`}>
          <div className={`w-2 h-2 rounded-full ${isApproved ? 'bg-secondary' : 'bg-primary animate-pulse'}`}></div>
          <span className={`text-xs font-bold uppercase tracking-widest ${isApproved ? 'text-on-secondary-container' : 'text-primary'}`}>
            {request.status}
          </span>
        </div>
        <ChevronRight className="text-outline group-hover:translate-x-1 transition-transform cursor-pointer" size={20} />
      </div>
    </div>
  );
}
