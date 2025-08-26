import { useEffect, useState } from "react";
import ViessmannGame from "./ViessmannGame";
import LoadingOverlay from "./components/LoadingOverlay";

export default function App() {
  const [loading, setLoading] = useState(true);
  const steps: Array<{ key: string; label: string; ms?: number }> = [
    { key: 'boot', label: 'Inicjalizacja modułów', ms: 250 },
    { key: 'assets', label: 'Przygotowanie interfejsu i ikon', ms: 250 },
    { key: 'save', label: 'Wczytywanie zapisu gry', ms: 250 },
    { key: 'world', label: 'Generowanie planszy i widoku', ms: 250 },
  ];

  // Optionally simulate a tiny pre-warm stage before the app mounts fully
  useEffect(() => {
    // In case the game mounts very fast, keep loader at least ~900ms for smoothness
  const minTime = setTimeout(() => {}, 900);
    return () => clearTimeout(minTime);
  }, []);

  return (
    <>
      {loading && (
        <LoadingOverlay steps={steps} onDone={() => setLoading(false)} minTotalMs={1000} />
      )}
      {/* Render game behind the overlay so first frame is ready when loader ends */}
      <div aria-hidden={loading} style={{ filter: loading ? 'blur(0.5px)' : 'none' }}>
        <ViessmannGame />
      </div>
    </>
  );
}
