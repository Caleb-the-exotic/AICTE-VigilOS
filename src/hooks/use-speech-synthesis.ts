import { useState, useEffect, useCallback, useRef } from "react";

interface UseSpeechSynthesisOptions {
  rate?: number;
  pitch?: number;
  volume?: number;
  voice?: SpeechSynthesisVoice | null;
}

interface UseSpeechSynthesisReturn {
  speak: (text: string) => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  isSpeaking: boolean;
  supported: boolean;
  voices: SpeechSynthesisVoice[];
  selectedVoice: SpeechSynthesisVoice | null;
  setVoice: (voice: SpeechSynthesisVoice) => void;
  setRate: (rate: number) => void;
  setPitch: (pitch: number) => void;
  setVolume: (volume: number) => void;
  currentRate: number;
  currentPitch: number;
  currentVolume: number;
}

export function useSpeechSynthesis(
  options: UseSpeechSynthesisOptions = {}
): UseSpeechSynthesisReturn {
  const {
    rate: defaultRate = 1,
    pitch: defaultPitch = 1,
    volume: defaultVolume = 1,
    voice: defaultVoice = null,
  } = options;

  const [isSpeaking, setIsSpeaking] = useState(false);
  const [supported] = useState(
    () =>
      typeof window !== "undefined" && "speechSynthesis" in window
  );
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<SpeechSynthesisVoice | null>(defaultVoice);
  const [currentRate, setCurrentRate] = useState(defaultRate);
  const [currentPitch, setCurrentPitch] = useState(defaultPitch);
  const [currentVolume, setCurrentVolume] = useState(defaultVolume);

  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!supported) return;

    const loadVoices = () => {
      const available = speechSynthesis.getVoices();
      if (available.length > 0) {
        setVoices(available);
        if (!selectedVoice && available.length > 0) {
          const preferred = available.find((v) =>
            v.lang.startsWith("en")
          );
          setSelectedVoice(preferred || available[0]);
        }
      }
    };

    loadVoices();
    speechSynthesis.addEventListener("voiceschanged", loadVoices);

    return () => {
      speechSynthesis.removeEventListener("voiceschanged", loadVoices);
    };
  }, [supported, selectedVoice]);

  const stop = useCallback(() => {
    if (!supported) return;
    speechSynthesis.cancel();
    setIsSpeaking(false);
    utteranceRef.current = null;
  }, [supported]);

  const speak = useCallback(
    (text: string) => {
      if (!supported || !text.trim()) return;

      speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = currentRate;
      utterance.pitch = currentPitch;
      utterance.volume = currentVolume;
      if (selectedVoice) {
        utterance.voice = selectedVoice;
      }

      utterance.onstart = () => {
        if (mountedRef.current) setIsSpeaking(true);
      };

      utterance.onend = () => {
        if (mountedRef.current) setIsSpeaking(false);
      };

      utterance.onerror = () => {
        if (mountedRef.current) setIsSpeaking(false);
      };

      utteranceRef.current = utterance;
      speechSynthesis.speak(utterance);
    },
    [supported, currentRate, currentPitch, currentVolume, selectedVoice]
  );

  const pause = useCallback(() => {
    if (!supported) return;
    speechSynthesis.pause();
  }, [supported]);

  const resume = useCallback(() => {
    if (!supported) return;
    speechSynthesis.resume();
  }, [supported]);

  const setRate = useCallback((rate: number) => {
    setCurrentRate(Math.max(0.1, Math.min(10, rate)));
  }, []);

  const setPitch = useCallback((pitch: number) => {
    setCurrentPitch(Math.max(0, Math.min(2, pitch)));
  }, []);

  const setVolume = useCallback((volume: number) => {
    setCurrentVolume(Math.max(0, Math.min(1, volume)));
  }, []);

  useEffect(() => {
    return () => {
      if (supported) {
        speechSynthesis.cancel();
      }
    };
  }, [supported]);

  return {
    speak,
    pause,
    resume,
    stop,
    isSpeaking,
    supported,
    voices,
    selectedVoice,
    setVoice: setSelectedVoice,
    setRate,
    setPitch,
    setVolume,
    currentRate,
    currentPitch,
    currentVolume,
  };
}
