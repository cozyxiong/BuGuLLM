import { useEffect, useState, useRef } from "react";
import { SpeakerHigh, PauseCircle, CircleNotch } from "@phosphor-icons/react";
import PiperTTSClient from "@/utils/piperTTS";
import messageToSpeech from "@/utils/chat/messageToSpeech";

export default function PiperTTS({ chatId, voiceId = null, message }) {
  const playerRef = useRef(null);
  const [speaking, setSpeaking] = useState(false);
  const [loading, setLoading] = useState(false);
  const [audioSrc, setAudioSrc] = useState(null);

  async function speakMessage(e) {
    e.preventDefault();
    if (speaking) {
      playerRef?.current?.pause();
      return;
    }

    try {
      if (!audioSrc) {
        setLoading(true);
        const client = new PiperTTSClient({ voiceId });
        const blobUrl = await client.getAudioBlobForText(
          messageToSpeech(message)
        );
        setAudioSrc(blobUrl);
        setLoading(false);
      } else {
        playerRef.current.play();
      }
    } catch (e) {
      console.error(e);
      setLoading(false);
      setSpeaking(false);
    }
  }

  useEffect(() => {
    function setupPlayer() {
      if (!playerRef?.current) return;
      playerRef.current.addEventListener("play", () => {
        setSpeaking(true);
      });

      playerRef.current.addEventListener("pause", () => {
        playerRef.current.currentTime = 0;
        setSpeaking(false);
      });
    }
    setupPlayer();
  }, []);

  return (
    <button
      type="button"
      onClick={speakMessage}
      disabled={loading}
      data-auto-play-chat-id={chatId}
      data-tooltip-id="message-to-speech"
      data-tooltip-content={
        speaking ? "Pause TTS speech of message" : "TTS Speak message"
      }
      className="border-none bg-transparent p-0.5 inline-flex items-center justify-center cursor-pointer text-zinc-400 light:text-slate-500 hover:text-white light:hover:text-slate-800 transition-colors duration-150 leading-none disabled:opacity-50"
      aria-label={speaking ? "Pause speech" : "Speak message"}
    >
      {speaking ? (
        <PauseCircle size={15} weight="regular" />
      ) : loading ? (
        <CircleNotch size={15} weight="regular" className="animate-spin" />
      ) : (
        <SpeakerHigh size={15} weight="regular" />
      )}
      <audio
        ref={playerRef}
        hidden={true}
        src={audioSrc}
        autoPlay={true}
        controls={false}
      />
    </button>
  );
}
