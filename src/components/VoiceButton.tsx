import { useState, useRef, useEffect, type ReactNode } from 'react';
import { Mic, MicOff, Volume2, VolumeX } from 'lucide-react';
import { useSpeechRecognition, useTextToSpeech } from '@/hooks/useSpeech';
import type { LanguageCode } from '@/lib/types';
import { t } from '@/lib/i18n';

interface VoiceButtonProps {
  lang: LanguageCode;
  onTranscript?: (text: string) => void;
  speakText?: string;
  className?: string;
  label?: string;
}

export function VoiceButton({
  lang,
  onTranscript,
  speakText,
  className = '',
  label,
}: VoiceButtonProps) {
  const { isListening, transcript, supported, startListening, stopListening, resetTranscript } =
    useSpeechRecognition(lang);

  const prevListeningRef = useRef(isListening);

  useEffect(() => {
    // If it was listening, and now it stopped (either auto-stopped or clicked)
    if (prevListeningRef.current && !isListening) {
      if (transcript.trim() && onTranscript) {
        onTranscript(transcript);
      }
      resetTranscript();
    }
    prevListeningRef.current = isListening;
  }, [isListening, transcript, onTranscript, resetTranscript]);

  const handleToggle = () => {
    if (isListening) {
      stopListening();
    } else {
      resetTranscript();
      startListening();
    }
  };

  if (!supported) {
    return (
      <div
        className={`flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-2 text-sm text-slate-400 ${className}`}
      >
        <MicOff className="h-4 w-4" />
        <span>{t(lang, 'voiceNotSupported')}</span>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <button
        onClick={handleToggle}
        className={`flex items-center gap-2 rounded-xl px-4 py-2.5 font-medium transition-all duration-200 ${
          isListening
            ? 'bg-red-500 text-white shadow-lg shadow-red-500/30 animate-pulse'
            : 'bg-teal-600 text-white hover:bg-teal-700 shadow-md shadow-teal-600/20'
        }`}
        aria-label={label ?? t(lang, 'tapToSpeak')}
      >
        {isListening ? (
          <MicOff className="h-5 w-5" />
        ) : (
          <Mic className="h-5 w-5" />
        )}
        <span className="text-sm">
          {isListening ? t(lang, 'listening') : label ?? t(lang, 'tapToSpeak')}
        </span>
      </button>
      {isListening && (
        <div className="flex items-center gap-1">
          {[0, 1, 2, 3].map((i) => (
            <span
              key={i}
              className="w-1 rounded-full bg-teal-500"
              style={{
                height: '20px',
                animation: `voiceWave 0.6s ease-in-out ${i * 0.15}s infinite alternate`,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface SpeakButtonProps {
  lang: LanguageCode;
  text: string;
  className?: string;
}

export function SpeakButton({ lang, text, className = '' }: SpeakButtonProps) {
  const { isSpeaking, supported, speak, stopSpeaking } = useTextToSpeech(lang);

  if (!supported) return null;

  return (
    <button
      onClick={() => (isSpeaking ? stopSpeaking() : speak(text))}
      className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
        isSpeaking
          ? 'bg-teal-100 text-teal-700'
          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
      } ${className}`}
      aria-label={t(lang, 'listenDescription')}
    >
      {isSpeaking ? (
        <VolumeX className="h-4 w-4" />
      ) : (
        <Volume2 className="h-4 w-4" />
      )}
      <span>{t(lang, 'listenDescription')}</span>
    </button>
  );
}
