import { useThree, useFrame } from '@react-three/fiber';
import { PointerLockControls } from '@react-three/drei';
import { useEffect, useRef, useMemo, useState } from 'react';
import { Vector3, Euler, Quaternion } from 'three';
import * as THREE from 'three';
import { useKeyboard } from '../hooks/useKeyboard';
import { useSphere } from '@react-three/cannon';
import { useStore } from '../hooks/useStore';
import { Avatar } from './Avatar';

const JUMP_FORCE = 6;
const SPEED = 8;
const LERP_FACTOR = 0.15; // For smooth camera/avatar movement

export const Player = ({ isHelpOpen, isLocked, onLock, onUnlock }: { isHelpOpen: boolean, isLocked: boolean, onLock?: () => void, onUnlock?: () => void }) => {
  const { camera } = useThree();
  const { moveForward, moveBackward, moveLeft, moveRight, jump, sprint } = useKeyboard();
  const cubes = useStore((state) => state.cubes);
  const setInWater = useStore((state) => state.setInWater);
  const cameraMode = useStore((state) => state.cameraMode);
  const setCameraMode = useStore((state) => state.setCameraMode);
  const cameraDistance = useStore((state) => state.cameraDistance);
  const setCameraDistance = useStore((state) => state.setCameraDistance);
  const playerAvatar = useStore((state) => state.playerAvatar);

  // Physics sphere for the player
  const [ref, api] = useSphere(() => ({
    mass: 1,
    type: 'Dynamic',
    position: [0, 1, 10],
    args: [0.5], // radius
    fixedRotation: true, // Don't roll like a ball
  }));

  const velocity = useRef([0, 0, 0]);
  useEffect(() => api.velocity.subscribe((v) => (velocity.current = v)), [api.velocity]);

  const pos = useRef([0, 0, 0]);
  useEffect(() => api.position.subscribe((p) => (pos.current = p)), [api.position]);

  // Handle teleport event
  useEffect(() => {
    const handleTeleport = (e: any) => {
      const [tx, ty, tz] = e.detail;
      api.position.set(tx, ty + 2, tz); // Teleport slightly above the target
      api.velocity.set(0, 0, 0); // Stop movement
    };
    window.addEventListener('teleport-player', handleTeleport);
    return () => window.removeEventListener('teleport-player', handleTeleport);
  }, [api.position, api.velocity]);

  // Handle camera mode toggle with 'V' key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'v') {
        if (cameraMode === 'first') {
          setCameraMode('third');
          setCameraDistance(5);
        } else {
          setCameraMode('first');
          setCameraDistance(0);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cameraMode, setCameraMode, setCameraDistance]);

  // Handle scroll to zoom
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      if (isHelpOpen) return;
      
      const delta = e.deltaY > 0 ? 0.5 : -0.5;
      const newDistance = Math.max(0, Math.min(10, cameraDistance + delta));
      
      setCameraDistance(newDistance);
      
      if (newDistance === 0) {
        setCameraMode('first');
      } else if (cameraMode === 'first' && newDistance > 0) {
        setCameraMode('third');
      }
    };

    window.addEventListener('wheel', handleWheel, { passive: true });
    return () => window.removeEventListener('wheel', handleWheel);
  }, [cameraDistance, setCameraDistance, setCameraMode, cameraMode, isHelpOpen]);

  // Check if player is in water
  const isInWater = useMemo(() => {
    const px = Math.round(pos.current[0]);
    const py = Math.round(pos.current[1]);
    const pz = Math.round(pos.current[2]);
    return cubes.some(c => c.texture === 'water' && 
      Math.abs(c.pos[0] - px) < 1 && 
      Math.abs(c.pos[1] - py) < 1 && 
      Math.abs(c.pos[2] - pz) < 1
    );
  }, [pos.current, cubes]);

  useEffect(() => {
    setInWater(isInWater);
  }, [isInWater, setInWater]);

  const avatarRef = useRef<THREE.Group>(null);
  const smoothedCameraPos = useRef(new Vector3());
  const smoothedAvatarRotation = useRef(0);

  useFrame((state, delta) => {
    const { camera, clock } = state;
    
    // Smoothly interpolate position for camera to reduce jitter
    const targetPos = new Vector3(pos.current[0], pos.current[1], pos.current[2]);
    smoothedCameraPos.current.lerp(targetPos, LERP_FACTOR);

    // Sync camera to physics body
    if (cameraMode === 'first') {
      // Add a slight bobbing effect when walking
      let bobbing = 0;
      if (Math.abs(velocity.current[0]) > 0.1 || Math.abs(velocity.current[2]) > 0.1) {
        const speedFactor = sprint ? 1.5 : 1;
        bobbing = Math.sin(clock.elapsedTime * 10 * speedFactor) * 0.05;
      }
      
      camera.position.copy(smoothedCameraPos.current.clone().add(new Vector3(0, 0.8 + bobbing, 0)));
    } else {
      // Third person camera logic
      const idealOffset = new Vector3(0, 2, cameraDistance);
      idealOffset.applyQuaternion(camera.quaternion);
      
      const cameraTargetPos = smoothedCameraPos.current.clone().add(idealOffset);
      camera.position.lerp(cameraTargetPos, LERP_FACTOR);
      
      // Update avatar position and rotation
      if (avatarRef.current) {
        avatarRef.current.position.copy(smoothedCameraPos.current.clone().add(new Vector3(0, -0.5, 0)));
        
        // Only rotate avatar if moving
        const moveDir = new Vector3(velocity.current[0], 0, velocity.current[2]);
        if (moveDir.lengthSq() > 0.1) {
          const targetRotation = Math.atan2(velocity.current[0], velocity.current[2]);
          
          // Smoothly rotate avatar
          let diff = targetRotation - smoothedAvatarRotation.current;
          while (diff < -Math.PI) diff += Math.PI * 2;
          while (diff > Math.PI) diff -= Math.PI * 2;
          
          smoothedAvatarRotation.current += diff * LERP_FACTOR;
          avatarRef.current.rotation.y = smoothedAvatarRotation.current;
        }
      }
    }

    let speed = sprint ? SPEED * 2.5 : SPEED;
    if (isInWater) speed *= 0.5; // Slower in water

    const direction = new Vector3();
    const frontVector = new Vector3(0, 0, Number(moveBackward) - Number(moveForward));
    const sideVector = new Vector3(Number(moveLeft) - Number(moveRight), 0, 0);

    direction
      .subVectors(frontVector, sideVector)
      .normalize()
      .multiplyScalar(speed)
      .applyEuler(new Euler(0, camera.rotation.y, 0)); // Only use Y rotation for movement

    // Update velocity on X and Z axes
    // Use a small amount of interpolation for velocity too to prevent instant snapping
    const targetVelX = direction.x;
    const targetVelZ = direction.z;
    
    // Apply movement with a bit of smoothing to the horizontal velocity
    const lerpVelX = THREE.MathUtils.lerp(velocity.current[0], targetVelX, 0.2);
    const lerpVelZ = THREE.MathUtils.lerp(velocity.current[2], targetVelZ, 0.2);
    
    api.velocity.set(lerpVelX, velocity.current[1], lerpVelZ);

    // Buoyancy in water
    if (isInWater) {
      api.applyForce([0, 12, 0], [0, 0, 0]); // Counteract gravity slightly
      if (jump) {
        api.velocity.set(velocity.current[0], 3, velocity.current[2]); // Swim up
      }
    } else {
      // Jump logic
      // Check if we are on the ground (velocity.y is near 0)
      // We also check if the jump key was just pressed to avoid "flying"
      if (jump && Math.abs(velocity.current[1]) < 0.01) {
        api.velocity.set(velocity.current[0], JUMP_FORCE, velocity.current[2]);
      }
    }
  });

  return (
    <>
      {!isHelpOpen && (
        <PointerLockControls 
          key={`pointer-lock-${isHelpOpen}-${isLocked}`} 
          selector="#game-container" 
          makeDefault 
          onLock={onLock} 
          onUnlock={onUnlock} 
        />
      )}
      {cameraMode === 'third' && (
        <group ref={avatarRef}>
          <Avatar 
            color={playerAvatar.color} 
            clothingColor={playerAvatar.clothingColor} 
            hairColor={playerAvatar.hairColor} 
            style={playerAvatar.style} 
            isPlayer={true}
          />
        </group>
      )}
    </>
  );
};
