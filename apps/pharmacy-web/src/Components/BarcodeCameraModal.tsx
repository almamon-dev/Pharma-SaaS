import React, { useCallback, useEffect, useRef, useState } from 'react';
import type {
    BrowserMultiFormatReader,
    IScannerControls,
} from '@zxing/browser';
import {
    Camera,
    ImageUp,
    RefreshCw,
    ScanBarcode,
    X,
} from 'lucide-react';
import { Button } from '@/Components/ui/Button';

export interface BarcodeScanFeedback {
    ok: boolean;
    tone: 'success' | 'warning' | 'error';
    message: string;
}

interface BarcodeCameraModalProps {
    open: boolean;
    onClose: () => void;
    onDetected: (code: string) => BarcodeScanFeedback | void;
    title?: string;
    subtitle?: string;
    allowContinuous?: boolean;
    defaultContinuous?: boolean;
}

let releaseZxingStreams: (() => void) | null = null;

async function createBarcodeReader(): Promise<{
    reader: BrowserMultiFormatReader;
    listDevices: () => Promise<MediaDeviceInfo[]>;
}> {
    const [{ BrowserCodeReader, BrowserMultiFormatReader }, { BarcodeFormat, DecodeHintType }] =
        await Promise.all([
            import('@zxing/browser'),
            import('@zxing/library'),
        ]);

    releaseZxingStreams = () => BrowserCodeReader.releaseAllStreams();

    const hints = new Map<unknown, unknown>();
    hints.set(DecodeHintType.POSSIBLE_FORMATS, [
        BarcodeFormat.EAN_13,
        BarcodeFormat.EAN_8,
        BarcodeFormat.UPC_A,
        BarcodeFormat.UPC_E,
        BarcodeFormat.CODE_128,
        BarcodeFormat.CODE_39,
        BarcodeFormat.CODE_93,
        BarcodeFormat.ITF,
        BarcodeFormat.CODABAR,
        BarcodeFormat.DATA_MATRIX,
        BarcodeFormat.QR_CODE,
    ]);
    hints.set(DecodeHintType.TRY_HARDER, true);

    const reader = new BrowserMultiFormatReader(hints as Map<never, unknown>, {
        delayBetweenScanAttempts: 180,
        delayBetweenScanSuccess: 900,
    });

    return {
        reader,
        listDevices: () => BrowserCodeReader.listVideoInputDevices(),
    };
}

function playScanBeep(success = true) {
    try {
        const AudioCtx =
            window.AudioContext ||
            (window as unknown as { webkitAudioContext?: typeof AudioContext })
                .webkitAudioContext;
        if (!AudioCtx) return;
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = success ? 1040 : 420;
        gain.gain.value = 0.06;
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        window.setTimeout(() => {
            osc.stop();
            ctx.close().catch(() => undefined);
        }, 75);
    } catch {
        // Ignore audio errors on locked contexts
    }
}

export const BarcodeCameraModal: React.FC<BarcodeCameraModalProps> = ({
    open,
    onClose,
    onDetected,
    title = 'Scan Barcode with Camera',
    subtitle = 'Hold the medicine box or strip barcode steady inside the frame',
    allowContinuous = false,
    defaultContinuous = false,
}) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const controlsRef = useRef<IScannerControls | null>(null);
    const onDetectedRef = useRef(onDetected);
    const onCloseRef = useRef(onClose);
    const lastHitRef = useRef<{ code: string; at: number } | null>(null);

    const [continuous, setContinuous] = useState(defaultContinuous);
    const continuousRef = useRef(continuous);

    const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
    const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
    const [cameraState, setCameraState] = useState<
        'idle' | 'starting' | 'active' | 'error'
    >('idle');
    const [cameraError, setCameraError] = useState<string | null>(null);
    const [feedback, setFeedback] = useState<BarcodeScanFeedback | null>(null);

    onDetectedRef.current = onDetected;
    onCloseRef.current = onClose;
    continuousRef.current = continuous;

    const stopCamera = useCallback(() => {
        try {
            controlsRef.current?.stop();
        } catch {
            // Ignore cleanup errors
        }
        controlsRef.current = null;

        try {
            releaseZxingStreams?.();
        } catch {
            // Ignore cleanup errors
        }

        const videoEl = videoRef.current;
        if (videoEl?.srcObject) {
            const stream = videoEl.srcObject as MediaStream;
            stream.getTracks().forEach((track) => track.stop());
            videoEl.srcObject = null;
        }
    }, []);

    const handleDecodedText = useCallback(
        (rawText: string) => {
            const cleaned = rawText.trim();
            if (!cleaned) return;

            const now = Date.now();
            const prev = lastHitRef.current;
            if (prev && prev.code === cleaned && now - prev.at < 1600) {
                return;
            }
            if (prev && now - prev.at < 900) {
                return;
            }
            lastHitRef.current = { code: cleaned, at: now };

            const result = onDetectedRef.current(cleaned);
            playScanBeep(result ? result.ok : true);

            if (result) {
                setFeedback(result);
            } else {
                setFeedback({
                    ok: true,
                    tone: 'success',
                    message: `Detected barcode: ${cleaned}`,
                });
            }

            if (!continuousRef.current) {
                window.setTimeout(() => {
                    stopCamera();
                    onCloseRef.current();
                }, 140);
            }
        },
        [stopCamera]
    );

    const startCamera = useCallback(async () => {
        const videoEl = videoRef.current;
        if (!open || !videoEl) return;

        stopCamera();
        setCameraError(null);
        setCameraState('starting');

        if (!navigator.mediaDevices?.getUserMedia) {
            setCameraState('error');
            setCameraError(
                'Camera access requires HTTPS or localhost, or a browser with webcam support. You can still upload/scan a barcode photo below.'
            );
            return;
        }

        try {
            const { reader, listDevices } = await createBarcodeReader();
            let controls: IScannerControls;

            if (selectedDeviceId) {
                controls = await reader.decodeFromVideoDevice(
                    selectedDeviceId,
                    videoEl,
                    (result) => {
                        if (result) {
                            handleDecodedText(result.getText());
                        }
                    }
                );
            } else {
                controls = await reader.decodeFromConstraints(
                    {
                        video: {
                            facingMode: { ideal: 'environment' },
                            width: { ideal: 1280 },
                            height: { ideal: 720 },
                        },
                    },
                    videoEl,
                    (result) => {
                        if (result) {
                            handleDecodedText(result.getText());
                        }
                    }
                );
            }

            controlsRef.current = controls;
            setCameraState('active');

            try {
                const list = await listDevices();
                setDevices(list);
                if (!selectedDeviceId && list.length > 0) {
                    const activeTrack = (
                        videoEl.srcObject as MediaStream | null
                    )?.getVideoTracks()?.[0];
                    const activeId = activeTrack?.getSettings()?.deviceId;
                    if (activeId) {
                        setSelectedDeviceId(activeId);
                    }
                }
            } catch {
                // Device enumeration is optional
            }
        } catch (err) {
            stopCamera();
            setCameraState('error');
            const msg =
                err instanceof Error
                    ? err.message
                    : 'Unable to access camera.';
            setCameraError(
                `${msg} Ensure browser camera permission is granted, or upload a barcode image below.`
            );
        }
    }, [open, selectedDeviceId, handleDecodedText, stopCamera]);

    useEffect(() => {
        if (!open) {
            stopCamera();
            setFeedback(null);
            setCameraError(null);
            setCameraState('idle');
            lastHitRef.current = null;
            return;
        }

        setContinuous(defaultContinuous);
        startCamera();

        return () => {
            stopCamera();
        };
    }, [open, defaultContinuous, startCamera, stopCamera]);

    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                stopCamera();
                onClose();
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [open, onClose, stopCamera]);

    const handleImageScan = async (
        e: React.ChangeEvent<HTMLInputElement>
    ) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;

        const objectUrl = URL.createObjectURL(file);
        try {
            const { reader } = await createBarcodeReader();
            const result = await reader.decodeFromImageUrl(objectUrl);
            handleDecodedText(result.getText());
        } catch {
            playScanBeep(false);
            setFeedback({
                ok: false,
                tone: 'error',
                message: 'Could not detect a readable barcode in that image.',
            });
        } finally {
            URL.revokeObjectURL(objectUrl);
        }
    };

    if (!open) return null;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4"
            onClick={() => {
                stopCamera();
                onClose();
            }}
        >
            <div
                className="w-full max-w-md rounded-[4px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#12161c] shadow-2xl overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-start justify-between gap-3 px-4 py-3 border-b border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-[#151921]">
                    <div className="flex items-center gap-2 min-w-0">
                        <div className="h-8 w-8 rounded-[2px] bg-[#EAF5F0] dark:bg-[#0E5F3F]/15 text-[#0E5F3F] flex items-center justify-center shrink-0">
                            <Camera className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                            <h3 className="text-[13px] font-bold text-slate-900 dark:text-slate-100 truncate">
                                {title}
                            </h3>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                                {subtitle}
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={() => {
                            stopCamera();
                            onClose();
                        }}
                        aria-label="Close camera scanner"
                        className="rounded-[2px] p-1 text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-800 hover:text-slate-700 cursor-pointer"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>

                {/* Live Camera Viewport */}
                <div className="p-4 space-y-3">
                    <div className="relative aspect-[4/3] w-full rounded-[2px] overflow-hidden bg-slate-950 border border-slate-800 flex items-center justify-center">
                        <video
                            ref={videoRef}
                            muted
                            playsInline
                            autoPlay
                            className="h-full w-full object-cover"
                        />

                        {/* Viewfinder Guide */}
                        {cameraState !== 'error' && (
                            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                                <div className="relative w-3/4 h-1/2 rounded-[2px] border border-white/25 shadow-[0_0_0_9999px_rgba(2,6,23,0.42)]">
                                    <span className="absolute -top-0.5 -left-0.5 h-4 w-4 border-t-2 border-l-2 border-[#0E5F3F]" />
                                    <span className="absolute -top-0.5 -right-0.5 h-4 w-4 border-t-2 border-r-2 border-[#0E5F3F]" />
                                    <span className="absolute -bottom-0.5 -left-0.5 h-4 w-4 border-b-2 border-l-2 border-[#0E5F3F]" />
                                    <span className="absolute -bottom-0.5 -right-0.5 h-4 w-4 border-b-2 border-r-2 border-[#0E5F3F]" />
                                    <div className="absolute inset-x-3 top-1/2 h-[1.5px] bg-[#0E5F3F]/80 shadow-[0_0_8px_#0E5F3F]" />
                                </div>
                            </div>
                        )}

                        {cameraState === 'starting' && (
                            <div className="absolute inset-0 bg-slate-950/75 flex flex-col items-center justify-center gap-2 text-white text-xs">
                                <RefreshCw className="h-5 w-5 animate-spin text-[#0E5F3F]" />
                                <span>Starting camera stream...</span>
                            </div>
                        )}

                        {cameraState === 'error' && (
                            <div className="absolute inset-0 bg-slate-950/95 p-5 flex flex-col items-center justify-center text-center gap-3">
                                <ScanBarcode className="h-7 w-7 text-[#0E5F3F]" />
                                <p className="text-xs text-slate-300 leading-relaxed max-w-xs">
                                    {cameraError}
                                </p>
                                <div className="flex items-center gap-2">
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        onClick={() => startCamera()}
                                    >
                                        <RefreshCw className="h-3.5 w-3.5" />
                                        Retry Camera
                                    </Button>
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant="primary"
                                        onClick={() =>
                                            fileInputRef.current?.click()
                                        }
                                    >
                                        <ImageUp className="h-3.5 w-3.5" />
                                        Scan Image
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>

                    {feedback && (
                        <div
                            className={`rounded-[2px] border px-3 py-1.5 text-[11.5px] font-semibold ${
                                feedback.tone === 'success'
                                    ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900/50 text-emerald-700 dark:text-emerald-300'
                                    : feedback.tone === 'warning'
                                      ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900/50 text-amber-800 dark:text-amber-300'
                                      : 'bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-300'
                            }`}
                        >
                            {feedback.message}
                        </div>
                    )}

                    {/* Controls */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                            {devices.length > 1 && (
                                <select
                                    value={selectedDeviceId}
                                    onChange={(e) =>
                                        setSelectedDeviceId(e.target.value)
                                    }
                                    aria-label="Select camera device"
                                    className="h-8 max-w-[190px] truncate rounded-[2px] border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#1e2329] px-2 text-[11.5px] text-slate-700 dark:text-slate-200 focus:outline-none"
                                >
                                    {devices.map((d, idx) => (
                                        <option
                                            key={d.deviceId || idx}
                                            value={d.deviceId}
                                        >
                                            {d.label || `Camera ${idx + 1}`}
                                        </option>
                                    ))}
                                </select>
                            )}

                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                onChange={handleImageScan}
                                className="hidden"
                            />
                            <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => fileInputRef.current?.click()}
                                className="h-8 text-[11.5px]"
                            >
                                <ImageUp className="h-3.5 w-3.5" />
                                Scan Photo
                            </Button>
                        </div>

                        {allowContinuous && (
                            <label className="inline-flex items-center gap-1.5 text-[11.5px] font-medium text-slate-600 dark:text-slate-300 cursor-pointer select-none">
                                <input
                                    type="checkbox"
                                    checked={continuous}
                                    onChange={(e) =>
                                        setContinuous(e.target.checked)
                                    }
                                    className="table-checkbox"
                                />
                                Multi-scan
                            </label>
                        )}

                        <Button
                            type="button"
                            size="sm"
                            variant="primary"
                            onClick={() => {
                                stopCamera();
                                onClose();
                            }}
                            className="h-8 text-[11.5px]"
                        >
                            Done
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
};
