/**
 * @file EducationalAudioPlayer.tsx
 * @description Interactive educational audio player with localized speed controls.
 * Adapts visual states based on user track assignment and archive locks.
 * @module panel/materials/EducationalAudioPlayer
 */

import React, { useRef, useState } from 'react';
import { PlayCircle, Lock, FastForward } from 'lucide-react';
import type { Track } from '../../../shared/types';

interface EducationalAudioPlayerProps {
    track: Track;
    isMyTrack: boolean;
    isLocked: boolean;
    onPlay: (e: React.SyntheticEvent<HTMLAudioElement>) => void;
}

export function EducationalAudioPlayer({ track, isMyTrack, isLocked, onPlay }: EducationalAudioPlayerProps): React.JSX.Element {
    const audioRef = useRef<HTMLAudioElement>(null);
    const [speed, setSpeed] = useState<number>(1);

    const changeSpeed = (newSpeed: number) => {
        if (audioRef.current) {
            audioRef.current.playbackRate = newSpeed;
            setSpeed(newSpeed);
        }
    };

    const activeContainerStyles = isMyTrack && !isLocked 
        ? 'border-emerald-300 ring-2 ring-emerald-500/20 shadow-[0_4px_14px_rgba(16,185,129,0.1)]' 
        : 'border-stone-200/80 hover:shadow-md';

    const activeBadgeStyles = isLocked 
        ? 'bg-stone-100 text-stone-400 border-stone-200' 
        : isMyTrack 
            ? 'bg-emerald-500 text-white border-emerald-600' 
            : 'bg-emerald-50 text-emerald-700 border-emerald-100';

    return (
        <div className={`bg-white/80 backdrop-blur-sm p-4 rounded-xl border flex flex-col xl:flex-row xl:items-center justify-between gap-4 transition-all duration-300 ${activeContainerStyles}`}>
            <div className="flex items-center gap-3">
                <span className={`text-[10px] uppercase tracking-widest font-bold antialiased px-3 py-1.5 rounded-lg border flex items-center gap-2 w-max ${activeBadgeStyles}`}>
                    {isLocked ? <Lock size={14} aria-hidden="true" /> : <PlayCircle size={14} aria-hidden="true" />} 
                    {track.voice_part_display || track.voice_part}
                    {isMyTrack && !isLocked && " (Twój głos)"}
                </span>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-3 w-full xl:w-auto">
                <audio 
                    ref={audioRef}
                    controls 
                    controlsList="nodownload" 
                    src={track.audio_file}
                    className={`h-9 w-full sm:w-64 outline-none rounded-lg ${isLocked ? 'opacity-50 grayscale pointer-events-none' : ''}`} 
                    preload="none" 
                    onPlay={onPlay}
                />

                {!isLocked && (
                    <div className="flex items-center bg-stone-100/80 p-1 rounded-lg border border-stone-200/60 shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)]">
                        <FastForward size={14} className="text-stone-400 mx-2" aria-hidden="true" />
                        {[0.5, 0.75, 1].map(rate => (
                            <button 
                                key={rate}
                                onClick={() => changeSpeed(rate)}
                                className={`px-2.5 py-1 text-[9px] font-bold antialiased rounded-md transition-all active:scale-95 ${speed === rate ? 'bg-white text-[#002395] shadow-sm border border-stone-200/60' : 'text-stone-500 hover:text-stone-800 border border-transparent'}`}
                                title={`Ustaw tempo na ${rate}x`}
                            >
                                {rate}x
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
