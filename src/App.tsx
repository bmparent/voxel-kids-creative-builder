/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Canvas } from '@react-three/fiber';
import { Sky, Stars, OrbitControls, Environment } from '@react-three/drei';
import { Physics } from '@react-three/cannon';
import { useStore } from './hooks/useStore';
import { Cube } from './components/Cube';
import { Ground } from './components/Ground';
import { Player } from './components/Player';
import { NPC } from './components/NPC';
import { TextureSelector } from './components/TextureSelector';
import { ShapeSelector } from './components/ShapeSelector';
import { ScaleSelector } from './components/ScaleSelector';
import { AIChat } from './components/AIChat';
import { AvatarCustomizer } from './components/AvatarCustomizer';
import { NPCBrain } from './components/NPCBrain';
import { LiveConversation } from './components/LiveConversation';
import { WorldMap } from './components/WorldMap';
import { useState, useEffect } from 'react';
import { Save, Trash2, HelpCircle, X, MousePointer2, User, Camera, Navigation } from 'lucide-react';
import confetti from 'canvas-confetti';
import { useNetworkSync } from './network/syncService';

import { DraggedCube } from './components/DraggedCube';

export default function App() {
  const cubes = useStore((state) => state.cubes);
  const npcs = useStore((state) => state.npcs);
  const isInWater = useStore((state) => state.isInWater);
  const saveWorld = useStore((state) => state.saveWorld);
  const resetWorld = useStore((state) => state.resetWorld);
  const teleportPlayer = useStore((state) => state.teleportPlayer);
  const cameraMode = useStore((state) => state.cameraMode);
  const setCameraMode = useStore((state) => state.setCameraMode);
  const [showHelp, setShowHelp] = useState(true);
  const [isLocked, setIsLocked] = useState(false);
  const [isCooldown, setIsCooldown] = useState(false);
  const [activeNPC, setActiveNPC] = useState<string | null>(null);
  const [showCustomizer, setShowCustomizer] = useState(false);

  const [isUIHovered, setIsUIHovered] = useState(false);

  // Initialize network sync (load from server, autosave)
  useNetworkSync();

  // Manage pointer lock cooldown to avoid browser errors
  useEffect(() => {
    if (!showHelp && !isLocked && !showCustomizer && !activeNPC && !isUIHovered) {
      setIsCooldown(true);
      const timer = setTimeout(() => setIsCooldown(false), 1500);
      return () => clearTimeout(timer);
    } else {
      setIsCooldown(false);
    }
  }, [showHelp, isLocked, showCustomizer, activeNPC, isUIHovered]);

  const handleSave = () => {
    saveWorld();
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 }
    });
  };

  return (
    <div id="game-container" className="w-full h-screen bg-[#87CEEB] relative overflow-hidden">
      {/* Game Canvas */}
      <Canvas shadows camera={{ fov: 45 }}>
        <Sky sunPosition={[100, 20, 100]} />
        <Environment preset="sunset" />
        <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />
        <ambientLight intensity={0.3} />
        <directionalLight
          castShadow
          position={[50, 50, 20]}
          intensity={1.5}
          shadow-mapSize={[2048, 2048]}
          shadow-camera-left={-20}
          shadow-camera-right={20}
          shadow-camera-top={20}
          shadow-camera-bottom={-20}
        />
        
        <Physics gravity={[0, -15, 0]}>
          <Player 
            isHelpOpen={showHelp} 
            isLocked={isLocked}
            onLock={() => setIsLocked(true)} 
            onUnlock={() => setIsLocked(false)} 
          />
          <Ground />
          {cubes.map((cube) => (
            <Cube 
              key={cube.id} 
              position={cube.pos} 
              texture={cube.texture} 
              shape={cube.shape} 
              scale={cube.scale} 
              rotation={cube.rotation}
              color={cube.color}
            />
          ))}
          {npcs.map((npc) => (
            <NPC 
              key={npc.id} 
              position={npc.pos} 
              name={npc.name} 
              color={npc.color} 
              clothingColor={npc.clothingColor}
              hairColor={npc.hairColor}
              style={npc.style}
              isThinking={npc.isThinking}
              currentTask={npc.currentTask}
              currentMessage={npc.currentMessage}
              onInteract={() => {
                setActiveNPC(npc.id);
                setIsLocked(false); // Unlock cursor to interact with chat
              }}
            />
          ))}
        </Physics>
        <DraggedCube />
      </Canvas>

      {/* Crosshair */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
        <div className="w-4 h-4 border-2 border-white/50 rounded-full flex items-center justify-center">
          <div className="w-1 h-1 bg-white rounded-full"></div>
        </div>
      </div>

      {/* UI Controls */}
      <div 
        className="absolute top-6 left-6 flex flex-col gap-4 z-50"
        onMouseEnter={() => setIsUIHovered(true)}
        onMouseLeave={() => setIsUIHovered(false)}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/20 shadow-xl">
          <h1 className="text-white font-bold text-xl tracking-tight">Voxel Kids</h1>
          <p className="text-white/60 text-xs">Creative Builder • {cameraMode === 'first' ? 'First Person' : 'Third Person'}</p>
        </div>
        
        <div className="flex gap-2">
          <button 
            onClick={handleSave}
            className="p-3 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-xl border border-white/20 text-white transition-all hover:scale-105"
            title="Save World"
          >
            <Save size={20} />
          </button>
          <button 
            onClick={() => setShowCustomizer(true)}
            className="p-3 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-xl border border-white/20 text-white transition-all hover:scale-105"
            title="Customize Avatar"
          >
            <User size={20} />
          </button>
          <button 
            onClick={() => {
              if (cameraMode === 'first') {
                setCameraMode('third');
                useStore.getState().setCameraDistance(5);
              } else {
                setCameraMode('first');
                useStore.getState().setCameraDistance(0);
              }
            }}
            className="p-3 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-xl border border-white/20 text-white transition-all hover:scale-105 flex items-center gap-2"
            title="Toggle Camera (V / Scroll)"
          >
            <Camera size={20} />
            <span className="text-xs font-bold uppercase tracking-wider hidden md:block">
              {cameraMode === 'first' ? '1st' : '3rd'}
            </span>
          </button>
          <button 
            onClick={() => {
              resetWorld();
            }}
            className="p-3 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-xl border border-white/20 text-white transition-all hover:scale-105"
            title="Reset World"
          >
            <Trash2 size={20} />
          </button>
          <button 
            onClick={() => teleportPlayer([0, 0, 0])}
            className="p-3 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-xl border border-white/20 text-white transition-all hover:scale-105"
            title="Back to Spawn"
          >
            <Navigation size={20} />
          </button>
          <button 
            onClick={() => setShowHelp(true)}
            className="p-3 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-xl border border-white/20 text-white transition-all hover:scale-105"
          >
            <HelpCircle size={20} />
          </button>
        </div>
      </div>

      {/* Mini Map */}
      <div className="absolute bottom-6 left-6 w-32 h-32 bg-black/40 backdrop-blur-md rounded-2xl border border-white/20 overflow-hidden shadow-2xl pointer-events-none">
        <div className="relative w-full h-full">
          {npcs.map(npc => (
            <div 
              key={npc.id}
              className="absolute w-2 h-2 rounded-full border border-white shadow-sm"
              style={{ 
                backgroundColor: npc.color,
                left: `${50 + npc.pos[0] * 2}%`,
                top: `${50 + npc.pos[2] * 2}%`
              }}
            />
          ))}
          <div className="absolute w-2 h-2 bg-white rounded-full left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 border border-blue-500 shadow-sm" />
          <div className="absolute inset-0 border border-white/10 pointer-events-none" />
        </div>
      </div>

      {/* Selectors Container */}
      <div 
        onMouseEnter={() => setIsUIHovered(true)}
        onMouseLeave={() => setIsUIHovered(false)}
      >
        {/* Texture Selector */}
        <TextureSelector />

        {/* Shape Selector */}
        <ShapeSelector />

        {/* Scale Selector */}
        <ScaleSelector />
      </div>

      {/* AI Assistant */}
      <div 
        onMouseEnter={() => setIsUIHovered(true)}
        onMouseLeave={() => setIsUIHovered(false)}
      >
        <AIChat activeNPC={activeNPC} onCloseNPC={() => setActiveNPC(null)} />
      </div>

      {/* NPC Autonomous Brain */}
      <NPCBrain />

      {/* Live Voice Conversation */}
      <LiveConversation activeNPCId={activeNPC} />

      {/* World Map */}
      <WorldMap />

      {/* Avatar Customizer */}
      <div 
        onMouseEnter={() => setIsUIHovered(true)}
        onMouseLeave={() => setIsUIHovered(false)}
      >
        {showCustomizer && <AvatarCustomizer onClose={() => setShowCustomizer(false)} />}
      </div>

      {/* Underwater Overlay */}
      {isInWater && <div id="underwater-overlay" />}

      {/* Click to Resume Overlay */}
      {!showHelp && !isLocked && !showCustomizer && !activeNPC && !isUIHovered && (
        <div 
          id="lock-trigger"
          className={`absolute inset-0 z-40 flex items-center justify-center bg-black/40 backdrop-blur-[2px] transition-opacity duration-300 ${
            isCooldown ? 'pointer-events-auto cursor-wait opacity-50' : 'pointer-events-auto cursor-pointer opacity-100'
          } group`}
        >
          {!isCooldown && (
            <div className="flex flex-col items-center gap-4 animate-in fade-in zoom-in duration-300">
              <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center border border-white/40 group-hover:scale-110 transition-transform">
                <MousePointer2 size={32} className="text-white" />
              </div>
              <p className="text-white font-bold text-lg tracking-widest uppercase drop-shadow-lg">Click to Resume</p>
            </div>
          )}
        </div>
      )}

      {/* Help Modal */}
      {showHelp && (
        <div 
          className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-6"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl relative" onClick={(e) => e.stopPropagation()}>
            <button 
              onClick={(e) => {
                e.stopPropagation();
                setShowHelp(false);
              }}
              className="absolute top-6 right-6 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X size={24} />
            </button>
            
            <h2 className="text-3xl font-bold text-gray-900 mb-6">How to Play</h2>
            
            <div className="space-y-6">
              <section>
                <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Movement</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-3">
                    <kbd className="px-2 py-1 bg-gray-100 border border-gray-200 rounded text-xs font-mono">W,A,S,D</kbd>
                    <span className="text-sm text-gray-600">Move around</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <kbd className="px-2 py-1 bg-gray-100 border border-gray-200 rounded text-xs font-mono">SPACE</kbd>
                    <span className="text-sm text-gray-600">Jump</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <kbd className="px-2 py-1 bg-gray-100 border border-gray-200 rounded text-xs font-mono">SHIFT</kbd>
                    <span className="text-sm text-gray-600">Sprint</span>
                  </div>
                </div>
              </section>

              <section>
                <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Building</h3>
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-gray-700">Click</span>
                    <span className="text-sm text-gray-600">Place a block</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-gray-700">Alt + Click</span>
                    <span className="text-sm text-gray-600">Remove a block</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <kbd className="px-2 py-1 bg-gray-100 border border-gray-200 rounded text-xs font-mono">1-6</kbd>
                    <span className="text-sm text-gray-600">Switch blocks</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-gray-700">Top Menu</span>
                    <span className="text-sm text-gray-600">Change shapes (Tree, Rock!)</span>
                  </div>
                </div>
              </section>

              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setShowHelp(false);
                }}
                className="w-full py-4 bg-gray-900 text-white rounded-2xl font-bold hover:bg-gray-800 transition-all active:scale-95 mt-4"
              >
                Let's Build!
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Instructions Tip */}
      <div className="absolute top-6 right-6 text-right pointer-events-none">
        <p className="text-white/80 text-sm font-medium drop-shadow-md">Click to start building</p>
        <p className="text-white/40 text-xs">Press ESC to unlock cursor</p>
      </div>
    </div>
  );
}

