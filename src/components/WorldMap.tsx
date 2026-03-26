import { useStore } from '../hooks/useStore';
import { motion, AnimatePresence } from 'framer-motion';
import { Map as MapIcon, X, Navigation, User, Users } from 'lucide-react';

export const WorldMap = () => {
  const showMap = useStore(state => state.showMap);
  const setShowMap = useStore(state => state.setShowMap);
  const npcs = useStore(state => state.npcs);
  const teleportPlayer = useStore(state => state.teleportPlayer);
  
  // We'll assume a 100x100 grid for the map display
  const mapSize = 300;
  const worldScale = 5; // How much to scale world coordinates to map pixels

  return (
    <>
      {/* Map Toggle Button */}
      <button
        onClick={() => setShowMap(!showMap)}
        className="fixed top-6 right-24 z-50 p-3 bg-gray-900 text-white rounded-xl shadow-xl hover:bg-gray-800 transition-all active:scale-95"
        title="World Map"
      >
        <MapIcon size={24} />
      </button>

      <AnimatePresence>
        {showMap && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none"
          >
            <div className="bg-white rounded-3xl shadow-2xl p-6 w-[400px] pointer-events-auto border border-gray-100">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2 text-gray-900">
                  <MapIcon size={20} />
                  <h2 className="font-bold text-lg uppercase tracking-wider">World Map</h2>
                </div>
                <button onClick={() => setShowMap(false)} className="text-gray-400 hover:text-gray-900">
                  <X size={24} />
                </button>
              </div>

              {/* Map Grid */}
              <div 
                className="relative bg-gray-100 rounded-2xl overflow-hidden border border-gray-200 mx-auto mb-6"
                style={{ width: mapSize, height: mapSize }}
              >
                {/* Grid Lines */}
                <div className="absolute inset-0 opacity-10" style={{ 
                  backgroundImage: 'radial-gradient(circle, #000 1px, transparent 1px)',
                  backgroundSize: '20px 20px'
                }} />

                {/* Center Marker (Origin) */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1 h-1 bg-gray-300 rounded-full" />

                {/* NPCs on Map */}
                {npcs.map(npc => (
                  <motion.button
                    key={npc.id}
                    whileHover={{ scale: 1.2 }}
                    onClick={() => {
                      teleportPlayer(npc.pos);
                      setShowMap(false);
                    }}
                    className="absolute w-6 h-6 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center rounded-full shadow-lg border-2 border-white group"
                    style={{ 
                      left: mapSize / 2 + npc.pos[0] * worldScale,
                      top: mapSize / 2 + npc.pos[2] * worldScale,
                      backgroundColor: npc.color
                    }}
                    title={`Teleport to ${npc.name}`}
                  >
                    <Users size={12} className="text-white" />
                    <div className="absolute bottom-full mb-1 hidden group-hover:block bg-gray-900 text-white text-[10px] px-2 py-1 rounded whitespace-nowrap">
                      {npc.name}
                    </div>
                  </motion.button>
                ))}

                {/* Legend/Info */}
                <div className="absolute bottom-2 left-2 text-[10px] text-gray-400 font-bold uppercase">
                  Click NPC to Teleport
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Active NPCs ({npcs.length})</h3>
                <div className="max-h-40 overflow-y-auto pr-2 space-y-2">
                  {npcs.map(npc => (
                    <div 
                      key={npc.id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100 hover:bg-gray-100 transition-colors cursor-pointer group"
                      onClick={() => {
                        teleportPlayer(npc.pos);
                        setShowMap(false);
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: npc.color }} />
                        <div>
                          <p className="text-sm font-bold text-gray-900">{npc.name}</p>
                          <p className="text-[10px] text-gray-500 uppercase">{npc.isThinking ? npc.currentTask : 'Idle'}</p>
                        </div>
                      </div>
                      <Navigation size={14} className="text-gray-300 group-hover:text-gray-900 transition-colors" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
