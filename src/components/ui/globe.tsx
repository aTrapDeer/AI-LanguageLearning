"use client";

import React, { useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';

// Dynamically import react-globe.gl with no SSR
const Globe = dynamic(() => import('react-globe.gl').then(mod => mod.default), {
  ssr: false,
  loading: () => null
});

export default function AnimatedGlobe() {
  const globeRef = useRef<any>(undefined);

  useEffect(() => {
    if (globeRef.current) {
      const controls = globeRef.current.controls();
      controls.autoRotate = true;
      controls.autoRotateSpeed = 1;
      controls.enableZoom = false;
      controls.enablePan = false;
      controls.enableDamping = true;
      controls.dampingFactor = 0.1;
      
      const animate = () => {
        if (controls) {
          controls.update();
          requestAnimationFrame(animate);
        }
      };
      animate();
    }
  }, []);

  return (
    <div className="absolute inset-0 opacity-20 pointer-events-none flex items-center justify-center">
      <Globe
        ref={globeRef}
        globeImageUrl="//unpkg.com/three-globe/example/img/earth-blue-marble.jpg"
        backgroundColor="rgba(0,0,0,0)"
        width={800}
        height={800}
        showAtmosphere={true}
        atmosphereColor="#4f46e5"
        atmosphereAltitude={0.1}
        onGlobeReady={() => {
          if (globeRef.current) {
            const controls = globeRef.current.controls();
            controls.autoRotate = true;
            controls.autoRotateSpeed = 1;
          }
        }}
      />
    </div>
  );
} 