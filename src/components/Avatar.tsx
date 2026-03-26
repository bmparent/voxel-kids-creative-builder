import { useMemo } from 'react';
import * as THREE from 'three';

interface AvatarProps {
  color?: string;
  clothingColor?: string;
  hairColor?: string;
  style?: string;
  isPlayer?: boolean;
}

export const Avatar = ({ 
  color = '#ffcc00', 
  clothingColor = '#3b82f6', 
  hairColor = '#4b2c20',
  style = 'casual',
  isPlayer = false
}: AvatarProps) => {
  // Simple voxel-style character
  return (
    <group name={isPlayer ? "player-avatar" : undefined}>
      {/* Head */}
      <mesh position={[0, 1.6, 0]} castShadow>
        <boxGeometry args={[0.4, 0.4, 0.4]} />
        <meshStandardMaterial color={color} />
      </mesh>

      {/* Hair */}
      <mesh position={[0, 1.85, 0]} castShadow>
        <boxGeometry args={[0.45, 0.15, 0.45]} />
        <meshStandardMaterial color={hairColor} />
      </mesh>

      {/* Body */}
      <mesh position={[0, 1.1, 0]} castShadow>
        <boxGeometry args={[0.6, 0.7, 0.3]} />
        <meshStandardMaterial color={clothingColor} />
      </mesh>

      {/* Arms */}
      <mesh position={[-0.4, 1.1, 0]} castShadow>
        <boxGeometry args={[0.2, 0.6, 0.2]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <mesh position={[0.4, 1.1, 0]} castShadow>
        <boxGeometry args={[0.2, 0.6, 0.2]} />
        <meshStandardMaterial color={color} />
      </mesh>

      {/* Legs */}
      <mesh position={[-0.15, 0.4, 0]} castShadow>
        <boxGeometry args={[0.25, 0.8, 0.25]} />
        <meshStandardMaterial color="#1e293b" /> {/* Pants color */}
      </mesh>
      <mesh position={[0.15, 0.4, 0]} castShadow>
        <boxGeometry args={[0.25, 0.8, 0.25]} />
        <meshStandardMaterial color="#1e293b" />
      </mesh>

      {/* Eyes */}
      <mesh position={[-0.1, 1.65, 0.2]} castShadow>
        <boxGeometry args={[0.05, 0.05, 0.05]} />
        <meshStandardMaterial color="black" />
      </mesh>
      <mesh position={[0.1, 1.65, 0.2]} castShadow>
        <boxGeometry args={[0.05, 0.05, 0.05]} />
        <meshStandardMaterial color="black" />
      </mesh>

      {/* Style Specifics */}
      {style === 'worker' && (
        <mesh position={[0, 1.9, 0.1]} castShadow>
          <boxGeometry args={[0.5, 0.1, 0.5]} />
          <meshStandardMaterial color="#facc15" /> {/* Yellow hard hat */}
        </mesh>
      )}
      {style === 'formal' && (
        <mesh position={[0, 1.2, 0.16]} castShadow>
          <boxGeometry args={[0.1, 0.3, 0.02]} />
          <meshStandardMaterial color="#ef4444" /> {/* Red tie */}
        </mesh>
      )}
      {style === 'sporty' && (
        <mesh position={[0, 1.85, 0.2]} castShadow>
          <boxGeometry args={[0.3, 0.05, 0.1]} />
          <meshStandardMaterial color="#3b82f6" /> {/* Headband */}
        </mesh>
      )}
      {style === 'artist' && (
        <mesh position={[0.15, 1.85, -0.1]} castShadow>
          <boxGeometry args={[0.2, 0.2, 0.2]} />
          <meshStandardMaterial color="#ec4899" /> {/* Beret-ish */}
        </mesh>
      )}
    </group>
  );
};
