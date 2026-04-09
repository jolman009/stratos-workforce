import { LogIn, LogOut, Coffee, Info, CheckCircle2, Timer } from 'lucide-react';
import { motion } from 'motion/react';

interface ClockCardProps {
  isClockedIn: boolean;
  onClockIn: () => void;
  onClockOut: () => void;
  onStartBreak: () => void;
  onStopBreak: () => void;
  isBreakActive: boolean;
  breakTimeRemaining: number;
  elapsedTime?: string;
  startTime?: string;
}

export function ClockCard({ 
  isClockedIn, 
  onClockIn, 
  onClockOut, 
  onStartBreak, 
  onStopBreak,
  isBreakActive, 
  breakTimeRemaining,
  elapsedTime, 
  startTime 
}: ClockCardProps) {
  if (!isClockedIn) {
    return (
      <div className="bg-white rounded-xl overflow-hidden p-8 flex flex-col items-center text-center relative group shadow-sm border border-outline-variant/10">
        <div className="absolute inset-0 bg-gradient-to-br from-primary to-primary-container opacity-[0.03] pointer-events-none"></div>
        <div className="w-20 h-20 bg-secondary/10 rounded-full flex items-center justify-center mb-6">
          <Timer className="text-secondary w-10 h-10" />
        </div>
        <h3 className="font-headline font-bold text-2xl text-on-surface mb-2">Shift Entry</h3>
        <p className="text-on-surface-variant mb-8 max-w-xs">Your shift was scheduled to begin at 09:00 AM. You are currently on site.</p>
        <button 
          onClick={onClockIn}
          className="w-full max-w-sm py-5 bg-secondary text-white rounded-xl font-headline font-bold text-xl shadow-lg shadow-secondary/20 hover:scale-[1.02] active:scale-95 transition-all duration-300 flex items-center justify-center gap-3"
        >
          <LogIn size={24} />
          Clock In
        </button>
      </div>
    );
  }

  const formatBreakTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className={`clock-gradient rounded-xl p-8 text-white relative overflow-hidden shadow-lg transition-all duration-500 ${isBreakActive ? 'ring-4 ring-secondary/30' : ''}`}>
      <div className="relative z-10 flex flex-col gap-8">
        <div className="space-y-2">
          <div className="flex items-center gap-2 opacity-90">
            <span className={`w-2 h-2 rounded-full ${isBreakActive ? 'bg-tertiary animate-pulse' : 'bg-secondary-container animate-pulse'}`}></span>
            <p className="font-label text-xs uppercase tracking-[0.2em] font-semibold">
              {isBreakActive ? 'On Break' : 'Currently Clocked In'}
            </p>
          </div>
          <h2 className="font-headline text-[3.5rem] font-extrabold leading-none tracking-tight">
            {isBreakActive ? formatBreakTime(breakTimeRemaining) : (elapsedTime || "0h 00m")}
          </h2>
          <p className="text-on-primary-container font-medium opacity-80">
            {isBreakActive ? 'Break ends soon' : `Shift started at ${startTime || "08:30 AM"} • Local Time`}
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-4">
          {isBreakActive ? (
            <button 
              onClick={onStopBreak}
              className="bg-white text-primary px-8 py-4 rounded-lg font-bold flex items-center justify-center gap-3 transition-transform active:scale-95 shadow-lg"
            >
              <CheckCircle2 size={20} />
              End Break Early
            </button>
          ) : (
            <button 
              onClick={onStartBreak}
              className="bg-secondary text-white px-8 py-4 rounded-lg font-bold flex items-center justify-center gap-3 transition-transform active:scale-95 shadow-sm"
            >
              <Coffee size={20} />
              Start 15min Break
            </button>
          )}
          {!isBreakActive && (
            <button 
              onClick={onClockOut}
              className="bg-tertiary text-white px-8 py-4 rounded-lg font-bold flex items-center justify-center gap-3 transition-transform active:scale-95 shadow-sm"
            >
              <LogOut size={20} />
              Clock Out
            </button>
          )}
        </div>
      </div>
      <div className="absolute -right-12 -bottom-12 opacity-10 pointer-events-none">
        {isBreakActive ? <Coffee size={240} strokeWidth={1} /> : <Timer size={240} strokeWidth={1} />}
      </div>
    </div>
  );
}

export function ProgressCard({ progress }: { progress: number }) {
  return (
    <div className="bg-surface-container-low rounded-xl p-6 flex flex-col justify-between border border-outline-variant/10">
      <div>
        <h4 className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-6">Today's Progress</h4>
        <div className="flex items-baseline gap-2">
          <span className="font-headline font-extrabold text-5xl text-primary">{Math.floor(progress / 60)}<span className="text-2xl ml-1">h</span></span>
          <span className="font-headline font-extrabold text-5xl text-primary">{progress % 60}<span className="text-2xl ml-1">m</span></span>
        </div>
      </div>
      <div className="mt-8 flex items-center gap-3">
        <div className="flex-1 h-2 bg-surface-container-highest rounded-full overflow-hidden">
          <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${(progress / 480) * 100}%` }}></div>
        </div>
        <span className="text-[10px] font-bold text-on-surface-variant">{Math.round((progress / 480) * 100)}% OF GOAL</span>
      </div>
    </div>
  );
}

export function ComplianceCard() {
  return (
    <div className="bg-white rounded-xl p-6 flex items-center gap-6 border-l-4 border-primary shadow-sm">
      <div className="p-3 bg-surface-container-highest rounded-xl text-primary">
        <Info size={24} />
      </div>
      <div>
        <h5 className="font-headline font-bold text-on-surface">Weekly Compliance</h5>
        <p className="text-sm text-on-surface-variant">Your timesheet for last week is pending approval.</p>
      </div>
      <button className="ml-auto text-primary font-bold text-sm hover:underline">Review</button>
    </div>
  );
}
