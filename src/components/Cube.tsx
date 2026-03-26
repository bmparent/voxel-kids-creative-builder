import { useState, useMemo, useRef } from 'react';
import { useStore, ShapeType } from '../hooks/useStore';
import { ThreeEvent } from '@react-three/fiber';
import { Edges } from '@react-three/drei';
import { getTexture } from '../utils/textures';
import { useBox, useSphere, useCylinder, useCompoundBody } from '@react-three/cannon';
import { nanoid } from 'nanoid';

interface CubeProps {
  position: [number, number, number];
  texture: string;
  shape?: ShapeType;
  scale?: number;
  rotation?: [number, number, number];
  color?: string;
}

export const Cube = ({ position, texture, shape = 'cube', scale = 1, rotation = [0, 0, 0], color = '#ffffff' }: CubeProps) => {
  const [hover, setHover] = useState<boolean>(false);
  const addCube = useStore((state) => state.addCube);
  const removeCube = useStore((state) => state.removeCube);
  const activeScale = useStore((state) => state.scale);

  const isGlass = texture === 'glass';
  const isWater = texture === 'water';

  const physicsProps = {
    position,
    rotation,
    type: 'Static' as const, // Static so they don't fall, but provide collisions
  };

  const [boxRef] = useBox(() => ({ ...physicsProps, args: [scale, scale, scale], isSensor: isWater }), undefined, [shape, scale, rotation, isWater]);
  const [sphereRef] = useSphere(() => ({ ...physicsProps, args: [0.5 * scale], isSensor: isWater }), undefined, [shape, scale, rotation, isWater]);
  const [cylinderRef] = useCylinder(() => ({ ...physicsProps, args: [0.5 * scale, 0.5 * scale, 1 * scale, 32], isSensor: isWater }), undefined, [shape, scale, rotation, isWater]);
  const [coneRef] = useCylinder(() => ({ ...physicsProps, args: [0, 0.7 * scale, 1 * scale, 4], isSensor: isWater }), undefined, [shape, scale, rotation, isWater]);
  const [rockRef] = useSphere(() => ({ ...physicsProps, args: [0.6 * scale], isSensor: isWater }), undefined, [shape, scale, rotation, isWater]);
  const [treeRef] = useCompoundBody(() => ({
    ...physicsProps,
    isSensor: isWater,
    shapes: [
      { type: 'Cylinder', args: [0.2 * scale, 0.2 * scale, 1 * scale, 8], position: [0, 0, 0] },
      { type: 'Sphere', args: [0.6 * scale], position: [0, 0.8 * scale, 0] },
    ],
  }), undefined, [shape, scale, rotation, isWater]);

  const ref = useMemo(() => {
    switch (shape) {
      case 'sphere': return sphereRef;
      case 'cylinder': return cylinderRef;
      case 'pyramid': return coneRef;
      case 'tree': return treeRef;
      case 'rock': return rockRef;
      default: return boxRef;
    }
  }, [shape, boxRef, sphereRef, cylinderRef, coneRef, treeRef, rockRef]);

  const textureMap = useMemo(() => getTexture(texture), [texture]);

  const handlePointerMove = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    setHover(true);
  };

  const handlePointerOut = () => {
    setHover(false);
  };

  const dragTimer = useRef<NodeJS.Timeout | null>(null);
  const isDragging = useRef(false);
  const setDraggedCube = useStore((state) => state.setDraggedCube);

  const handlePointerDown = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    if (e.button !== 0) return; // Only left click

    isDragging.current = false;
    dragTimer.current = setTimeout(() => {
      isDragging.current = true;
      setDraggedCube({
        id: nanoid(),
        pos: position,
        texture,
        shape,
        scale,
        rotation,
        color,
        originalPos: position
      });
      removeCube(position[0], position[1], position[2]);
    }, 200); // 200ms hold to drag

    const handleGlobalPointerUp = () => {
      if (dragTimer.current) {
        clearTimeout(dragTimer.current);
        dragTimer.current = null;
      }
      window.removeEventListener('pointerup', handleGlobalPointerUp);
    };
    window.addEventListener('pointerup', handleGlobalPointerUp);
  };

  const handlePointerUp = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    if (e.button !== 0) return;

    if (dragTimer.current) {
      clearTimeout(dragTimer.current);
      dragTimer.current = null;
    }

    if (!isDragging.current) {
      if (e.altKey) {
        removeCube(position[0], position[1], position[2]);
        return;
      }

      // Don't allow building on top of water easily, or maybe we do?
      // For now, let's allow it.
      const normal = e.intersections[0].face?.normal;
      if (!normal) return;

      // Determine the dominant axis of the normal to find the exact face clicked
      let dx = 0, dy = 0, dz = 0;
      const absX = Math.abs(normal.x);
      const absY = Math.abs(normal.y);
      const absZ = Math.abs(normal.z);

      if (absX >= absY && absX >= absZ) dx = Math.sign(normal.x);
      else if (absY >= absX && absY >= absZ) dy = Math.sign(normal.y);
      else dz = Math.sign(normal.z);

      // Calculate the offset based on the scale of the current block and the new block
      // This ensures they touch perfectly without overlapping
      const offset = (scale / 2) + (activeScale / 2);

      // Calculate new position and snap to a 0.25 grid to prevent floating point drift
      const newPos: [number, number, number] = [
        Math.round((position[0] + dx * offset) * 4) / 4,
        Math.round((position[1] + dy * offset) * 4) / 4,
        Math.round((position[2] + dz * offset) * 4) / 4
      ];

      addCube(...newPos);
    }
  };

  const renderGeometry = () => {
    switch (shape) {
      case 'sphere':
        return <sphereGeometry args={[0.5, 32, 32]} />;
      case 'pyramid':
        return <coneGeometry args={[0.7, 1, 4]} />;
      case 'cylinder':
        return <cylinderGeometry args={[0.5, 0.5, 1, 32]} />;
      case 'tree':
        return (
          <group>
            <mesh castShadow receiveShadow>
              <cylinderGeometry args={[0.2, 0.2, 1, 8]} />
              <meshStandardMaterial map={getTexture('log')} />
            </mesh>
            <mesh position={[0, 0.8, 0]} castShadow receiveShadow>
              <sphereGeometry args={[0.6, 16, 16]} />
              <meshStandardMaterial map={getTexture('grass')} />
            </mesh>
          </group>
        );
      case 'rock':
        return (
          <mesh castShadow receiveShadow scale={[1.2, 0.8, 1.1]}>
            <sphereGeometry args={[0.5, 8, 8]} />
            <meshStandardMaterial map={getTexture('stone')} />
          </mesh>
        );
      case 'bush':
        return (
          <mesh castShadow receiveShadow position={[0, 0.2, 0]}>
            <sphereGeometry args={[0.6, 16, 16]} />
            <meshStandardMaterial map={getTexture('grass')} color="#4ade80" />
          </mesh>
        );
      case 'flower':
        return (
          <group>
            <mesh position={[0, -0.2, 0]} castShadow receiveShadow>
              <cylinderGeometry args={[0.05, 0.05, 0.6, 8]} />
              <meshStandardMaterial color="#22c55e" />
            </mesh>
            <mesh position={[0, 0.2, 0]} castShadow receiveShadow>
              <sphereGeometry args={[0.2, 16, 16]} />
              <meshStandardMaterial color="#ef4444" />
            </mesh>
          </group>
        );
      case 'lamp':
        return (
          <group>
            <mesh position={[0, -0.2, 0]} castShadow receiveShadow>
              <cylinderGeometry args={[0.1, 0.1, 0.6, 8]} />
              <meshStandardMaterial color="#4b5563" />
            </mesh>
            <mesh position={[0, 0.2, 0]} castShadow receiveShadow>
              <sphereGeometry args={[0.25, 16, 16]} />
              <meshStandardMaterial color="#fef08a" emissive="#fef08a" emissiveIntensity={1} />
            </mesh>
            <pointLight position={[0, 0.2, 0]} color="#fef08a" intensity={0.5} distance={5} />
          </group>
        );
      case 'fence':
        return (
          <group>
            <mesh position={[-0.4, 0, 0]} castShadow receiveShadow>
              <boxGeometry args={[0.1, 1, 0.1]} />
              <meshStandardMaterial map={getTexture('wood')} />
            </mesh>
            <mesh position={[0.4, 0, 0]} castShadow receiveShadow>
              <boxGeometry args={[0.1, 1, 0.1]} />
              <meshStandardMaterial map={getTexture('wood')} />
            </mesh>
            <mesh position={[0, 0.2, 0]} castShadow receiveShadow>
              <boxGeometry args={[1, 0.1, 0.05]} />
              <meshStandardMaterial map={getTexture('wood')} />
            </mesh>
            <mesh position={[0, -0.2, 0]} castShadow receiveShadow>
              <boxGeometry args={[1, 0.1, 0.05]} />
              <meshStandardMaterial map={getTexture('wood')} />
            </mesh>
          </group>
        );
      case 'cube':
      default:
        return <boxGeometry args={[1, 1, 1]} />;
    }
  };

  const materialProps = useMemo(() => {
    if (isWater) {
      return (
        <meshPhysicalMaterial
          map={textureMap}
          color={hover ? '#ffeb3b' : '#0077be'}
          transmission={0.6}
          opacity={0.6}
          transparent
          roughness={0.1}
          metalness={0.1}
          ior={1.33}
          thickness={0.5}
        />
      );
    }
    if (isGlass) {
      return (
        <meshPhysicalMaterial
          map={textureMap}
          color={hover ? '#ffeb3b' : color}
          transmission={0.9}
          opacity={1}
          transparent
          roughness={0.1}
          metalness={0.1}
          ior={1.5}
          thickness={0.5}
        />
      );
    }
    return (
      <meshStandardMaterial
        map={textureMap}
        bumpMap={textureMap}
        bumpScale={0.02}
        color={hover ? '#ffeb3b' : color}
        roughness={0.8}
        metalness={0.1}
      />
    );
  }, [isWater, isGlass, textureMap, hover, color]);

  return (
    <mesh
      ref={ref as any}
      onPointerMove={handlePointerMove}
      onPointerOut={handlePointerOut}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      castShadow
      receiveShadow
      scale={[scale, scale, scale]}
    >
      {renderGeometry()}
      {!(shape === 'tree' || shape === 'rock' || shape === 'bush' || shape === 'flower' || shape === 'lamp' || shape === 'fence') && materialProps}
      {shape === 'cube' && <Edges scale={1} threshold={15} color="black" opacity={0.2} transparent />}
    </mesh>
  );
};
