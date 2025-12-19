import React, { useEffect, useRef } from 'react';

interface VisualizerProps {
  isActive: boolean;
  volume: number; // 0 to 1
}

export const Visualizer: React.FC<VisualizerProps> = ({ isActive, volume }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);
  
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    const resize = () => {
      canvas.width = canvas.parentElement?.clientWidth || 300;
      canvas.height = canvas.parentElement?.clientHeight || 100;
    };
    resize();
    window.addEventListener('resize', resize);

    const bars = 40; // Increased resolution
    const barWidth = canvas.width / bars;
    
    // Smooth out volume
    let currentVol = 0;

    const render = () => {
      // Linear interpolation for smoothness
      currentVol = currentVol + (volume - currentVol) * 0.2; 
      
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;

      const time = Date.now();

      // Base circle
      if (isActive) {
        // Dynamic active state
        // Circle breathes with volume
        const radius = 30 + (currentVol * 60);
        
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        // Color intensity reacts to volume
        const opacity = 0.1 + currentVol * 0.5;
        ctx.fillStyle = `rgba(56, 189, 248, ${opacity})`; // Sky blue
        ctx.fill();
        
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(56, 189, 248, ${0.4 + currentVol * 0.6})`;
        ctx.lineWidth = 2 + currentVol * 4;
        ctx.stroke();

        // Waveform bars
        const maxBarHeight = canvas.height * 0.5;
        
        for (let i = 0; i < bars; i++) {
            // Distance from center (0 to 1)
            const distFromCenter = Math.abs(i - bars / 2) / (bars / 2);
            
            // Complex wave interference for dynamic look
            const wave1 = Math.sin((time / 150) + i * 0.4);
            const wave2 = Math.cos((time / 100) - i * 0.2);
            const wave3 = Math.sin((time / 300) + i * 0.1);
            const waveFactor = (wave1 + wave2 + wave3) / 3;
            
            // Height logic
            const idleHeight = 4 * (1 - distFromCenter); // minimal baseline
            const activeHeight = currentVol * maxBarHeight * (1 - distFromCenter * 0.2); // larger active area
            
            // Bar color shifts slightly based on height/volume
            const r = 56 + (currentVol * 100); // Shift towards purple/white at high volume
            const g = 189 + (currentVol * 50);
            const b = 248;
            ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;

            // Calculate final height
            let h = idleHeight + activeHeight + (waveFactor * 10 * currentVol);
            h = Math.max(2, h); // Min height

            const x = i * barWidth;
            const y = (canvas.height - h) / 2;
            
            // Rounded bars
            ctx.beginPath();
            ctx.roundRect(x + 1, y, barWidth - 2, h, 4);
            ctx.fill();
        }
      } else {
        // Subdued Idle state
        // Slow breathing pulse
        const pulse = Math.sin(time / 2000) * 3; // Slow, small amplitude
        ctx.beginPath();
        ctx.arc(centerX, centerY, 10 + pulse, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(100, 116, 139, 0.5)'; // Slate 500, transparent
        ctx.fill();
        
        ctx.beginPath();
        ctx.arc(centerX, centerY, 10 + pulse, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(100, 116, 139, 0.8)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      animationRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', resize);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [isActive, volume]);

  return (
    <div className="w-full h-32 flex items-center justify-center">
      <canvas ref={canvasRef} className="w-full h-full" />
    </div>
  );
};