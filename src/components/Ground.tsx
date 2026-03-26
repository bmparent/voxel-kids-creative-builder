import { useStore } from '../hooks/useStore';
import { ThreeEvent } from '@react-three/fiber';
import { getTexture } from '../utils/textures';
import { useMemo } from 'react';
import * as THREE from 'three';
import { usePlane } from '@react-three/cannon';

export const Ground = () => {
  const addCube = useStore((state) => state.addCube);
  const activeScale = useStore((state) => state.scale);

  const [ref] = usePlane(() => ({
    rotation: [-Math.PI / 2, 0, 0],
    position: [0, -0.5, 0],
  }));

  const texture = useMemo(() => {
    const tex = getTexture('grass').clone();
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(100, 100);
    return tex;
  }, []);

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    // The ground is at y = -0.5
    // The center of the new block should be at y = -0.5 + (activeScale / 2)
    const newY = -0.5 + (activeScale / 2);
    
    // Snap x and z to the nearest integer grid for clean alignment
    addCube(Math.round(e.point.x), newY, Math.round(e.point.z));
  };

  return (
    <group>
      <mesh ref={ref as any} onClick={handleClick} receiveShadow>
        <planeGeometry args={[100, 100]} />
        <meshStandardMaterial map={texture} roughness={1} />
      </mesh>
      <gridHelper args={[100, 100, '#000000', '#000000']} position={[0, -0.49, 0]} material-opacity={0.15} material-transparent />
    </group>
  );
};
