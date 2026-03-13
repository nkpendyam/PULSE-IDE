'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Mic, MicOff } from 'lucide-react';

// Web Speech API type declarations (not included in standard TypeScript lib)
interface SpeechRecognitionEvent extends Event {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent extends Event {
  readonly error: string;
  readonly message: string;
}

interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionInstance;
    webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
  }
}

interface VoiceInputProps {
  onTranscript: (text: string) => void;
  disabled?: boolean;
}

export function VoiceInput({ onTranscript, disabled = false }: VoiceInputProps) {
  const [isListening, setIsListening] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isSupported, setIsSupported] = useState(true);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const finalTranscriptRef = useRef('');

  useEffect(() => {
    const SpeechRecognitionAPI =
      window.SpeechRecognition ?? window.webkitSpeechRecognition;

    if (!SpeechRecognitionAPI) {
      setIsSupported(false);
      return;
    }

    const recognition = new SpeechRecognitionAPI();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsListening(true);
      setErrorMessage('');
      finalTranscriptRef.current = '';
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = '';
      let final = finalTranscriptRef.current;

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0].transcript;
        if (result.isFinal) {
          final += transcript;
        } else {
          interim += transcript;
        }
      }

      finalTranscriptRef.current = final;
      setInterimTranscript(interim);
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error === 'no-speech') {
        // Silently ignore — user just hasn't spoken yet
        return;
      }
      if (event.error === 'aborted') {
        // Triggered by manual stop — not an error
        return;
      }
      const messages: Record<string, string> = {
        'not-allowed': 'Microphone access denied. Please allow microphone permissions.',
        'audio-capture': 'No microphone found. Please connect a microphone.',
        'network': 'Network error during speech recognition.',
        'service-not-allowed': 'Speech recognition service not allowed.',
      };
      setErrorMessage(messages[event.error] ?? `Speech recognition error: ${event.error}`);
      setIsListening(false);
      setInterimTranscript('');
    };

    recognition.onend = () => {
      const finalText = finalTranscriptRef.current.trim();
      if (finalText) {
        onTranscript(finalText);
      }
      setIsListening(false);
      setInterimTranscript('');
      finalTranscriptRef.current = '';
    };

    recognitionRef.current = recognition;

    return () => {
      recognition.abort();
    };
  // onTranscript is intentionally excluded — changes shouldn't restart recognition
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleListening = useCallback(() => {
    if (!recognitionRef.current) return;

    if (isListening) {
      recognitionRef.current.stop();
    } else {
      setErrorMessage('');
      try {
        recognitionRef.current.start();
      } catch {
        // Recognition may already be running (e.g. rapid double-click); stop it
        recognitionRef.current.stop();
      }
    }
  }, [isListening]);

  if (!isSupported) {
    return (
      <div
        className="flex items-center gap-1.5 px-2 py-1 rounded text-xs text-[#8b949e] bg-[#21262d] border border-[#30363d]"
        title="Speech recognition is not supported in this browser"
      >
        <MicOff size={13} className="flex-shrink-0" />
        <span>Voice unavailable</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {/* Listening indicator + interim transcript */}
      {isListening && (
        <div className="flex items-center gap-1.5 min-w-0">
          {/* Pulsing red dot */}
          <span className="relative flex h-2.5 w-2.5 flex-shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
          </span>
          <span className="text-xs text-[#8b949e] truncate max-w-[180px]">
            {interimTranscript ? (
              <span className="text-[#c9d1d9] italic">&ldquo;{interimTranscript}&rdquo;</span>
            ) : (
              'Listening…'
            )}
          </span>
        </div>
      )}

      {/* Error message */}
      {errorMessage && !isListening && (
        <span className="text-xs text-red-400 truncate max-w-[200px]" title={errorMessage}>
          {errorMessage}
        </span>
      )}

      {/* Mic toggle button */}
      <button
        type="button"
        onClick={toggleListening}
        disabled={disabled}
        title={isListening ? 'Stop recording' : 'Start voice input'}
        aria-label={isListening ? 'Stop recording' : 'Start voice input'}
        aria-pressed={isListening}
        className={[
          'flex items-center justify-center w-7 h-7 rounded transition-colors flex-shrink-0',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#58a6ff] focus-visible:ring-offset-1 focus-visible:ring-offset-[#0d1117]',
          disabled
            ? 'opacity-40 cursor-not-allowed text-[#8b949e]'
            : isListening
              ? 'bg-red-900/40 text-red-400 hover:bg-red-900/60'
              : 'text-[#8b949e] hover:bg-[#21262d] hover:text-[#c9d1d9]',
        ].join(' ')}
      >
        {isListening ? <MicOff size={15} /> : <Mic size={15} />}
      </button>
    </div>
  );
}
