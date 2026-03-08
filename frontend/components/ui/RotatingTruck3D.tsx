"use client";

import { useEffect, useRef } from "react";
import { Truck } from "lucide-react";

export default function RotatingTruck3D() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let animationFrame: number;
    let rotationY = 0;
    let rotationX = -15;

    const animate = () => {
      rotationY += 0.5; // Slow rotation speed
      if (rotationY >= 360) rotationY = 0;

      container.style.transform = `perspective(1000px) rotateY(${rotationY}deg) rotateX(${rotationX}deg)`;
      animationFrame = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
      }
    };
  }, []);

  return (
    <div className="rotating-truck-container">
      <div ref={containerRef} className="rotating-truck-3d">
        {/* Truck Body */}
        <div className="truck-body">
          {/* Cab */}
          <div className="truck-cab">
            <div className="truck-windshield"></div>
            <div className="truck-door"></div>
          </div>
          
          {/* Container/Trailer */}
          <div className="truck-trailer">
            <div className="truck-logo">
              <Truck size={24} />
            </div>
            <div className="truck-lines">
              <div className="truck-line"></div>
              <div className="truck-line"></div>
            </div>
          </div>
        </div>

        {/* Wheels */}
        <div className="truck-wheels">
          <div className="truck-wheel wheel-front-left"></div>
          <div className="truck-wheel wheel-front-right"></div>
          <div className="truck-wheel wheel-rear-left"></div>
          <div className="truck-wheel wheel-rear-right"></div>
        </div>

        {/* Shadow */}
        <div className="truck-shadow"></div>
      </div>
    </div>
  );
}
