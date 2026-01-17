
import { useState, useEffect, useCallback } from 'react';

export interface VoiceCommand {
  command: string;
  action: (transcript: string) => void;
  keywords: string[];
}

interface UseVoiceControlProps {
  onCommand: (cmd: string, transcript: string) => void;
}

export const useVoiceControl = ({ onCommand }: UseVoiceControlProps) => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [isSupported, setIsSupported] = useState(false);
  const [recognition, setRecognition] = useState<any>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        setIsSupported(true);
        const rec = new SpeechRecognition();
        rec.continuous = true;
        rec.interimResults = false;
        rec.lang = 'en-US'; // Default to English for commands, could make dynamic

        rec.onstart = () => setIsListening(true);
        rec.onend = () => setIsListening(false);
        rec.onerror = (event: any) => {
          console.error('Speech recognition error', event.error);
          setIsListening(false);
        };

        rec.onresult = (event: any) => {
          const last = event.results.length - 1;
          const text = event.results[last][0].transcript.trim().toLowerCase();
          setTranscript(text);
          console.log("Voice Input:", text);

          // Command Matching Logic
          if (text.includes('home') || text.includes('dashboard')) onCommand('home', text);
          else if (text.includes('translate') || text.includes('translator')) onCommand('translator', text);
          else if (text.includes('duplicate') || text.includes('check')) onCommand('duplicates', text);
          else if (text.includes('salla')) onCommand('salla', text);
          else if (text.includes('zid')) onCommand('zid', text);
          else if (text.includes('reset') || text.includes('clear')) onCommand('reset', text);
          else if (text.includes('start') || text.includes('process') || text.includes('go') || text.includes('run')) onCommand('start', text);
          else if (text.includes('logs') || text.includes('history')) onCommand('toggle_logs', text);
        };

        setRecognition(rec);
      }
    }
  }, [onCommand]);

  const toggleListening = useCallback(() => {
    if (!recognition) return;
    if (isListening) {
      recognition.stop();
    } else {
      recognition.start();
    }
  }, [isListening, recognition]);

  return { isListening, toggleListening, transcript, isSupported };
};
