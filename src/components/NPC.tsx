import { useState, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useBox } from '@react-three/cannon';
import { Text, Html, Billboard } from '@react-three/drei';
import * as THREE from 'three';
import { Avatar } from './Avatar';

interface NPCProps {
  position: [number, number, number];
  name: string;
  color: string;
  clothingColor?: string;
  hairColor?: string;
  style?: string;
  isThinking?: boolean;
  currentTask?: string;
  currentMessage?: string;
  onInteract: () => void;
}

export const NPC = ({ position, name, color, clothingColor, hairColor, style, isThinking, currentTask, currentMessage, onInteract }: NPCProps) => {
  const [hover, setHover] = useState(false);
  const [ref] = useBox(() => ({
    mass: 1,
    type: 'Dynamic',
    position,
    args: [0.6, 1.8, 0.6],
    fixedRotation: true,
  }));

  const groupRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (groupRef.current) {
      // Make the NPC look at the player
      const playerPos = state.camera.position;
      const angle = Math.atan2(playerPos.x - position[0], playerPos.z - position[2]);
      groupRef.current.rotation.y = angle;
    }
  });

  return (
    <group 
      ref={ref as any} 
      onPointerOver={() => setHover(true)} 
      onPointerOut={() => setHover(false)} 
      onClick={(e) => {
        e.stopPropagation();
        onInteract();
      }}
    >
      <group ref={groupRef} position={[0, -0.9, 0]}>
        <Avatar 
          color={color} 
          clothingColor={clothingColor} 
          hairColor={hairColor} 
          style={style} 
        />
      </group>

      {/* Name Tag */}
      <Billboard position={[0, 1.2, 0]}>
        <Text
          fontSize={0.2}
          color={isThinking ? "#fbbf24" : "white"}
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.02}
          outlineColor="black"
        >
          {isThinking ? `${name} (Thinking...)` : name}
        </Text>
      </Billboard>

      {/* Thinking Bubble */}
      {isThinking && (
        <Html position={[0, 1.8, 0]} center>
          <div className="bg-yellow-400 text-gray-900 px-3 py-2 rounded-2xl text-[10px] font-bold whitespace-nowrap border-2 border-white shadow-xl animate-bounce">
            {currentTask || "Hmm..."}
          </div>
        </Html>
      )}

      {/* Speech Bubble */}
      {currentMessage && (
        <Html position={[0, 2.2, 0]} center>
          <div className="bg-white text-gray-900 px-4 py-2 rounded-2xl text-sm font-medium max-w-[200px] text-center border-2 border-gray-900 shadow-2xl relative">
            {currentMessage}
            <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-white border-r-2 border-b-2 border-gray-900 rotate-45" />
          </div>
        </Html>
      )}

      {/* Interaction Prompt */}
      {hover && (
        <Html position={[0, 1.5, 0]} center>
          <div className="bg-black/80 text-white px-2 py-1 rounded text-xs whitespace-nowrap border border-white/20">
            Click to Talk
          </div>
        </Html>
      )}
    </group>
  );
};
