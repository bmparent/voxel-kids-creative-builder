import { useStore } from '../hooks/useStore';
import { useEffect } from 'react';
import { useKeyboard } from '../hooks/useKeyboard';

const images = {
  dirt: '🟫',
  grass: '🟩',
  glass: '🧊',
  wood: '🪵',
  log: '🌲',
  stone: '🪨',
  water: '💧',
};

export const TextureSelector = () => {
  const activeTexture = useStore((state) => state.texture);
  const setTexture = useStore((state) => state.setTexture);
  const { dirt, grass, glass, wood, log, stone, water } = useKeyboard();

  useEffect(() => {
    const textures = { dirt, grass, glass, wood, log, stone, water };
    const pressedTexture = Object.entries(textures).find(([k, v]) => v);
    if (pressedTexture) {
      setTexture(pressedTexture[0]);
    }
  }, [dirt, grass, glass, wood, log, stone, water, setTexture]);

  return (
    <div 
      className="absolute bottom-10 left-1/2 -translate-x-1/2 flex gap-4 bg-black/50 p-4 rounded-2xl backdrop-blur-md border border-white/20 z-50"
      onClick={(e) => e.stopPropagation()}
    >
      {Object.entries(images).map(([k, src]) => (
        <button
          key={k}
          onClick={() => setTexture(k)}
          className={`w-12 h-12 flex items-center justify-center text-2xl rounded-lg transition-all ${
            activeTexture === k ? 'bg-white scale-110 shadow-lg' : 'bg-white/10 hover:bg-white/20'
          }`}
        >
          {src}
        </button>
      ))}
    </div>
  );
};
