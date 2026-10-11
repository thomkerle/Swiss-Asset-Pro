/**
 * @file SpeechToTextButton.jsx
 * @description Mikrofon-Komponente mit Spracherkennung für FinBundle Pro.
 */

const React = require('react');
const { useState, useEffect, useRef } = React;
const Icon = require('../Icons.jsx');

const SpeechToTextButton = ({ onTranscript, lang = 'de-CH', isProcessing = false }) => {
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef(null);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn("Web Speech API im aktuellen Browser nicht verfügbar.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = lang === 'de' ? 'de-CH' : (lang === 'fr' ? 'fr-CH' : 'en-US');

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setIsListening(false);
      if (onTranscript && transcript) {
        onTranscript(transcript);
      }
    };

    recognition.onerror = (event) => {
      console.error("Spracherkennungsfehler:", event.error);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
  }, [lang, onTranscript]);

  const toggleRecording = () => {
    if (!recognitionRef.current) {
      alert("Spracherkennung wird in diesem Browser/Webview nicht unterstützt.");
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch (err) {
        console.warn("Fehler beim Starten:", err);
      }
    }
  };

  return (
    <button
      type="button"
      onClick={toggleRecording}
      disabled={isProcessing}
      className={`p-3 rounded-xl flex items-center justify-center transition-all shadow-sm ${
        isListening
          ? 'bg-red-600 text-white animate-pulse shadow-red-500/50 scale-105'
          : 'bg-blue-50 dark:bg-slate-800 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-slate-700'
      }`}
      title={isListening ? "Aufnahme beenden..." : "Per Spracheingabe diktieren"}
    >
      <Icon name={isListening ? "Zap" : "Activity"} size={18} />
    </button>
  );
};

module.exports = SpeechToTextButton;