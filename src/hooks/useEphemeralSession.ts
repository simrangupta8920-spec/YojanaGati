import { useCallback, useEffect, useRef, useState } from 'react';
import type { UserProfile, ExtractedDocumentData, ChatMessage, ParsedDocumentFields, ParsedField } from '@/lib/types';
import type { Scholarship } from '@/lib/supabase';
import { buildExtractedFields, checkEligibility } from '@/lib/documentAnalysis';

export interface UploadedFile {
  id: string;
  name: string;
  type: string;
  size: number;
  /**
   * Base64 data URL of the file contents.
   * Typed as `string | null` so purge() can null this field explicitly before
   * dropping the array reference, removing all React-state pointers to the
   * large base64 string so the GC can reclaim it.
   */
  dataUrl: string | null;
  analysis?: ExtractedDocumentData | null;
}

interface SessionState {
  sessionId: string;
  startTime: number;
  /** User profile — survives purge so the user does not need to re-onboard. */
  profile: UserProfile | null;
  uploadedFiles: UploadedFile[];
  /**
   * Chat history lifted from ChatView into session state so purge() can
   * clear it without prop-drilling a reset callback.
   */
  chatMessages: ChatMessage[];
  /** True once purge() has completed. Drives the confirmation UI. */
  isFilesWiped: boolean;
}

/** Structured result returned by verifyPurge() for post-purge assertions. */
export interface PurgeVerification {
  pass: boolean;
  checks: { label: string; passed: boolean; detail: string }[];
}

const SESSION_TIMEOUT_MS = 15 * 60 * 1000;
const ACTIVITY_EVENTS: (keyof WindowEventMap)[] = [
  'mousedown',
  'keydown',
  'touchstart',
  'scroll',
];

/**
 * Stable welcome message used to initialise and reset the chat thread.
 * Exported so ChatView can reference the same constant without duplication.
 */
export const INITIAL_CHAT_MESSAGE: ChatMessage = {
  id: 'welcome',
  role: 'assistant',
  content:
    'Namaste! I am your AI scholarship assistant. I can help you find scholarships, check eligibility, and guide you on required documents. What would you like to know?',
  timestamp: 0, // overwritten with Date.now() on each use
};

export function useEphemeralSession() {
  const [state, setState] = useState<SessionState>({
    sessionId: crypto.randomUUID(),
    startTime: Date.now(),
    profile: null,
    uploadedFiles: [],
    chatMessages: [{ ...INITIAL_CHAT_MESSAGE, timestamp: Date.now() }],
    isFilesWiped: false,
  });

  const lastActivityRef = useRef(Date.now());
  const purgeRef = useRef<(() => void) | null>(null);

  /**
   * purge() — the real wipe.
   *
   * JS strings are immutable, so we cannot zero their bytes in place.
   * The correct strategy is:
   *   1. Null every `dataUrl` and `analysis` field on every UploadedFile so
   *      React state holds no reference to the large base64 strings.
   *   2. Replace uploadedFiles with [] — the old UploadedFile objects now have
   *      zero live references and become GC-eligible on the next cycle.
   *   3. Reset chatMessages to the welcome stub only — wipes conversation PII.
   *   4. Preserve the UserProfile — the user should not need to re-onboard.
   *   5. Set isFilesWiped = true so the UI renders the confirmation screen.
   */
  const purge = useCallback(() => {
    setState((prev) => {
      // Step 1 — null every sensitive field before we drop the array.
      for (const file of prev.uploadedFiles) {
        // Cast through unknown to bypass readonly TS checks on the field;
        // we own these objects and are intentionally clearing them.
        (file as unknown as { dataUrl: null }).dataUrl = null;
        (file as unknown as { analysis: null }).analysis = null;
      }

      return {
        sessionId: crypto.randomUUID(),
        startTime: Date.now(),
        profile: prev.profile, // ← preserved
        uploadedFiles: [], // ← old array/objects now have zero state references
        chatMessages: [{ ...INITIAL_CHAT_MESSAGE, timestamp: Date.now() }],
        isFilesWiped: true,
      };
    });
  }, []);

  purgeRef.current = purge;

  // Inactivity auto-purge (15-min idle) + beforeunload safeguard
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
        !state.isFilesWiped
      ) {
        purgeRef.current?.();
      }
    }, 30_000);

    const handleBeforeUnload = () => {
      purgeRef.current?.();
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      ACTIVITY_EVENTS.forEach((evt) =>
        window.removeEventListener(evt, resetActivity),
      );
      clearInterval(interval);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [state.isFilesWiped]);

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
        if (f.id === fileId) {
          // Null sensitive fields before the file object leaves the array.
          (f as unknown as { dataUrl: null }).dataUrl = null;
          (f as unknown as { analysis: null }).analysis = null;
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

  const updateParsedField = useCallback(
    (
      fileId: string,
      fieldKey: keyof ParsedDocumentFields,
      value: string,
      scholarships: Scholarship[],
    ) => {
      setState((prev) => {
        const file = prev.uploadedFiles.find((f) => f.id === fileId);
        if (!file || !file.analysis || !file.analysis.parsedFields) return prev;

        const currentField = file.analysis.parsedFields[fieldKey];
        const updatedField: ParsedField = {
          value: value || null,
          confidence: currentField ? currentField.confidence : 'none',
          needs_manual_review: false,
          manually_reviewed: true,
        };

        const updatedParsedFields: ParsedDocumentFields = {
          ...file.analysis.parsedFields,
          [fieldKey]: updatedField,
        };

        const updatedExtractedFields = buildExtractedFields(updatedParsedFields);

        const { inconsistencies } = checkEligibility(
          updatedExtractedFields,
          prev.profile ?? undefined,
          scholarships,
        );

        const updatedAnalysis: ExtractedDocumentData = {
          ...file.analysis,
          parsedFields: updatedParsedFields,
          extractedFields: updatedExtractedFields,
          inconsistencies,
        };

        return {
          ...prev,
          uploadedFiles: prev.uploadedFiles.map((f) =>
            f.id === fileId ? { ...f, analysis: updatedAnalysis } : f,
          ),
        };
      });
    },
    [],
  );


  /**
   * setChatMessages — lets ChatView push new messages back up to session state
   * so the full history is always available to purge().
   */
  const setChatMessages = useCallback((messages: ChatMessage[]) => {
    setState((prev) => ({ ...prev, chatMessages: messages }));
  }, []);

  /**
   * startNewSession — full reset including profile.
   * Called from the "Start New Session" button on the post-purge screen,
   * where the user explicitly wants a completely fresh anonymous session.
   */
  const startNewSession = useCallback(() => {
    setState({
      sessionId: crypto.randomUUID(),
      startTime: Date.now(),
      profile: null,
      uploadedFiles: [],
      chatMessages: [{ ...INITIAL_CHAT_MESSAGE, timestamp: Date.now() }],
      isFilesWiped: false,
    });
  }, []);

  /**
   * verifyPurge() — call *after* the React re-render triggered by purge() has
   * committed (e.g. inside a useEffect([isFilesWiped]) or a setTimeout(0))
   * to assert the session is in the expected post-purge state.
   *
   * Returns a PurgeVerification with per-check pass/fail details.
   * All checks must pass for `.pass` to be true.
   *
   * Quick browser-console usage — expose via a window global in dev:
   *   window.__yg_verifyPurge?.()
   */
  const verifyPurge = useCallback((): PurgeVerification => {
    const checks: PurgeVerification['checks'] = [
      {
        label: 'uploadedFiles array is empty',
        passed: state.uploadedFiles.length === 0,
        detail: `uploadedFiles.length = ${state.uploadedFiles.length}`,
      },
      {
        label: 'No file retains a non-null dataUrl',
        passed: state.uploadedFiles.every((f) => f.dataUrl === null),
        detail:
          state.uploadedFiles.length === 0
            ? 'No files present — OK'
            : `${state.uploadedFiles.filter((f) => f.dataUrl !== null).length} file(s) still have a dataUrl`,
      },
      {
        label: 'No file retains a non-null analysis',
        passed: state.uploadedFiles.every((f) => f.analysis == null),
        detail:
          state.uploadedFiles.length === 0
            ? 'No files present — OK'
            : `${state.uploadedFiles.filter((f) => f.analysis != null).length} file(s) still have an analysis object`,
      },
      {
        label: 'chatMessages reset to welcome stub only',
        passed:
          state.chatMessages.length === 1 &&
          state.chatMessages[0].id === 'welcome',
        detail: `chatMessages.length = ${state.chatMessages.length}`,
      },
      {
        label: 'isFilesWiped flag is true',
        passed: state.isFilesWiped,
        detail: `isFilesWiped = ${state.isFilesWiped}`,
      },
      {
        label: 'Profile preserved (not wiped)',
        // Unconditionally informational — profile survival is by design.
        passed: true,
        detail: state.profile
          ? `Profile retained for "${state.profile.name || 'unnamed user'}"`
          : 'No profile was set before purge',
      },
    ];

    return { pass: checks.every((c) => c.passed), checks };
  }, [state]);

  return {
    ...state,
    setProfile,
    addFile,
    removeFile,
    updateFileAnalysis,
    updateParsedField,
    setChatMessages,
    purge,
    startNewSession,
    verifyPurge,
  };
}
