import { useStore, ShapeType } from '../hooks/useStore';

const shapes: Record<ShapeType, { icon: string, name: string }> = {
  cube: { icon: '🧊', name: 'Cube' },
  sphere: { icon: '⚽', name: 'Sphere' },
  pyramid: { icon: '🔺', name: 'Pyramid' },
  cylinder: { icon: '🛢️', name: 'Cylinder' },
  tree: { icon: '🌳', name: 'Tree' },
  rock: { icon: '🪨', name: 'Rock' },
  bush: { icon: '🌿', name: 'Bush' },
  flower: { icon: '🌻', name: 'Flower' },
  lamp: { icon: '💡', name: 'Lamp' },
  fence: { icon: '🚧', name: 'Fence' },
};

export const ShapeSelector = () => {
  const activeShape = useStore(state => state.shape);
  const setShape = useStore(state => state.setShape);

  return (
    <div 
      className="absolute top-6 left-1/2 -translate-x-1/2 flex gap-4 bg-black/50 p-4 rounded-2xl backdrop-blur-md border border-white/20 z-50"
      onClick={(e) => e.stopPropagation()}
    >
      {Object.entries(shapes).map(([k, { icon, name }]) => (
        <button
          key={k}
          onClick={() => setShape(k as ShapeType)}
          title={name}
          className={`w-12 h-12 flex items-center justify-center text-2xl rounded-lg transition-all ${
            activeShape === k ? 'bg-white scale-110 shadow-lg' : 'bg-white/10 hover:bg-white/20'
          }`}
        >
          {icon}
        </button>
      ))}
    </div>
  );
};
