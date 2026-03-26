import * as THREE from 'three';

function createTexture(type: string) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  if (type === 'grass') {
    ctx.fillStyle = '#2d5a27';
    ctx.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 50000; i++) {
      ctx.fillStyle = Math.random() > 0.5 ? '#3a7333' : '#1f401b';
      ctx.fillRect(Math.random() * 512, Math.random() * 512, 2, 8);
    }
  } else if (type === 'dirt') {
    ctx.fillStyle = '#3b2818';
    ctx.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 40000; i++) {
      ctx.fillStyle = Math.random() > 0.5 ? '#4a331f' : '#2c1e12';
      ctx.beginPath();
      ctx.arc(Math.random() * 512, Math.random() * 512, Math.random() * 3, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (type === 'wood') {
    ctx.fillStyle = '#8b5a2b';
    ctx.fillRect(0, 0, 512, 512);
    // Wood grain
    ctx.fillStyle = '#6b4226';
    for (let i = 0; i < 512; i += 4) {
      ctx.globalAlpha = Math.random() * 0.5;
      ctx.fillRect(0, i, 512, 2 + Math.random() * 3);
    }
    ctx.globalAlpha = 1;
    // Planks
    ctx.strokeStyle = '#3a2318';
    ctx.lineWidth = 4;
    for (let i = 0; i <= 512; i += 128) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, 512);
      ctx.stroke();
    }
  } else if (type === 'log') {
    ctx.fillStyle = '#3d2817';
    ctx.fillRect(0, 0, 512, 512);
    ctx.fillStyle = '#2b1c10';
    for (let i = 0; i < 512; i += 8) {
      ctx.globalAlpha = Math.random() * 0.8;
      ctx.fillRect(i, 0, 3 + Math.random() * 4, 512);
    }
    ctx.globalAlpha = 1;
  } else if (type === 'stone') {
    ctx.fillStyle = '#696969';
    ctx.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 30000; i++) {
      ctx.fillStyle = Math.random() > 0.5 ? '#787878' : '#555555';
      ctx.fillRect(Math.random() * 512, Math.random() * 512, 4, 4);
    }
    // Cracks
    ctx.strokeStyle = '#404040';
    ctx.lineWidth = 2;
    for (let i = 0; i < 20; i++) {
      ctx.beginPath();
      ctx.moveTo(Math.random() * 512, Math.random() * 512);
      ctx.lineTo(Math.random() * 512, Math.random() * 512);
      ctx.stroke();
    }
  } else if (type === 'glass') {
    ctx.fillStyle = '#e0f7fa';
    ctx.fillRect(0, 0, 512, 512);
    ctx.fillStyle = '#ffffff';
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(256, 0);
    ctx.lineTo(0, 256);
    ctx.fill();
    ctx.globalAlpha = 1;
  } else if (type === 'water') {
    ctx.fillStyle = '#0077be';
    ctx.fillRect(0, 0, 512, 512);
    // Waves
    ctx.strokeStyle = '#add8e6';
    ctx.lineWidth = 10;
    for (let i = 0; i < 20; i++) {
      ctx.beginPath();
      const y = Math.random() * 512;
      ctx.moveTo(0, y);
      for (let x = 0; x < 512; x += 50) {
        ctx.lineTo(x, y + Math.sin(x * 0.05) * 20);
      }
      ctx.stroke();
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

const cache: Record<string, THREE.CanvasTexture> = {};

export const getTexture = (type: string) => {
  if (!cache[type]) {
    cache[type] = createTexture(type);
  }
  return cache[type];
};
