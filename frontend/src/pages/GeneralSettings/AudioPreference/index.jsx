import React, { useEffect, useState } from "react";
import SettingsPage from "@/components/SettingsSidebar/SettingsPage";
import System from "@/models/system";
import PreLoader from "@/components/Preloader";
import SpeechToTextProvider from "./stt";
import TextToSpeechProvider from "./tts";

export default function AudioPreference() {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchKeys() {
      const _settings = await System.keys();
      setSettings(_settings);
      setLoading(false);
    }
    fetchKeys();
  }, []);

  return (
    <SettingsPage>
      {loading ? (
        <div className="flex justify-center items-center py-24">
          <PreLoader />
        </div>
      ) : (
        <div className="flex flex-col">
          <SpeechToTextProvider settings={settings} />
          <TextToSpeechProvider settings={settings} />
        </div>
      )}
    </SettingsPage>
  );
}
