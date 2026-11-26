import React, { useMemo } from 'react';
import { Link } from '@inertiajs/react';
import {
 Banknote,
 Clock,
 Coffee,
 CreditCard,
 FileText,
 KeyRound,
 LogOut,
 Receipt,
 ShoppingCart,
 Smartphone,
 TrendingUp,
 User,
 Users,
 Wallet,
} from 'lucide-react';
import { Button } from '@/Components/ui/Button';
import { TableActionMenu, TableActionItem } from '@/Components/tables';
import { formatCurrency } from '@/lib/format';
import type { ExtendedCounterData } from '../Index';

export interface ShiftRecentOrder {
 id: number;
 invoice_number: string;
 customer_name: string;
 payment_method: string;
 total_amount: number;
 items_count: number;
 order_status: string;
 time?: string | null;
}

interface CashierShiftDashboardProps {
 counter: ExtendedCounterData;
 recentOrders: ShiftRecentOrder[];
 currency: string;
 roleLabel?: string;
 onCashMovement: () => void;
 onOpenXReport: (sessionId: number) => void;
 onTakeBreak: () => void;
 onResumeShift: () => void;
 onCloseShift: () => void;
}

function formatElapsed(openedAtIso?: string | null): string {
 if (!openedAtIso) return 'Just started';
 const started = new Date(openedAtIso).getTime();
 if (Number.isNaN(started)) return 'Running';
 const diffMinutes = Math.max(0, Math.floor((Date.now() - started) / 60000));
 const hours = Math.floor(diffMinutes / 60);
 const mins = diffMinutes % 60;
 if (hours === 0) return `${mins}m elapsed`;
 return `${hours}h ${mins}m elapsed`;
}

export const CashierShiftDashboard: React.FC<CashierShiftDashboardProps> = ({
 counter,
 recentOrders,
 currency,
 roleLabel = 'Cashier',
 onCashMovement,
 onOpenXReport,
 onTakeBreak,
 onResumeShift,
 onCloseShift,
}) => {
 const session = counter.current_session;
 const isActive = counter.status === 'active';
 const isOnBreak = counter.status === 'on_break';

 const openingFloat = Number(session?.opening_float ?? 0);
 const drawerCash = Number(session?.system_expected_cash ?? openingFloat);
 const shiftSales = Number(session?.total_sales_amount ?? 0);
 const totalOrders = Number(session?.total_transactions ?? 0);
 const queueCount = Number(counter.active_queue_count ?? 0);
 const maxCapacity = Number(counter.max_queue_capacity ?? 20);
 const queuePercent = maxCapacity > 0 ? Math.min(100, (queueCount / maxCapacity) * 100) : 0;
 const isQueueFull = queueCount >= maxCapacity;

 const shiftName = session?.shift
 ? session.shift.charAt(0).toUpperCase() + session.shift.slice(1)
 : 'Morning';
 const startedDisplay = session?.opened_at_display || session?.opened_at_time || '—';
 const elapsedText = useMemo(() => formatElapsed(session?.opened_at), [session?.opened_at]);

 const paymentMethods = useMemo(() => {
 const pb = session?.payment_breakdown;
 const cashAmt = Number(pb?.cash ?? session?.cash_sales ?? 0);
 const cardAmt = Number(pb?.card ?? session?.card_sales ?? 0);
 const bkashAmt = Number(pb?.bkash ?? 0);
 const nagadAmt = Number(pb?.nagad ?? 0);
 const totalMethodSales = cashAmt + cardAmt + bkashAmt + nagadAmt;

 const rows = [
 {
 key: 'cash',
 label: 'Cash',
 amount: cashAmt,
 percent: totalMethodSales > 0 ? (cashAmt / totalMethodSales) * 100 : 0,
 barColor: 'bg-[#0E5F3F]',
 icon: Banknote,
 iconColor: 'text-[#0E5F3F] dark:text-emerald-400',
 },
 {
 key: 'card',
 label: 'Card',
 amount: cardAmt,
 percent: totalMethodSales > 0 ? (cardAmt / totalMethodSales) * 100 : 0,
 barColor: 'bg-[#337AB7]',
 icon: CreditCard,
 iconColor: 'text-[#337AB7] dark:text-sky-400',
 },
 {
 key: 'bkash',
 label: 'bKash',
 amount: bkashAmt,
 percent: totalMethodSales > 0 ? (bkashAmt / totalMethodSales) * 100 : 0,
 barColor: 'bg-pink-600',
 icon: Smartphone,
 iconColor: 'text-pink-600 dark:text-pink-400',
 },
 {
 key: 'nagad',
 label: 'Nagad',
 amount: nagadAmt,
 percent: totalMethodSales > 0 ? (nagadAmt / totalMethodSales) * 100 : 0,
 barColor: 'bg-amber-600',
 icon: Smartphone,
 iconColor: 'text-amber-600 dark:text-amber-400',
 },
 ];

 const highest =
 totalMethodSales > 0
 ? rows.reduce((best, item) => (item.amount > best.amount ? item : best), rows[0])
 : null;

 return { rows, totalMethodSales, highest };
 }, [session]);

 const actionItems: TableActionItem[] = isOnBreak
 ? [
 {
 key: 'resume-shift',
 label: 'Resume Shift (PIN)',
 icon: <KeyRound className="h-3.5 w-3.5 text-amber-600"/>,
 onClick: onResumeShift,
 },
 {
 key: 'close-shift',
 label: 'Close Shift',
 icon: <LogOut className="h-3.5 w-3.5 text-rose-600"/>,
 variant: 'danger',
 onClick: onCloseShift,
 },
 ]
 : [
 {
 key: 'cash-movement',
 label: 'Cash In / Out / Refund',
 icon: <Wallet className="h-3.5 w-3.5 text-[#0E5F3F]"/>,
 onClick: onCashMovement,
 },
 ...(session
 ? [
 {
 key: 'x-report',
 label: 'Live X-Report',
 icon: <FileText className="h-3.5 w-3.5 text-[#337AB7]"/>,
 onClick: () => onOpenXReport(session.id),
 },
 ]
 : []),
 {
 key: 'take-break',
 label: 'Take Break',
 icon: <Coffee className="h-3.5 w-3.5 text-amber-600"/>,
 onClick: onTakeBreak,
 },
 {
 key: 'close-shift',
 label: 'Close Shift',
 icon: <LogOut className="h-3.5 w-3.5 text-rose-600"/>,
 variant: 'danger',
 onClick: onCloseShift,
 },
 ];

 return (
 <div className="space-y-3.5">
 {/* Row 1: 4 Equal-Height Full-Width KPI Cards */}
 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 items-stretch">
 {/* KPI 1: Drawer Cash */}
 <div className="h-full rounded-[2px] border border-[#D5DBD3] dark:border-slate-800 bg-white dark:bg-[#12161c] p-4 flex flex-col justify-between">
 <div className="flex items-center justify-between gap-2">
 <span className="text-[11px] font-bold tracking-wider text-[#555555] dark:text-slate-400">
 Drawer Cash
 </span>
 <span className="h-7 w-7 rounded-[2px] bg-[#EAF5F0] dark:bg-[#0E5F3F]/20 text-[#0E5F3F] dark:text-emerald-400 flex items-center justify-center shrink-0">
 <Wallet className="h-3.5 w-3.5"/>
 </span>
 </div>
 <div className="mt-2.5">
 <div className="tabular-nums text-xl font-bold text-[#222222] dark:text-white tracking-tight">
 {formatCurrency(drawerCash, currency)}
 </div>
 <p className="mt-1 text-[11px] text-[#555555] dark:text-slate-400">
 Opening float{' '}
 <span className="tabular-nums font-semibold text-[#333333] dark:text-slate-200">
 {formatCurrency(openingFloat, currency)}
 </span>
 </p>
 </div>
 </div>

 {/* KPI 2: Shift Sales */}
 <div className="h-full rounded-[2px] border border-[#D5DBD3] dark:border-slate-800 bg-white dark:bg-[#12161c] p-4 flex flex-col justify-between">
 <div className="flex items-center justify-between gap-2">
 <span className="text-[11px] font-bold tracking-wider text-[#555555] dark:text-slate-400">
 Shift Sales
 </span>
 <span className="h-7 w-7 rounded-[2px] bg-[#EAF5F0] dark:bg-[#0E5F3F]/20 text-[#0E5F3F] dark:text-emerald-400 flex items-center justify-center shrink-0">
 <TrendingUp className="h-3.5 w-3.5"/>
 </span>
 </div>
 <div className="mt-2.5">
 <div className="tabular-nums text-xl font-bold text-[#0E5F3F] dark:text-emerald-400 tracking-tight">
 {formatCurrency(shiftSales, currency)}
 </div>
 <p className="mt-1 text-[11px] text-[#555555] dark:text-slate-400">
 <span className="tabular-nums font-semibold text-[#333333] dark:text-slate-200">
 {totalOrders}
 </span>{' '}
 {totalOrders === 1 ? 'order completed' : 'orders completed'}
 </p>
 </div>
 </div>

 {/* KPI 3: Active Queue */}
 <div className="h-full rounded-[2px] border border-[#D5DBD3] dark:border-slate-800 bg-white dark:bg-[#12161c] p-4 flex flex-col justify-between">
 <div className="flex items-center justify-between gap-2">
 <span className="text-[11px] font-bold tracking-wider text-[#555555] dark:text-slate-400">
 Active Queue
 </span>
 <span className="h-7 w-7 rounded-[2px] bg-sky-50 dark:bg-sky-950/40 text-[#337AB7] dark:text-sky-400 flex items-center justify-center shrink-0">
 <Users className="h-3.5 w-3.5"/>
 </span>
 </div>
 <div className="mt-2.5">
 <div className="flex items-baseline justify-between gap-2">
 <span
 className={`tabular-nums text-xl font-bold tracking-tight ${
 isQueueFull
 ? 'text-rose-600 dark:text-rose-400'
 : 'text-[#222222] dark:text-white'
 }`}
 >
 {queueCount} / {maxCapacity}
 </span>
 <span className="text-[10.5px] font-semibold text-[#555555] dark:text-slate-400">
 {isQueueFull ? 'Full' : queueCount === 0 ? 'Idle' : 'Serving'}
 </span>
 </div>
 <div className="mt-2 h-1.5 w-full rounded-full bg-[#EAECE9] dark:bg-slate-800 overflow-hidden">
 <div
 className={`h-full transition-all duration-300 ${
 isQueueFull
 ? 'bg-rose-500'
 : queuePercent > 70
 ? 'bg-amber-500'
 : 'bg-[#0E5F3F]'
 }`}
 style={{ width: `${queuePercent}%` }}
 />
 </div>
 </div>
 </div>

 {/* KPI 4: Shift Running Since */}
 <div className="h-full rounded-[2px] border border-[#D5DBD3] dark:border-slate-800 bg-white dark:bg-[#12161c] p-4 flex flex-col justify-between">
 <div className="flex items-center justify-between gap-2">
 <span className="text-[11px] font-bold tracking-wider text-[#555555] dark:text-slate-400">
 Shift Running Since
 </span>
 <span className="h-7 w-7 rounded-[2px] bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 flex items-center justify-center shrink-0">
 <Clock className="h-3.5 w-3.5"/>
 </span>
 </div>
 <div className="mt-2.5">
 <div className="tabular-nums text-[14px] font-bold text-[#222222] dark:text-white leading-snug">
 {startedDisplay}
 </div>
 <p className="mt-1 text-[11px] text-[#555555] dark:text-slate-400 flex items-center gap-1.5">
 <span className="font-semibold text-[#0E5F3F] dark:text-emerald-400">
 {shiftName} Shift
 </span>
 <span>·</span>
 <span className="tabular-nums">{elapsedText}</span>
 </p>
 </div>
 </div>
 </div>

 {/* Row 2: 3 Equal-Height Columns */}
 <div className="grid grid-cols-1 lg:grid-cols-3 gap-3.5 items-stretch">
 {/* Column 1: Current Shift Terminal Card */}
 <div className="h-full rounded-[2px] border border-[#D5DBD3] dark:border-slate-800 bg-white dark:bg-[#12161c] flex flex-col justify-between overflow-hidden">
 <div>
 <div className="px-4 py-3 border-b border-[#E2E6E1] dark:border-slate-800 bg-[#F5F7F4] dark:bg-[#151921] flex items-start justify-between gap-2">
 <div className="flex items-start gap-2.5 min-w-0">
 <span className="px-2 py-0.5 rounded-[2px] bg-[#0E5F3F] text-white tabular-nums font-bold text-xs shrink-0 mt-0.5">
 {counter.code}
 </span>
 <div className="min-w-0">
 <h3 className="text-sm font-bold text-[#222222] dark:text-white leading-snug truncate">
 {counter.name}
 </h3>
 <p className="text-[11px] text-[#555555] dark:text-slate-400 mt-0.5 truncate">
 <span className="font-semibold tracking-wide">
 {counter.type}
 </span>
 {counter.location && <span> · {counter.location}</span>}
 {counter.zone && <span> · {counter.zone}</span>}
 </p>
 </div>
 </div>

 <div className="flex items-center gap-1.5 shrink-0">
 <span
 className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-[2px] text-[10px] font-bold border ${
 isActive
 ? 'bg-[#EAF5F0] text-[#0E5F3F] border-[#0E5F3F]/30 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800'
 : 'bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800'
 }`}
 >
 <span
 className={`w-1.5 h-1.5 rounded-full ${
 isActive ? 'bg-[#0E5F3F] dark:bg-emerald-400' : 'bg-amber-500'
 }`}
 />
 {isActive ? 'OPEN' : 'ON BREAK'}
 </span>
 <TableActionMenu items={actionItems} label={`${counter.code} shift actions`} />
 </div>
 </div>

 <div className="p-4 divide-y divide-[#ECEFEA] dark:divide-slate-800/80 text-xs">
 <div className="py-2 first:pt-0 flex items-center justify-between gap-2">
 <span className="text-[#555555] dark:text-slate-400 flex items-center gap-1.5">
 <User className="h-3.5 w-3.5 text-[#777777] dark:text-slate-500"/>
 Cashier
 </span>
 <span className="font-semibold text-[#222222] dark:text-white text-right">
 {session?.user_name || counter.current_user?.name || 'Staff'}
 <span className="ml-1.5 text-[10px] font-medium px-1.5 py-0.5 rounded-[2px] bg-[#EAECE9] dark:bg-slate-800 text-[#555555] dark:text-slate-300">
 {roleLabel}
 </span>
 </span>
 </div>
 <div className="py-2 flex items-center justify-between gap-2">
 <span className="text-[#555555] dark:text-slate-400">Shift</span>
 <span className="font-semibold text-[#222222] dark:text-white">
 {shiftName}
 </span>
 </div>
 <div className="py-2 flex items-center justify-between gap-2">
 <span className="text-[#555555] dark:text-slate-400">Started</span>
 <span className="tabular-nums font-medium text-[#333333] dark:text-slate-200">
 {startedDisplay}
 </span>
 </div>
 <div className="py-2 flex items-center justify-between gap-2">
 <span className="text-[#555555] dark:text-slate-400">Opening Float</span>
 <span className="tabular-nums font-bold text-[#222222] dark:text-white">
 {formatCurrency(openingFloat, currency)}
 </span>
 </div>
 <div className="py-2 last:pb-0 flex items-center justify-between gap-2">
 <span className="text-[#555555] dark:text-slate-400">Shift Sales</span>
 <span className="tabular-nums font-bold text-[#0E5F3F] dark:text-emerald-400">
 {formatCurrency(shiftSales, currency)}{' '}
 <span className="text-[11px] font-medium text-[#555555] dark:text-slate-400">
 ({totalOrders} {totalOrders === 1 ? 'order' : 'orders'})
 </span>
 </span>
 </div>
 </div>
 </div>

 <div className="px-4 py-3 border-t border-[#E2E6E1] dark:border-slate-800 bg-[#F9FAF8] dark:bg-[#151921]/60 grid grid-cols-2 gap-2">
 {isActive ? (
 <Link href={route('pos.index', undefined, false)} className="w-full">
 <Button
 type="button"
 variant="primary"
 size="sm"
 className="w-full justify-center text-xs rounded-[2px]"
 >
 <ShoppingCart className="h-3.5 w-3.5"/>
 <span>Open POS Terminal</span>
 </Button>
 </Link>
 ) : (
 <Button
 type="button"
 variant="primary"
 size="sm"
 onClick={onResumeShift}
 className="w-full justify-center text-xs rounded-[2px]"
 >
 <KeyRound className="h-3.5 w-3.5"/>
 <span>Resume Shift</span>
 </Button>
 )}
 <Button
 type="button"
 variant="outline"
 size="sm"
 onClick={onCloseShift}
 className="w-full justify-center text-xs rounded-[2px]"
 >
 <LogOut className="h-3.5 w-3.5"/>
 <span>Close Shift</span>
 </Button>
 </div>
 </div>

 {/* Column 2: Sales by Payment Method Card */}
 <div className="h-full rounded-[2px] border border-[#D5DBD3] dark:border-slate-800 bg-white dark:bg-[#12161c] flex flex-col justify-between overflow-hidden">
 <div>
 <div className="px-4 py-3 border-b border-[#E2E6E1] dark:border-slate-800 bg-[#F5F7F4] dark:bg-[#151921] flex items-center justify-between gap-2">
 <div>
 <h3 className="text-sm font-bold text-[#0E5F3F] dark:text-emerald-400">
 Sales by Payment Method
 </h3>
 <p className="text-[11px] text-[#555555] dark:text-slate-400 mt-0.5">
 Current shift collection breakdown
 </p>
 </div>
 <span className="tabular-nums text-xs font-bold px-2 py-0.5 rounded-[2px] bg-white dark:bg-[#12161c] border border-[#D5DBD3] dark:border-slate-700 text-[#222222] dark:text-white">
 {formatCurrency(paymentMethods.totalMethodSales, currency)}
 </span>
 </div>

 <div className="p-4 space-y-3.5">
 {paymentMethods.rows.map((method) => {
 const Icon = method.icon;
 return (
 <div key={method.key} className="space-y-1.5">
 <div className="flex items-center justify-between gap-2 text-xs">
 <span className="flex items-center gap-2 font-semibold text-[#333333] dark:text-slate-200">
 <Icon className={`h-3.5 w-3.5 ${method.iconColor}`} />
 {method.label}
 </span>
 <div className="flex items-center gap-2 tabular-nums">
 <span className="font-bold text-[#222222] dark:text-white">
 {formatCurrency(method.amount, currency)}
 </span>
 <span className="w-11 text-right text-[11px] text-[#555555] dark:text-slate-400">
 {method.percent.toFixed(1)}%
 </span>
 </div>
 </div>
 <div className="h-2 w-full rounded-full bg-[#EAECE9] dark:bg-slate-800 overflow-hidden">
 <div
 className={`h-full rounded-full transition-all duration-300 ${method.barColor}`}
 style={{
 width: `${method.amount > 0 ? Math.max(2, method.percent) : 0}%`,
 }}
 />
 </div>
 </div>
 );
 })}
 </div>
 </div>

 <div className="px-4 py-3 border-t border-[#E2E6E1] dark:border-slate-800 bg-[#F9FAF8] dark:bg-[#151921]/60 flex items-center justify-between text-xs">
 <span className="font-semibold text-[#555555] dark:text-slate-400">
 Highest method
 </span>
 {paymentMethods.highest ? (
 <span className="font-semibold text-[#0E5F3F] dark:text-emerald-400 flex items-center gap-1.5">
 <span>{paymentMethods.highest.label}</span>
 <span className="tabular-nums text-[#222222] dark:text-white">
 ({formatCurrency(paymentMethods.highest.amount, currency)} ·{' '}
 {paymentMethods.highest.percent.toFixed(0)}%)
 </span>
 </span>
 ) : (
 <span className="font-medium text-[#777777] dark:text-slate-500">
 No sales yet
 </span>
 )}
 </div>
 </div>

 {/* Column 3: Recent Orders Card */}
 <div className="h-full rounded-[2px] border border-[#D5DBD3] dark:border-slate-800 bg-white dark:bg-[#12161c] flex flex-col justify-between overflow-hidden">
 <div className="flex-1 flex flex-col">
 <div className="px-4 py-3 border-b border-[#E2E6E1] dark:border-slate-800 bg-[#F5F7F4] dark:bg-[#151921] flex items-center justify-between gap-2">
 <div>
 <h3 className="text-sm font-bold text-[#0E5F3F] dark:text-emerald-400">
 Recent Orders
 </h3>
 <p className="text-[11px] text-[#555555] dark:text-slate-400 mt-0.5">
 Latest bills processed in this shift
 </p>
 </div>
 <span className="tabular-nums text-[11px] font-bold px-2 py-0.5 rounded-[2px] bg-white dark:bg-[#12161c] border border-[#D5DBD3] dark:border-slate-700 text-[#333333] dark:text-slate-200">
 {recentOrders.length}
 </span>
 </div>

 {recentOrders.length === 0 ? (
 <div className="flex-1 p-6 flex flex-col items-center justify-center text-center">
 <div className="h-11 w-11 rounded-full bg-[#EAF5F0] dark:bg-[#0E5F3F]/20 text-[#0E5F3F] dark:text-emerald-400 flex items-center justify-center mb-3">
 <Receipt className="h-5 w-5"/>
 </div>
 <h4 className="text-xs font-bold text-[#222222] dark:text-white">
 No orders in this shift yet
 </h4>
 <p className="text-[11.5px] text-[#555555] dark:text-slate-400 mt-1 max-w-[230px]">
 Open the POS terminal to scan medicines and record your first sale.
 </p>
 {isActive && (
 <Link href={route('pos.index', undefined, false)} className="mt-4">
 <Button
 type="button"
 variant="primary"
 size="sm"
 className="text-xs rounded-[2px]"
 >
 <ShoppingCart className="h-3.5 w-3.5"/>
 <span>Start first sale</span>
 </Button>
 </Link>
 )}
 </div>
 ) : (
 <div className="divide-y divide-[#ECEFEA] dark:divide-slate-800/80 flex-1 overflow-y-auto max-h-[260px]">
 {recentOrders.map((order) => (
 <div
 key={order.id}
 className="px-4 py-2.5 flex items-center justify-between gap-2 hover:bg-[#F5F7F4] dark:hover:bg-slate-800/40 transition-colors"
 >
 <div className="min-w-0">
 <div className="flex items-center gap-1.5">
 <span className="tabular-nums text-xs font-bold text-[#0E5F3F] dark:text-emerald-400 truncate">
 {order.invoice_number}
 </span>
 <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded-[2px] bg-[#EAECE9] dark:bg-slate-800 text-[#555555] dark:text-slate-300">
 {order.payment_method}
 </span>
 </div>
 <p className="text-[11px] text-[#555555] dark:text-slate-400 truncate mt-0.5">
 {order.customer_name}
 {order.items_count > 0 && (
 <span>
 {' '}
 · <span className="tabular-nums">{order.items_count}</span>{' '}
 {order.items_count === 1 ? 'item' : 'items'}
 </span>
 )}
 </p>
 </div>
 <div className="text-right shrink-0">
 <div className="tabular-nums text-xs font-bold text-[#222222] dark:text-white">
 {formatCurrency(order.total_amount, currency)}
 </div>
 <div className="tabular-nums text-[10px] text-[#777777] dark:text-slate-500 mt-0.5">
 {order.time || '—'}
 </div>
 </div>
 </div>
 ))}
 </div>
 )}
 </div>

 <div className="px-4 py-3 border-t border-[#E2E6E1] dark:border-slate-800 bg-[#F9FAF8] dark:bg-[#151921]/60 flex items-center justify-between text-xs">
 <span className="text-[#555555] dark:text-slate-400">
 {recentOrders.length > 0
 ? `Showing latest ${recentOrders.length} ${recentOrders.length === 1 ? 'order' : 'orders'}`
 : 'Ready for billing'}
 </span>
 {isActive && (
 <Link
 href={route('pos.index', undefined, false)}
 className="font-semibold text-[#0E5F3F] dark:text-emerald-400 hover:underline"
 >
 Go to POS →
 </Link>
 )}
 </div>
 </div>
 </div>
 </div>
 );
};

export default CashierShiftDashboard;

