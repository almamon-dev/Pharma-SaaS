import React, { useEffect, useState } from 'react';
import { router } from '@inertiajs/react';
import {
    Clock,
    Coffee,
    KeyRound,
    Lock,
    Play,
    ShieldCheck,
    Utensils,
} from 'lucide-react';
import { Button } from '@/Components/ui/Button';
import { Input } from '@/Components/ui/Input';
import { PosCounterData } from './PosShiftModals';

interface PosBreakLockOverlayProps {
    counter: PosCounterData;
    onUnlocked?: () => void;
}

export function PosBreakLockOverlay({ counter, onUnlocked }: PosBreakLockOverlayProps) {
    const [pin, setPin] = useState('');
    const [error, setError] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [elapsedSeconds, setElapsedSeconds] = useState(0);

    // Live timer
    useEffect(() => {
        const startTime = counter.break_started_at ? new Date(counter.break_started_at).getTime() : Date.now();
        const updateTimer = () => {
            const diff = Math.max(0, Math.floor((Date.now() - startTime) / 1000));
            setElapsedSeconds(diff);
        };
        updateTimer();
        const interval = setInterval(updateTimer, 1000);
        return () => clearInterval(interval);
    }, [counter.break_started_at]);

    const formatTimer = (totalSecs: number) => {
        const mins = Math.floor(totalSecs / 60);
        const secs = totalSecs % 60;
        return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    };

    const handleUnlock = (e: React.FormEvent) => {
        e.preventDefault();
        if (!pin) {
            setError('Please enter your 4-digit PIN or password.');
            return;
        }

        setError('');
        setSubmitting(true);
        router.post(
            route('counters.resume-service', counter.id),
            { pin },
            {
                onSuccess: () => {
                    setSubmitting(false);
                    setPin('');
                    onUnlocked?.();
                },
                onError: (errs) => {
                    setSubmitting(false);
                    setError(Object.values(errs)[0] || 'Incorrect PIN or password.');
                },
            }
        );
    };

    const getBreakDetails = () => {
        switch (counter.current_break_reason) {
            case 'prayer':
                return { label: 'Prayer / Namaz Break (নামাজ বিরতি)', icon: Clock, color: 'text-emerald-500' };
            case 'lunch':
                return { label: 'Lunch / Dinner Break (খাবারের বিরতি)', icon: Utensils, color: 'text-orange-500' };
            case 'audit':
                return { label: 'Cash Drawer Tally / Audit (ক্যাশ অডিট)', icon: ShieldCheck, color: 'text-blue-500' };
            case 'tea':
            default:
                return { label: 'Tea Break (চা বিরতি)', icon: Coffee, color: 'text-amber-500' };
        }
    };

    const breakInfo = getBreakDetails();
    const BreakIcon = breakInfo.icon;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md">
            <div className="w-full max-w-sm rounded-[4px] bg-[#151921] border border-amber-500/30 p-6 text-center shadow-2xl relative overflow-hidden">
                {/* Top subtle glow */}
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 via-[#FF4A1F] to-amber-500" />

                <div className="mx-auto w-14 h-14 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-3">
                    <BreakIcon className={`h-7 w-7 ${breakInfo.color} animate-pulse`} />
                </div>

                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold mb-2">
                    <Lock className="h-3.5 w-3.5" />
                    <span>Terminal Locked · On Break</span>
                </div>

                <h3 className="text-base font-bold text-white mb-0.5">
                    {counter.code} - {counter.name}
                </h3>
                <p className="text-xs text-slate-400 mb-3">{breakInfo.label}</p>

                {/* Live Elapsed Time */}
                <div className="p-2.5 rounded-[4px] bg-[#12161c] border border-slate-800 mb-4 inline-block px-5">
                    <div className="text-[10px] uppercase font-semibold text-slate-500 tracking-wider">
                        Elapsed Time
                    </div>
                    <div className="text-xl font-mono font-extrabold text-amber-400">
                        {formatTimer(elapsedSeconds)}
                    </div>
                </div>

                {/* Unlock Form */}
                <form onSubmit={handleUnlock} className="space-y-3">
                    <div>
                        <Input
                            type="password"
                            maxLength={20}
                            value={pin}
                            onChange={(e) => setPin(e.target.value)}
                            placeholder="Enter Cashier PIN or Password"
                            autoFocus
                            icon={<KeyRound className="h-4 w-4 text-slate-400" />}
                            className="h-[38px] border-slate-700 bg-[#12161c] text-sm text-center font-bold tracking-widest text-white placeholder:text-slate-500 placeholder:tracking-normal focus:border-[#FF4A1F]"
                        />
                        {error && (
                            <p className="text-xs text-rose-400 font-medium mt-1.5">{error}</p>
                        )}
                    </div>

                    <Button
                        type="submit"
                        variant="primary"
                        disabled={submitting || !pin}
                        className="w-full bg-[#FF4A1F] hover:bg-[#e03d15] text-white py-2 font-semibold text-xs gap-1.5 rounded-[4px]"
                    >
                        <Play className="h-3.5 w-3.5 fill-current" />
                        {submitting ? 'Verifying PIN...' : 'Resume Sales (কাউন্টার চালু করুন)'}
                    </Button>
                </form>

                <p className="text-[10px] text-slate-500 mt-3">
                    Queue tokens are currently bypassed. Enter your 4-digit PIN to reopen queue tickets.
                </p>
            </div>
        </div>
    );
}
