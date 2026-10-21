import { type KeyboardEvent, useCallback, useEffect, useRef } from "react";
import { Mic, Square, Volume2, Loader2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSpeechRecognition } from "@/hooks/use-speech-recognition";
import { useSpeechSynthesis } from "@/hooks/use-speech-synthesis";
import { prefsStore } from "@/lib/prefs-store";

interface VoiceInputProps {
  onTranscript: (text: string) => void;
  disabled?: boolean;
}

export function VoiceInputButton({ onTranscript, disabled }: VoiceInputProps) {
  const prefs = prefsStore.get();
  const liveBufferRef = useRef("");

  const flushLiveBuffer = useCallback(() => {
    if (liveBufferRef.current) {
      onTranscript(liveBufferRef.current);
      liveBufferRef.current = "";
    }
  }, [onTranscript]);

  const {
    transcript,
    interimTranscript,
    isListening,
    error,
    startListening,
    stopListening,
    resetTranscript,
    supported: recognitionSupported,
  } = useSpeechRecognition({
    lang: prefs.language === "hi" ? "hi-IN" : prefs.language === "ta" ? "ta-IN" : "en-US",
    onResult: (chunk: string) => {
      liveBufferRef.current += chunk;
      flushLiveBuffer();
    },
    onEnd: (remaining: string) => {
      if (remaining) {
        onTranscript(remaining);
      }
    },
  });

  const transcriptRef = useRef(transcript);
  const interimRef = useRef(interimTranscript);
  const onTranscriptRef = useRef(onTranscript);

  useEffect(() => { transcriptRef.current = transcript; }, [transcript]);
  useEffect(() => { interimRef.current = interimTranscript; }, [interimTranscript]);
  useEffect(() => { onTranscriptRef.current = onTranscript; }, [onTranscript]);

  const handleToggle = useCallback(() => {
    if (isListening) {
      stopListening();
      const finalText = (transcriptRef.current + " " + interimRef.current).trim();
      if (finalText) {
        onTranscriptRef.current(finalText);
      }
    } else {
      startListening();
    }
  }, [isListening, stopListening, startListening]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        handleToggle();
      }
    },
    [handleToggle]
  );

  if (!recognitionSupported || !prefs.voiceInputEnabled) return null;

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={handleToggle}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        aria-label={isListening ? "Stop listening" : "Start voice input"}
        aria-pressed={isListening}
        className={cn(
          "relative flex items-center justify-center w-10 h-10 rounded-full transition-all cursor-pointer",
          isListening
            ? "bg-destructive text-destructive-foreground shadow-lg shadow-destructive/30 animate-pulse"
            : "bg-secondary/50 border border-border/40 text-muted-foreground hover:text-foreground hover:border-primary/40"
        )}
      >
        {isListening ? (
          <>
            <Square className="w-4 h-4" />
            <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-destructive animate-ping" />
          </>
        ) : (
          <Mic className="w-4 h-4" />
        )}
      </button>
      {isListening && (
        <span
          className={cn(
            "text-xs italic max-w-[160px] truncate animate-fade-in transition-colors",
            interimTranscript ? "text-foreground" : "text-muted-foreground"
          )}
        >
          {interimTranscript || "Listening..."}
        </span>
      )}
      {!isListening && transcript && (
        <span className="text-[10px] text-green-400 truncate max-w-[80px]">Voice captured</span>
      )}
      {error && (
        <span className="text-[11px] text-destructive ml-1 flex items-center gap-1 whitespace-nowrap">
          <AlertCircle className="w-3 h-3 shrink-0" />
          <span>{error}</span>
        </span>
      )}
    </div>
  );
}

interface VoiceOutputProps {
  text: string;
  disabled?: boolean;
}

export function ReadAloudButton({ text, disabled }: VoiceOutputProps) {
  const prefs = prefsStore.get();
  const {
    speak,
    stop,
    isSpeaking,
    supported: synthesisSupported,
    setRate,
    setPitch,
    setVolume,
  } = useSpeechSynthesis({
    rate: prefs.speechRate,
    pitch: prefs.speechPitch,
    volume: prefs.speechVolume,
  });

  useEffect(() => {
    setRate(prefs.speechRate);
    setPitch(prefs.speechPitch);
    setVolume(prefs.speechVolume);
  }, [prefs.speechRate, prefs.speechPitch, prefs.speechVolume, setRate, setPitch, setVolume]);

  const handleToggle = useCallback(() => {
    if (isSpeaking) {
      stop();
    } else {
      speak(text);
    }
  }, [isSpeaking, stop, speak, text]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        handleToggle();
      }
    },
    [handleToggle]
  );

  if (!synthesisSupported || !prefs.voiceOutputEnabled) return null;

  return (
    <button
      type="button"
      onClick={handleToggle}
      onKeyDown={handleKeyDown}
      disabled={disabled || !text.trim()}
      aria-label={isSpeaking ? "Stop reading aloud" : "Read aloud"}
      aria-pressed={isSpeaking}
      className={cn(
        "flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer",
        isSpeaking
          ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
          : "bg-secondary/45 border border-border/40 hover:border-primary/45 text-foreground hover:text-primary"
      )}
    >
      {isSpeaking ? (
        <>
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          Speaking...
        </>
      ) : (
        <>
          <Volume2 className="w-3.5 h-3.5" />
          Read aloud
        </>
      )}
    </button>
  );
}
