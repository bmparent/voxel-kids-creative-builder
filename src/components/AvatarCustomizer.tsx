import { useState, useRef } from 'react';
import { useStore, AvatarData } from '../hooks/useStore';
import { X, Camera, Palette, User, Check } from 'lucide-react';
import { analyzePhoto } from '../services/apiClient';

interface AvatarCustomizerProps {
  onClose: () => void;
}

export const AvatarCustomizer = ({ onClose }: AvatarCustomizerProps) => {
  const playerAvatar = useStore((state) => state.playerAvatar);
  const setPlayerAvatar = useStore((state) => state.setPlayerAvatar);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleColorChange = (key: keyof AvatarData, value: string) => {
    setPlayerAvatar({ [key]: value });
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsAnalyzing(true);
    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const base64Data = (event.target?.result as string).split(',')[1];
        const result = await analyzePhoto(base64Data, file.type);
        setPlayerAvatar(result);
        setIsAnalyzing(false);
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error("Error analyzing photo:", error);
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="absolute inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-md p-6">
      <div className="bg-white rounded-3xl p-8 max-w-2xl w-full shadow-2xl relative overflow-hidden">
        <button 
          onClick={onClose}
          className="absolute top-6 right-6 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <X size={24} />
        </button>

        <div className="flex items-center gap-3 mb-8">
          <div className="p-3 bg-blue-100 text-blue-600 rounded-2xl">
            <User size={24} />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Avatar Customizer</h2>
            <p className="text-gray-500 text-sm">Make your character unique</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Left: Controls */}
          <div className="space-y-6">
            <section>
              <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                <Camera size={16} /> Photo Translation
              </h3>
              <button 
                onClick={() => fileInputRef.current?.click()}
                disabled={isAnalyzing}
                className="w-full py-4 px-6 bg-gray-900 text-white rounded-2xl font-bold hover:bg-gray-800 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
              >
                {isAnalyzing ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Camera size={20} />
                )}
                {isAnalyzing ? 'Analyzing Photo...' : 'Upload Photo'}
              </button>
              <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept="image/*" 
                onChange={handlePhotoUpload}
              />
              <p className="text-[10px] text-gray-400 mt-2 text-center italic">
                AI will translate your photo into a voxel style
              </p>
            </section>

            <section>
              <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                <Palette size={16} /> Style & Colors
              </h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 font-medium">Style</span>
                  <select 
                    value={playerAvatar.style} 
                    onChange={(e) => handleColorChange('style', e.target.value)}
                    className="bg-gray-100 rounded-lg px-2 py-1 text-sm focus:outline-none"
                  >
                    <option value="casual">Casual</option>
                    <option value="formal">Formal</option>
                    <option value="sporty">Sporty</option>
                    <option value="worker">Worker</option>
                    <option value="artist">Artist</option>
                  </select>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 font-medium">Skin Tone</span>
                  <input 
                    type="color" 
                    value={playerAvatar.color} 
                    onChange={(e) => handleColorChange('color', e.target.value)}
                    className="w-10 h-10 rounded-lg cursor-pointer border-none"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 font-medium">Clothing</span>
                  <input 
                    type="color" 
                    value={playerAvatar.clothingColor} 
                    onChange={(e) => handleColorChange('clothingColor', e.target.value)}
                    className="w-10 h-10 rounded-lg cursor-pointer border-none"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 font-medium">Hair</span>
                  <input 
                    type="color" 
                    value={playerAvatar.hairColor} 
                    onChange={(e) => handleColorChange('hairColor', e.target.value)}
                    className="w-10 h-10 rounded-lg cursor-pointer border-none"
                  />
                </div>
              </div>
            </section>
          </div>

          {/* Right: Preview (Conceptual) */}
          <div className="bg-gray-50 rounded-3xl p-6 flex flex-col items-center justify-center border-2 border-dashed border-gray-200">
            <div className="w-32 h-32 rounded-full mb-4 overflow-hidden shadow-lg" style={{ backgroundColor: playerAvatar.clothingColor }}>
               {/* This is a simplified 2D preview of the colors */}
               <div className="w-full h-1/3" style={{ backgroundColor: playerAvatar.hairColor }} />
               <div className="w-full h-1/3" style={{ backgroundColor: playerAvatar.color }} />
            </div>
            <h4 className="font-bold text-gray-900">{playerAvatar.name}</h4>
            <span className="text-xs text-gray-400 uppercase tracking-widest">{playerAvatar.style} Style</span>
            
            <button 
              onClick={onClose}
              className="mt-8 w-full py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all flex items-center justify-center gap-2"
            >
              <Check size={18} /> Apply Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
