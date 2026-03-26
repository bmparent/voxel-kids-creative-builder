import { useFrame, useThree } from '@react-three/fiber';
import { useStore } from '../hooks/useStore';
import { useRef, useEffect } from 'react';
import { Group, Vector3, Raycaster, Vector2 } from 'three';
import { getTexture } from '../utils/textures';

export const DraggedCube = () => {
  const draggedCube = useStore(state => state.draggedCube);
  const setDraggedCube = useStore(state => state.setDraggedCube);
  const bulkAddCubes = useStore(state => state.bulkAddCubes);
  const ref = useRef<Group>(null);
  const { camera, scene } = useThree();
  const raycaster = new Raycaster();
  const center = new Vector2(0, 0);
  const currentPos = useRef<[number, number, number]>([0, 0, 0]);

  useEffect(() => {
    if (!draggedCube) return;

    const handlePointerUp = (e: PointerEvent) => {
      if (e.button !== 0) return;
      
      // Drop the cube
      bulkAddCubes([{
        x: currentPos.current[0],
        y: currentPos.current[1],
        z: currentPos.current[2],
        texture: draggedCube.texture,
        shape: draggedCube.shape,
        scale: draggedCube.scale,
        rotation: draggedCube.rotation,
        color: draggedCube.color
      }]);
      
      setDraggedCube(null);
    };

    window.addEventListener('pointerup', handlePointerUp);
    return () => window.removeEventListener('pointerup', handlePointerUp);
  }, [draggedCube, bulkAddCubes, setDraggedCube]);

  useFrame(() => {
    if (ref.current && draggedCube) {
      raycaster.setFromCamera(center, camera);
      const intersects = raycaster.intersectObjects(scene.children, true);
      
      let targetPoint = null;
      let normal = null;

      for (const intersect of intersects) {
        let obj = intersect.object;
        let isIgnored = false;
        while (obj) {
          if (obj.name === 'dragged-cube' || obj.name === 'player-avatar') {
            isIgnored = true;
            break;
          }
          obj = obj.parent as any;
        }
        
        if (!isIgnored && !intersect.object.name.includes('sky')) {
          targetPoint = intersect.point;
          normal = intersect.face?.normal;
          break;
        }
      }

      if (targetPoint && normal) {
        let dx = 0, dy = 0, dz = 0;
        const absX = Math.abs(normal.x);
        const absY = Math.abs(normal.y);
        const absZ = Math.abs(normal.z);

        if (absX >= absY && absX >= absZ) dx = Math.sign(normal.x);
        else if (absY >= absX && absY >= absZ) dy = Math.sign(normal.y);
        else dz = Math.sign(normal.z);

        const offset = draggedCube.scale / 2;
        
        const snappedX = Math.round((targetPoint.x + dx * offset) * 4) / 4;
        const snappedY = Math.max(0, Math.round((targetPoint.y + dy * offset) * 4) / 4);
        const snappedZ = Math.round((targetPoint.z + dz * offset) * 4) / 4;
        
        currentPos.current = [snappedX, snappedY, snappedZ];
        ref.current.position.set(snappedX, snappedY, snappedZ);
      } else {
        const vec = new Vector3();
        camera.getWorldDirection(vec);
        vec.multiplyScalar(10);
        vec.add(camera.position);
        
        const snappedX = Math.round(vec.x * 4) / 4;
        const snappedY = Math.max(0, Math.round(vec.y * 4) / 4);
        const snappedZ = Math.round(vec.z * 4) / 4;
        
        currentPos.current = [snappedX, snappedY, snappedZ];
        ref.current.position.set(snappedX, snappedY, snappedZ);
      }
    }
  });

  if (!draggedCube) return null;

  const textureMap = getTexture(draggedCube.texture);

  return (
    <group ref={ref as any} name="dragged-cube" scale={draggedCube.scale} rotation={draggedCube.rotation}>
      {draggedCube.shape === 'cube' && (
        <mesh>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial map={textureMap} color={draggedCube.color} transparent opacity={0.6} />
        </mesh>
      )}
      {draggedCube.shape === 'sphere' && (
        <mesh>
          <sphereGeometry args={[0.5, 32, 32]} />
          <meshStandardMaterial map={textureMap} color={draggedCube.color} transparent opacity={0.6} />
        </mesh>
      )}
      {draggedCube.shape === 'cylinder' && (
        <mesh>
          <cylinderGeometry args={[0.5, 0.5, 1, 32]} />
          <meshStandardMaterial map={textureMap} color={draggedCube.color} transparent opacity={0.6} />
        </mesh>
      )}
      {draggedCube.shape === 'pyramid' && (
        <mesh>
          <cylinderGeometry args={[0, 0.7, 1, 4]} />
          <meshStandardMaterial map={textureMap} color={draggedCube.color} transparent opacity={0.6} />
        </mesh>
      )}
      {draggedCube.shape === 'rock' && (
        <mesh>
          <sphereGeometry args={[0.6, 7, 7]} />
          <meshStandardMaterial map={textureMap} color={draggedCube.color} transparent opacity={0.6} />
        </mesh>
      )}
      {draggedCube.shape === 'tree' && (
        <group>
          <mesh position={[0, 0, 0]}>
            <cylinderGeometry args={[0.2, 0.2, 1, 8]} />
            <meshStandardMaterial color="#8B4513" transparent opacity={0.6} />
          </mesh>
          <mesh position={[0, 0.8, 0]}>
            <sphereGeometry args={[0.6, 8, 8]} />
            <meshStandardMaterial color="#228B22" transparent opacity={0.6} />
          </mesh>
        </group>
      )}
      {draggedCube.shape === 'bush' && (
        <mesh position={[0, 0.2, 0]}>
          <sphereGeometry args={[0.6, 16, 16]} />
          <meshStandardMaterial map={getTexture('grass')} color="#4ade80" transparent opacity={0.6} />
        </mesh>
      )}
      {draggedCube.shape === 'flower' && (
        <group>
          <mesh position={[0, -0.2, 0]}>
            <cylinderGeometry args={[0.05, 0.05, 0.6, 8]} />
            <meshStandardMaterial color="#22c55e" transparent opacity={0.6} />
          </mesh>
          <mesh position={[0, 0.2, 0]}>
            <sphereGeometry args={[0.2, 16, 16]} />
            <meshStandardMaterial color="#ef4444" transparent opacity={0.6} />
          </mesh>
        </group>
      )}
      {draggedCube.shape === 'lamp' && (
        <group>
          <mesh position={[0, -0.2, 0]}>
            <cylinderGeometry args={[0.1, 0.1, 0.6, 8]} />
            <meshStandardMaterial color="#4b5563" transparent opacity={0.6} />
          </mesh>
          <mesh position={[0, 0.2, 0]}>
            <sphereGeometry args={[0.25, 16, 16]} />
            <meshStandardMaterial color="#fef08a" transparent opacity={0.6} />
          </mesh>
        </group>
      )}
      {draggedCube.shape === 'fence' && (
        <group>
          <mesh position={[-0.4, 0, 0]}>
            <boxGeometry args={[0.1, 1, 0.1]} />
            <meshStandardMaterial map={getTexture('wood')} transparent opacity={0.6} />
          </mesh>
          <mesh position={[0.4, 0, 0]}>
            <boxGeometry args={[0.1, 1, 0.1]} />
            <meshStandardMaterial map={getTexture('wood')} transparent opacity={0.6} />
          </mesh>
          <mesh position={[0, 0.2, 0]}>
            <boxGeometry args={[1, 0.1, 0.05]} />
            <meshStandardMaterial map={getTexture('wood')} transparent opacity={0.6} />
          </mesh>
          <mesh position={[0, -0.2, 0]}>
            <boxGeometry args={[1, 0.1, 0.05]} />
            <meshStandardMaterial map={getTexture('wood')} transparent opacity={0.6} />
          </mesh>
        </group>
      )}
    </group>
  );
};
