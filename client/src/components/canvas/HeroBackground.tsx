import React, { useEffect, useState } from 'react';
import { ShaderBackground } from '../ui/background';
import { prefersReducedMotion } from '../../lib/animations/gsap';

function isWebGLAvailable(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return Boolean(canvas.getContext('webgl'));
  } catch {
    return false;
  }
}

interface HeroBackgroundProps {
  className?: string;
  /** Pin to the viewport behind the whole app instead of filling a section */
  fixed?: boolean;
}

/**
 * Indigo atmosphere: a static CSS gradient that is always rendered, with the
 * 21st.dev WebGL silk shader layered on top when WebGL is available and the
 * user has not asked for reduced motion.
 */
export const HeroBackground: React.FC<HeroBackgroundProps> = ({ className = '', fixed = false }) => {
  const [useShader, setUseShader] = useState(false);

  useEffect(() => {
    setUseShader(!prefersReducedMotion() && isWebGLAvailable());
  }, []);

  return (
    <div
      className={`${fixed ? 'fixed' : 'absolute'} pointer-events-none inset-0 overflow-hidden bg-indigo-950 ${className}`}
      aria-hidden="true"
    >
      <div className="absolute -top-1/3 -left-[10%] h-[120%] w-[70%] rounded-full bg-gradient-to-br from-indigo-600/60 via-indigo-700/30 to-transparent blur-3xl" />
      <div className="absolute -bottom-1/3 right-[-10%] h-[110%] w-[60%] rounded-full bg-gradient-to-tl from-violet-600/40 via-indigo-500/25 to-transparent blur-3xl" />
      {useShader && <ShaderBackground className="absolute inset-0 h-full w-full" />}
      {/* Legibility scrim: keeps headline contrast without hiding the shader */}
      {fixed && <div className="absolute inset-0 bg-indigo-950/50" />}
      <div className="absolute inset-0 bg-gradient-to-r from-indigo-950/70 via-indigo-950/30 to-indigo-950/10" />
    </div>
  );
};
