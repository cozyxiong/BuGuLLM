import React, { useEffect, useState } from "react";
import { SpeakerHigh, PauseCircle } from "@phosphor-icons/react";
import messageToSpeech from "@/utils/chat/messageToSpeech";

export default function NativeTTSMessage({ chatId, message }) {
  const [speaking, setSpeaking] = useState(false);
  const [supported, setSupported] = useState(false);
  useEffect(() => {
    setSupported("speechSynthesis" in window);
  }, []);

  function endSpeechUtterance() {
    window.speechSynthesis?.cancel();
    setSpeaking(false);
    return;
  }

  function speakMessage() {
    // if the user is pausing this particular message
    // while the synth is speaking we can end it.
    // If they are clicking another message's TTS
    // we need to ignore that until they pause the one that is playing.
    if (window.speechSynthesis.speaking && speaking) {
      endSpeechUtterance();
      return;
    }

    if (window.speechSynthesis.speaking && !speaking) return;
    const utterance = new SpeechSynthesisUtterance(messageToSpeech(message));
    utterance.addEventListener("end", endSpeechUtterance);
    window.speechSynthesis.speak(utterance);
    setSpeaking(true);
  }

  if (!supported) return null;
  return (
    <button
      type="button"
      onClick={speakMessage}
      data-auto-play-chat-id={chatId}
      data-tooltip-id="message-to-speech"
      data-tooltip-content={
        speaking ? "Pause TTS speech of message" : "TTS Speak message"
      }
      className="border-none bg-transparent p-0.5 inline-flex items-center justify-center cursor-pointer text-zinc-400 light:text-slate-500 hover:text-white light:hover:text-slate-800 transition-colors duration-150 leading-none"
      aria-label={speaking ? "Pause speech" : "Speak message"}
    >
      {speaking ? (
        <PauseCircle size={15} weight="regular" />
      ) : (
        <SpeakerHigh size={15} weight="regular" />
      )}
    </button>
  );
}
