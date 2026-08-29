import { useCallback, useEffect, useRef, useState } from 'react';
import type { UserProfile, ExtractedDocumentData } from '@/lib/types';

interface UploadedFile {
  id: string;
  name: string;
  type: string;
  size: number;
  dataUrl: string;
  analysis?: ExtractedDocumentData;
}

interface SessionState {
  sessionId: string;
  startTime: number;
  profile: UserProfile | null;
  uploadedFiles: UploadedFile[];
  isPurged: boolean;
}

const SESSION_TIMEOUT_MS = 15 * 60 * 1000;
const ACTIVITY_EVENTS: (keyof WindowEventMap)[] = [
  'mousedown',
  'keydown',
  'touchstart',
  'scroll',
];

export function useEphemeralSession() {
  const [state, setState] = useState<SessionState>({
    sessionId: crypto.randomUUID(),
    startTime: Date.now(),
    profile: null,
    uploadedFiles: [],
    isPurged: false,
  });

  const lastActivityRef = useRef(Date.now());
  const purgeRef = useRef<(() => void) | null>(null);

  const purge = useCallback(() => {
    setState((prev) => {
      if (prev.uploadedFiles.length > 0) {
        prev.uploadedFiles.forEach((f) => {
          if (f.dataUrl) {
            try {
              const arr = new Uint8Array(f.dataUrl.length);
            } catch {
              // ignore
            }
          }
        });
      }
      return {
        sessionId: '',
        startTime: 0,
        profile: null,
        uploadedFiles: [],
        isPurged: true,
      };
    });
  }, []);

  purgeRef.current = purge;

  useEffect(() => {
    const resetActivity = () => {
      lastActivityRef.current = Date.now();
    };
    ACTIVITY_EVENTS.forEach((evt) =>
      window.addEventListener(evt, resetActivity, { passive: true }),
    );

    const interval = setInterval(() => {
      if (
        Date.now() - lastActivityRef.current > SESSION_TIMEOUT_MS &&
        !state.isPurged
      ) {
        purge();
      }
    }, 30_000);

    const handleBeforeUnload = () => {
      purge();
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      ACTIVITY_EVENTS.forEach((evt) =>
        window.removeEventListener(evt, resetActivity),
      );
      clearInterval(interval);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [purge, state.isPurged]);

  const setProfile = useCallback((profile: UserProfile) => {
    setState((prev) => ({ ...prev, profile }));
  }, []);

  const addFile = useCallback((file: UploadedFile) => {
    setState((prev) => ({
      ...prev,
      uploadedFiles: [...prev.uploadedFiles, file],
    }));
  }, []);

  const removeFile = useCallback((fileId: string) => {
    setState((prev) => ({
      ...prev,
      uploadedFiles: prev.uploadedFiles.filter((f) => {
        if (f.id === fileId && f.dataUrl) {
          try {
            const arr = new Uint8Array(f.dataUrl.length);
          } catch {
            // ignore
          }
        }
        return f.id !== fileId;
      }),
    }));
  }, []);

  const updateFileAnalysis = useCallback(
    (fileId: string, analysis: ExtractedDocumentData) => {
      setState((prev) => ({
        ...prev,
        uploadedFiles: prev.uploadedFiles.map((f) =>
          f.id === fileId ? { ...f, analysis } : f,
        ),
      }));
    },
    [],
  );

  const startNewSession = useCallback(() => {
    setState({
      sessionId: crypto.randomUUID(),
      startTime: Date.now(),
      profile: null,
      uploadedFiles: [],
      isPurged: false,
    });
  }, []);

  return {
    ...state,
    setProfile,
    addFile,
    removeFile,
    updateFileAnalysis,
    purge,
    startNewSession,
  };
}

export type { UploadedFile };
