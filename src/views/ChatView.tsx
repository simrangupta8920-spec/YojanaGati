import { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Sparkles, Volume2 } from 'lucide-react';
import type { LanguageCode, UserProfile, ChatMessage } from '@/lib/types';
import type { Scholarship } from '@/lib/supabase';

import { t } from '@/lib/i18n';
import { ragQuery } from '@/lib/rag';
import { useTextToSpeech } from '@/hooks/useSpeech';
import { VoiceButton } from '@/components/VoiceButton';

function renderMessageContent(content: string) {
  const parts = content.split('**');
  if (parts.length === 1) return content;
  return parts.map((part, index) => {
    if (index % 2 === 1) {
      return <strong key={index} className="font-bold text-slate-900">{part}</strong>;
    }
    return part;
  });
}

interface ChatViewProps {
  lang: LanguageCode;
  scholarships: Scholarship[];
  profile: UserProfile | null;
  /**
   * Chat history is owned by useEphemeralSession (lifted up so purge() can
   * clear it). ChatView reads from and writes back to this lifted state via
   * the two props below.
   */
  messages: ChatMessage[];
  onMessagesChange: (messages: ChatMessage[]) => void;
}

export function ChatView({
  lang,
  scholarships,
  profile,
  messages,
  onMessagesChange,
}: ChatViewProps) {
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { speak, stopSpeaking, isSpeaking } = useTextToSpeech(lang);
  const sttSupported = typeof window !== 'undefined' && (
    'SpeechRecognition' in window || 
    'webkitSpeechRecognition' in window
  );

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = (text?: string) => {
    const message = text ?? input;
    if (!message.trim() || isProcessing) return;

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: message,
      timestamp: Date.now(),
    };
    const withUser = [...messages, userMsg];
    onMessagesChange(withUser);
    setInput('');
    setIsProcessing(true);

    setTimeout(() => {
      const result = ragQuery(message, scholarships, profile ?? undefined, lang);
      const assistantMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: result.answer,
        timestamp: Date.now(),
        scholarshipRefs: result.matchedScholarships.map((s) => s.name),
      };
      onMessagesChange([...withUser, assistantMsg]);
      setIsProcessing(false);
      speak(result.answer);
    }, 600);
  };

  const quickQuestions = [
    t(lang, 'askAboutEligibility'),
    t(lang, 'askAboutDocuments'),
    t(lang, 'askAboutDeadlines'),
  ];

  return (
    <div className="mx-auto flex h-[calc(100vh-140px)] max-w-3xl flex-col px-4 py-4">
      <div className="mb-3 flex items-center gap-2">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-teal-700">
          <Bot className="h-5 w-5 text-white" />
        </div>
        <div>
          <h2 className="flex items-center gap-1.5 text-base font-semibold text-slate-800">
            {t(lang, 'aiAssistantReady')}
            <Sparkles className="h-4 w-4 text-teal-500" />
          </h2>
          <p className="text-xs text-slate-400">
            {t(lang, 'basedOnProfile')} • {scholarships.length} scholarships in database
          </p>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="flex-1 space-y-4 overflow-y-auto rounded-2xl border border-slate-100 bg-white p-4"
      >
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
          >
            <div
              className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg ${
                msg.role === 'user'
                  ? 'bg-slate-200'
                  : 'bg-gradient-to-br from-teal-500 to-teal-700'
              }`}
            >
              {msg.role === 'user' ? (
                <User className="h-4 w-4 text-slate-600" />
              ) : (
                <Bot className="h-4 w-4 text-white" />
              )}
            </div>
            <div
              className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm ${
                msg.role === 'user'
                  ? 'bg-teal-600 text-white'
                  : 'bg-slate-100 text-slate-700'
              }`}
            >
              <p className="whitespace-pre-line">{renderMessageContent(msg.content)}</p>
              {msg.role === 'assistant' && (
                <button
                  onClick={() =>
                    isSpeaking ? stopSpeaking() : speak(msg.content)
                  }
                  className="mt-2 flex items-center gap-1 text-xs opacity-60 hover:opacity-100"
                >
                  <Volume2 className="h-3 w-3" />
                  {t(lang, 'listenDescription')}
                </button>
              )}
            </div>
          </div>
        ))}
        {isProcessing && (
          <div className="flex gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-teal-500 to-teal-700">
              <Bot className="h-4 w-4 text-white" />
            </div>
            <div className="flex items-center gap-1 rounded-2xl bg-slate-100 px-4 py-3">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="h-2 w-2 rounded-full bg-teal-500"
                  style={{
                    animation: `chatBounce 0.8s ease-in-out ${i * 0.15}s infinite alternate`,
                  }}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {messages.length <= 1 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {quickQuestions.map((q) => (
            <button
              key={q}
              onClick={() => handleSend(q)}
              className="rounded-full border border-teal-200 bg-teal-50 px-3 py-1.5 text-xs font-medium text-teal-700 transition-colors hover:bg-teal-100"
            >
              {q}
            </button>
          ))}
        </div>
      )}

      <div className="mt-3 flex items-center gap-2">
        {sttSupported && (
          <VoiceButton
            lang={lang}
            onTranscript={(text) => handleSend(text)}
            label=""
          />
        )}
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder={t(lang, 'chatPlaceholder')}
          className="flex-1 rounded-xl border-2 border-slate-200 px-4 py-2.5 text-sm text-slate-700 focus:border-teal-500 focus:outline-none"
        />
        <button
          onClick={() => handleSend()}
          disabled={!input.trim() || isProcessing}
          className="flex items-center gap-1.5 rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-medium text-white shadow-md shadow-teal-600/20 transition-colors hover:bg-teal-700 disabled:opacity-40"
        >
          <Send className="h-4 w-4" />
          <span className="hidden sm:inline">{t(lang, 'sendMessage')}</span>
        </button>
      </div>
    </div>
  );
}
