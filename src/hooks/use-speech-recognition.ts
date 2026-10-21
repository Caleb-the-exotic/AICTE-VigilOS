import { useState, useEffect, useRef, useCallback } from "react";

interface UseSpeechRecognitionOptions {
  lang?: string;
  continuous?: boolean;
  interimResults?: boolean;
  onResult?: (text: string) => void;
  onEnd?: (fullTranscript: string) => void;
}

interface UseSpeechRecognitionReturn {
  transcript: string;
  interimTranscript: string;
  isListening: boolean;
  error: string | null;
  startListening: () => void;
  stopListening: () => void;
  resetTranscript: () => void;
  supported: boolean;
}

export function useSpeechRecognition(
  options: UseSpeechRecognitionOptions = {}
): UseSpeechRecognitionReturn {
  const {
    lang = "en-US",
    continuous = true,
    interimResults = true,
    onResult,
    onEnd,
  } = options;

  const [transcript, setTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [supported] = useState(
    () =>
      typeof window !== "undefined" &&
      ("SpeechRecognition" in window || "webkitSpeechRecognition" in window)
  );

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const mountedRef = useRef(true);
  const stoppedByUser = useRef(false);
  const onResultRef = useRef(onResult);
  const onEndRef = useRef(onEnd);
  const restartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { onResultRef.current = onResult; }, [onResult]);
  useEffect(() => { onEndRef.current = onEnd; }, [onEnd]);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
    };
  }, []);

  const resetTranscript = useCallback(() => {
    setTranscript("");
    setInterimTranscript("");
  }, []);

  const stopListening = useCallback(() => {
    stoppedByUser.current = true;
    if (restartTimerRef.current) {
      clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // instance may already be stopped
      }
      recognitionRef.current = null;
    }
    setIsListening(false);
  }, []);

  const startListening = useCallback(() => {
    if (!supported) {
      setError("Speech recognition is not supported in this browser");
      return;
    }

    const SpeechRecognitionAPI =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionAPI) {
      setError("Speech recognition is not supported in this browser");
      return;
    }

    const recognition = new SpeechRecognitionAPI();
    recognition.continuous = continuous;
    recognition.interimResults = interimResults;
    recognition.lang = lang;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      if (!mountedRef.current) return;
      let final = "";
      let interim = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          final += result[0].transcript;
        } else {
          interim += result[0].transcript;
        }
      }

      if (final) {
        setTranscript((prev) => prev + final);
        onResultRef.current?.(final);
      }
      setInterimTranscript(interim);
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (!mountedRef.current) return;
      switch (event.error) {
        case "not-allowed":
          setError("Microphone permission denied");
          break;
        case "no-speech":
          setError("No speech detected");
          break;
        case "audio-capture":
          setError("No microphone found");
          break;
        case "network":
          setError("Network error — speech service unavailable");
          break;
        case "aborted":
          setError("Speech recognition aborted");
          break;
        case "service-not-allowed":
          setError("Speech service not allowed");
          break;
        default:
          setError(`Speech error: ${event.error}`);
      }
      setIsListening(false);
      if (!stoppedByUser.current) {
        const remaining = transcript;
        if (remaining) onEndRef.current?.(remaining);
      }
    };

    recognition.onend = () => {
      if (!mountedRef.current) return;
      // Check if we still have this recognition (not nulled by stopListening)
      const wasUserStop = stoppedByUser.current;
      setIsListening(false);

      // Flush any remaining transcript on natural end
      if (!wasUserStop) {
        onEndRef.current?.(transcript);
      }

      // Auto-restart on natural end (browsers stop after silence even with continuous:true)
      if (!wasUserStop && recognitionRef.current !== null) {
        restartTimerRef.current = setTimeout(() => {
          if (mountedRef.current && !stoppedByUser.current) {
            startListening();
          }
        }, 300);
      }
    };

    try {
      recognition.start();
      recognitionRef.current = recognition;
      stoppedByUser.current = false;
      setIsListening(true);
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to start speech recognition");
    }
  }, [supported, continuous, interimResults, lang, transcript]);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // already disposed
        }
        recognitionRef.current = null;
      }
    };
  }, []);

  return {
    transcript,
    interimTranscript,
    isListening,
    error,
    startListening,
    stopListening,
    resetTranscript,
    supported,
  };
}
