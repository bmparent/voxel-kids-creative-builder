import { useState, useEffect } from 'react';

function actionByKey(key: string) {
  const keyActionMap: Record<string, string> = {
    KeyW: 'moveForward',
    KeyS: 'moveBackward',
    KeyA: 'moveLeft',
    KeyD: 'moveRight',
    Space: 'jump',
    Digit1: 'dirt',
    Digit2: 'grass',
    Digit3: 'glass',
    Digit4: 'wood',
    Digit5: 'log',
    Digit6: 'stone',
    Digit7: 'water',
    ShiftLeft: 'sprint',
    ShiftRight: 'sprint',
  };
  return keyActionMap[key];
}

export const useKeyboard = () => {
  const [actions, setActions] = useState({
    moveForward: false,
    moveBackward: false,
    moveLeft: false,
    moveRight: false,
    jump: false,
    dirt: false,
    grass: false,
    glass: false,
    wood: false,
    log: false,
    stone: false,
    water: false,
    sprint: false,
  });

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const action = actionByKey(event.code);
      if (action) {
        setActions((prev) => ({
          ...prev,
          [action]: true,
        }));
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      const action = actionByKey(event.code);
      if (action) {
        setActions((prev) => ({
          ...prev,
          [action]: false,
        }));
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  return actions;
};
