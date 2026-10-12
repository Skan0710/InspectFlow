import React, { useState, useEffect, Component, type ReactNode } from 'react';
import { ShaderGradient, ShaderGradientCanvas } from 'shadergradient';
import { prefersReducedMotion } from '../../lib/animations/gsap';

interface ErrorBoundaryProps {
  fallback: ReactNode;
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

class WebGLErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.warn('[ShaderGradient] WebGL render fallback triggered:', error.message);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

/**
 * Detect WebGL support in browser safely.
 */
function isWebGLAvailable(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    return Boolean(
      window.WebGLRenderingContext &&
        (canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))
    );
  } catch {
    return false;
  }
}

interface ShaderGradientBackgroundProps {
  className?: string;
  type?: 'waterPlane' | 'sphere' | 'plane';
  speed?: number;
  interactive?: boolean;
}

export const ShaderGradientBackground: React.FC<ShaderGradientBackgroundProps> = ({
  className = '',
  type = 'waterPlane',
  speed = 0.28,
}) => {
  const [canRenderWebGL, setCanRenderWebGL] = useState<boolean>(false);
  const [reducedMotion, setReducedMotion] = useState<boolean>(false);

  useEffect(() => {
    const hasReducedMotion = prefersReducedMotion();
    const hasWebGL = isWebGLAvailable();
    setReducedMotion(hasReducedMotion);
    setCanRenderWebGL(hasWebGL && !hasReducedMotion);
  }, []);

  // Premium CSS gradient atmosphere fallback for unsupported WebGL / reduced motion / mobile low power
  const cssFallback = (
    <div
      className="absolute inset-0 overflow-hidden pointer-events-none select-none transition-opacity duration-1000"
      aria-hidden="true"
    >
      <div className="absolute -top-[30%] -left-[10%] w-[65vw] h-[65vw] max-w-[700px] max-h-[700px] rounded-full bg-gradient-to-br from-indigo-600/25 via-violet-600/15 to-transparent blur-[110px]" />
      <div className="absolute -top-[20%] right-[0%] w-[55vw] h-[55vw] max-w-[620px] max-h-[620px] rounded-full bg-gradient-to-bl from-blue-600/20 via-indigo-500/15 to-transparent blur-[120px]" />
      <div className="absolute top-[35%] left-[25%] w-[45vw] h-[45vw] max-w-[500px] max-h-[500px] rounded-full bg-gradient-to-tr from-purple-700/15 via-blue-500/10 to-transparent blur-[130px]" />
      <div className="absolute inset-0 bg-radial-gradient from-transparent via-slate-950/60 to-slate-950" />
    </div>
  );

  if (reducedMotion || !canRenderWebGL) {
    return (
      <div className={`relative ${className}`}>
        {cssFallback}
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {/* 3D WebGL ShaderGradient Canvas */}
      <WebGLErrorBoundary fallback={cssFallback}>
        <div className="absolute inset-0 pointer-events-none select-none opacity-85 transition-opacity duration-700">
          <ShaderGradientCanvas
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              pointerEvents: 'none',
            }}
            pixelDensity={typeof window !== 'undefined' && window.devicePixelRatio > 1.5 ? 1.25 : 1}
            fov={45}
          >
            <ShaderGradient
              control="props"
              animate="on"
              type={type}
              uSpeed={speed}
              uStrength={1.8}
              uDensity={1.15}
              uFrequency={5.5}
              uAmplitude={3.2}
              positionX={0}
              positionY={0}
              positionZ={0}
              rotationX={35}
              rotationY={0}
              rotationZ={50}
              color1="#4f46e5" // Deep Indigo
              color2="#7c3aed" // Vibrant Violet
              color3="#2563eb" // Precision Blue
              brightness={1.05}
              cAzimuthAngle={180}
              cPolarAngle={80}
              cDistance={3.5}
              cameraZoom={1}
              lightType="3d"
              grain="off"
            />
          </ShaderGradientCanvas>
        </div>
      </WebGLErrorBoundary>

      {/* Atmospheric dark contrast vignette to preserve 100% typography and data legibility */}
      <div
        className="absolute inset-0 pointer-events-none bg-gradient-to-b from-slate-950/50 via-slate-950/80 to-slate-950"
        aria-hidden="true"
      />
    </div>
  );
};
