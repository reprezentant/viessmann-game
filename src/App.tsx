import { useEffect, useState } from "react";
import ViessmannGame from "./ViessmannGame";
import VideoIntro from "./components/VideoIntro";

export default function App() {
  const [showVideo, setShowVideo] = useState(true);
  const steps: Array<{ key: string; ms?: number }> = [
    { key: 'boot', ms: 500 },
    { key: 'assets', ms: 500 },
    { key: 'save', ms: 500 },
    { key: 'world', ms: 500 },
  ];

  // Optionally simulate a tiny pre-warm stage before the app mounts fully
  useEffect(() => {
    // In case the game mounts very fast, keep loader at least ~900ms for smoothness
  const minTime = setTimeout(() => {}, 900);
    return () => clearTimeout(minTime);
  }, []);

  return (
    <>
      {/* Video Intro with loading progress - plays first */}
      {showVideo && (
        <VideoIntro steps={steps} onComplete={() => setShowVideo(false)} minTotalMs={2000} />
      )}
      
      {/* Render game behind the video so first frame is ready when video ends */}
      <div aria-hidden={showVideo} style={{ filter: showVideo ? 'blur(0.5px)' : 'none' }}>
        <ViessmannGame />
      </div>
    </>
  );
}