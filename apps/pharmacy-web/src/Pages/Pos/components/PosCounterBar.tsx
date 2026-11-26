import { Link } from '@inertiajs/react';
import {
 AlertCircle,
 Coffee,
 ExternalLink,
 Layers,
 LogOut,
 Play,
 User,
} from 'lucide-react';
import { Button } from '@/Components/ui/Button';
import { formatCurrency } from '@/lib/format';
import { PosCounterData } from './PosShiftModals';

interface PosCounterBarProps {
 activeCounter: PosCounterData | null;
 currency: string;
 onOpenShift: () => void;
 onTakeBreak: () => void;
 onCloseShift: () => void;
}

export function PosCounterBar({
 activeCounter,
 currency,
 onOpenShift,
 onTakeBreak,
 onCloseShift,
}: PosCounterBarProps) {
 if (!activeCounter) {
 return (
 <div className="mb-3 p-2.5 rounded-[2px] border border-amber-200 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/30 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
 <div className="flex items-center gap-2">
 <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0"/>
 <div>
 <span className="text-xs font-bold text-amber-900 dark:text-amber-200">
 No Active Shift Open (কোন শিফট চালু নেই)
 </span>
 <p className="text-[11px] text-amber-700 dark:text-amber-300">
 Select a counter and assign opening cash drawer float to track daily transactions and FEFO sales.
 </p>
 </div>
 </div>

 <div className="flex items-center gap-2">
 <Link
 href={route('counters.index')}
 className="text-xs text-amber-800 dark:text-amber-300 hover:underline flex items-center gap-1 font-medium px-2 py-1"
 >
 <span>Counter Directory</span>
 <ExternalLink className="h-3 w-3"/>
 </Link>
 <Button
 type="button"
 size="sm"
 variant="primary"
 onClick={onOpenShift}
 className="bg-[#5CB85C] hover:bg-[#449D44] border border-[#4CAE4C] hover:bg-[#e03d15] text-white gap-1 text-xs font-semibold py-1 px-3 rounded-[2px]"
 >
 <Play className="h-3.5 w-3.5 fill-current"/>
 Open Shift / Counter
 </Button>
 </div>
 </div>
 );
 }

 const session = activeCounter.current_session;
 const isOnBreak = activeCounter.status === 'on_break';

 return (
 <div className="mb-3 px-3 py-2 rounded-[2px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#12161c] flex flex-col md:flex-row md:items-center justify-between gap-2">
 {/* Left: Counter Info & Status */}
 <div className="flex items-center gap-2.5 flex-wrap">
 <div className="flex items-center gap-1.5">
 <span
 className={`w-2 h-2 rounded-full ${
 isOnBreak
 ? 'bg-amber-500 animate-pulse'
 : 'bg-emerald-500'
 }`}
 />
 <div className="flex items-baseline gap-1.5">
 <span className="text-xs font-extrabold text-slate-900 dark:text-white">
 {activeCounter.code}
 </span>
 <span className="text-xs text-slate-600 dark:text-slate-300 font-medium">
 {activeCounter.name}
 </span>
 <span className="text-[10px] px-1.5 py-0.2 rounded-[2px] font-bold tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-500">
 {activeCounter.type}
 </span>
 </div>
 </div>

 <div className="h-3 w-px bg-slate-200 dark:bg-slate-800 hidden sm:block"/>

 {/* Cashier Badge */}
 <div className="flex items-center gap-1 text-xs text-slate-600 dark:text-slate-400">
 <User className="h-3.5 w-3.5 text-slate-400"/>
 <span>Cashier:</span>
 <strong className="text-slate-800 dark:text-slate-200">
 {activeCounter.current_user_name || 'Assigned'}
 </strong>
 </div>

 {/* Drawer Cash Info */}
 {session && (
 <div className="flex items-center gap-2 text-xs">
 <div className="flex items-center gap-1 px-2 py-0.5 rounded-[2px] bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800 text-slate-700 dark:text-slate-300">
 <span className="text-[11px] text-slate-400">Drawer Cash:</span>
 <strong className="font-semibold text-slate-900 dark:text-white">
 {formatCurrency(session.system_expected_cash, currency)}
 </strong>
 </div>
 <div className="hidden lg:flex items-center gap-1 px-2 py-0.5 rounded-[2px] bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-900/40 text-emerald-700 dark:text-emerald-300">
 <span className="text-[11px]">Shift Sales:</span>
 <strong className="font-semibold">
 {formatCurrency(session.total_sales_amount, currency)} ({session.total_transactions} bills)
 </strong>
 </div>
 </div>
 )}
 </div>

 {/* Right: Quick Operational Controls */}
 <div className="flex items-center gap-1.5 self-end md:self-auto">
 <Link
 href={route('counters.index')}
 className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-[2px] transition-colors"
 title="View all counters"
 >
 <Layers className="h-3.5 w-3.5"/>
 </Link>

 <Button
 type="button"
 size="sm"
 variant="outline"
 onClick={onTakeBreak}
 className="gap-1 text-xs h-7.5"
 >
 <Coffee className="h-3.5 w-3.5"/>
 <span>Take Break</span>
 </Button>

 <Button
 type="button"
 size="sm"
 variant="danger"
 onClick={onCloseShift}
 className="gap-1 text-xs h-7.5"
 >
 <LogOut className="h-3.5 w-3.5"/>
 <span>Close Shift</span>
 </Button>
 </div>
 </div>
 );
}
