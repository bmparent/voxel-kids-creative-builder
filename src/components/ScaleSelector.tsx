import { useStore } from '../hooks/useStore';
import { Maximize, Minimize, Move, ZoomIn } from 'lucide-react';

const scales = [
  { value: 0.5, label: 'S', icon: <Minimize size={16} />, name: 'Small' },
  { value: 1.0, label: 'M', icon: <Move size={16} />, name: 'Medium' },
  { value: 2.0, label: 'L', icon: <Maximize size={16} />, name: 'Large' },
  { value: 3.0, label: 'XL', icon: <ZoomIn size={16} />, name: 'Huge' },
];

export const ScaleSelector = () => {
  const activeScale = useStore(state => state.scale);
  const setScale = useStore(state => state.setScale);

  return (
    <div 
      className="absolute right-6 top-1/2 -translate-y-1/2 flex flex-col gap-4 bg-black/50 p-4 rounded-2xl backdrop-blur-md border border-white/20 z-50"
      onClick={(e) => e.stopPropagation()}
    >
      <p className="text-white/60 text-[10px] uppercase font-bold text-center mb-2">Size</p>
      {scales.map(({ value, label, icon, name }) => (
        <button
          key={value}
          onClick={() => setScale(value)}
          title={name}
          className={`w-12 h-12 flex flex-col items-center justify-center rounded-lg transition-all ${
            activeScale === value ? 'bg-white text-gray-900 scale-110 shadow-lg' : 'bg-white/10 text-white hover:bg-white/20'
          }`}
        >
          {icon}
          <span className="text-[10px] font-bold mt-1">{label}</span>
        </button>
      ))}
    </div>
  );
};
