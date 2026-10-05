"use client";

import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { AdditiveBlending, type Points, type ShaderMaterial } from "three";

// A quantum "probability cloud": particles on tilted orbital shells around a dense nucleus.
// On load they condense from noise into orbit. Near the cursor they bend away (the observer effect).

const VERT = /* glsl */ `
uniform float uTime;
uniform float uCollapse;
uniform vec2 uPointer;
uniform float uPull;
uniform float uScale;
attribute float aRadius;
attribute float aAngle;
attribute float aSpeed;
attribute vec2 aTilt;
attribute vec3 aJitter;
attribute vec3 aScatter;
attribute float aSize;
attribute float aNode;
varying float vMix;
varying float vGlow;
varying float vNode;

mat3 rotX(float a){ float c = cos(a), s = sin(a); return mat3(1.,0.,0., 0.,c,s, 0.,-s,c); }
mat3 rotY(float a){ float c = cos(a), s = sin(a); return mat3(c,0.,-s, 0.,1.,0., s,0.,c); }

void main() {
  float a = aAngle + uTime * aSpeed;
  vec3 orbit = vec3(cos(a), sin(a), 0.0) * aRadius + aJitter;
  orbit = rotY(aTilt.y) * rotX(aTilt.x) * orbit;
  float k = uCollapse;
  k = k * k * (3.0 - 2.0 * k);
  vec3 p = mix(aScatter, orbit, k);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);

  vec2 d = mv.xy - uPointer;
  float dist = length(d);
  // Hover: particles lean toward the cursor. Press and drag (uPull -> 1): they gather and swirl with it.
  float f = exp(-dist * dist / 3.0);
  mv.xy -= d * f * (0.18 + 0.72 * uPull);
  mv.xy += vec2(-d.y, d.x) * f * uPull * 0.22;
  vGlow = f;
  vMix = clamp((aRadius - 0.8) / 3.6, 0.0, 1.0);
  vNode = aNode;

  gl_PointSize = aSize * uScale * (1.0 + aNode * 2.5 + vGlow * 0.9) / -mv.z;
  gl_Position = projectionMatrix * mv;
}
`;

const FRAG = /* glsl */ `
varying float vMix;
varying float vGlow;
varying float vNode;
void main() {
  float d = length(gl_PointCoord - 0.5);
  float a = pow(smoothstep(0.5, 0.0, d), 2.0);
  vec3 aqua = vec3(0.37, 0.92, 0.83);
  vec3 photon = vec3(0.56, 0.64, 1.0);
  vec3 plasma = vec3(0.91, 0.47, 0.98);
  vec3 col = vMix < 0.5 ? mix(aqua, photon, vMix * 2.0) : mix(photon, plasma, (vMix - 0.5) * 2.0);
  col = mix(col, vec3(1.0), vNode * 0.6 + vGlow * 0.35);
  gl_FragColor = vec4(col, a * (0.7 + vGlow * 0.4 + vNode * 0.4));
}
`;

const SHELLS = [1.1, 1.7, 2.3, 2.95, 3.6, 4.3];
const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) / 1.5;

function buildCloud(count: number) {
  const radius = new Float32Array(count);
  const angle = new Float32Array(count);
  const speed = new Float32Array(count);
  const tilt = new Float32Array(count * 2);
  const jitter = new Float32Array(count * 3);
  const scatter = new Float32Array(count * 3);
  const size = new Float32Array(count);
  const node = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    const nucleus = Math.random() < 0.12;
    const s = Math.floor(Math.random() * SHELLS.length);
    radius[i] = nucleus ? 0.05 + Math.abs(gauss()) * 0.9 : SHELLS[s] + gauss() * 0.2;
    angle[i] = Math.random() * Math.PI * 2;
    speed[i] = (0.5 / (radius[i] + 0.6)) * (s % 2 ? 1 : -1) * (0.7 + Math.random() * 0.6);
    tilt[i * 2] = nucleus ? Math.random() * Math.PI : 0.35 + s * 0.32 * (s % 2 ? 1 : -1);
    tilt[i * 2 + 1] = nucleus ? Math.random() * Math.PI : s * 1.05;
    for (let k = 0; k < 3; k++) jitter[i * 3 + k] = gauss() * 0.16;
    // Scattered start: random point on a wide sphere shell.
    const u = Math.random() * 2 - 1;
    const t = Math.random() * Math.PI * 2;
    const r = 4 + Math.random() * 6;
    const q = Math.sqrt(1 - u * u);
    scatter.set([r * q * Math.cos(t), r * q * Math.sin(t), r * u], i * 3);
    node[i] = !nucleus && i % 420 === 0 ? 1 : 0;
    size[i] = 0.026 + Math.random() * 0.03;
  }
  return { radius, angle, speed, tilt, jitter, scatter, size, node };
}

function Cloud({ calm, count }: { calm: boolean; count: number }) {
  const points = useRef<Points>(null);
  const mat = useRef<ShaderMaterial>(null);
  const cloud = useMemo(() => buildCloud(count), [count]);
  const uniforms = useMemo(
    () => ({ uTime: { value: 0 }, uCollapse: { value: calm ? 1 : 0 }, uPointer: { value: [9, 9] as [number, number] }, uPull: { value: 0 }, uScale: { value: 800 } }),
    [calm],
  );

  // Window-level listeners so it reacts even when text or buttons sit above the canvas.
  const ptr = useRef({ x: 9, y: 9, down: false });
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    if (calm) return;
    const el = gl.domElement;
    const move = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      ptr.current.x = ((e.clientX - r.left) / r.width) * 2 - 1;
      ptr.current.y = -((e.clientY - r.top) / r.height) * 2 + 1;
    };
    const down = (e: PointerEvent) => {
      move(e);
      ptr.current.down = true;
    };
    const up = () => (ptr.current.down = false);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerdown", down);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerdown", down);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  }, [gl, calm]);

  useFrame((state, dt) => {
    const m = mat.current;
    const p = points.current;
    if (!m || !p) return;
    const { size, viewport, clock } = state;
    const pointer = ptr.current;
    const wide = size.width >= 900;
    p.position.x = wide ? viewport.width * 0.2 : 0;
    p.rotation.x = 0.3;
    m.uniforms.uScale.value = (size.height * viewport.dpr) / 0.932;
    if (calm) return;
    p.rotation.y += dt * 0.04;
    m.uniforms.uTime.value = clock.elapsedTime;
    m.uniforms.uCollapse.value = Math.min(1, clock.elapsedTime / 3.2);
    const target = [pointer.x * (viewport.width / 2), pointer.y * (viewport.height / 2)];
    const u = m.uniforms.uPointer.value as [number, number];
    u[0] += (target[0] - u[0]) * 0.08;
    u[1] += (target[1] - u[1]) * 0.08;
    m.uniforms.uPull.value += ((pointer.down ? 1 : 0) - m.uniforms.uPull.value) * 0.07;
  });

  return (
    <points ref={points} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[new Float32Array(count * 3), 3]} />
        <bufferAttribute attach="attributes-aRadius" args={[cloud.radius, 1]} />
        <bufferAttribute attach="attributes-aAngle" args={[cloud.angle, 1]} />
        <bufferAttribute attach="attributes-aSpeed" args={[cloud.speed, 1]} />
        <bufferAttribute attach="attributes-aTilt" args={[cloud.tilt, 2]} />
        <bufferAttribute attach="attributes-aJitter" args={[cloud.jitter, 3]} />
        <bufferAttribute attach="attributes-aScatter" args={[cloud.scatter, 3]} />
        <bufferAttribute attach="attributes-aSize" args={[cloud.size, 1]} />
        <bufferAttribute attach="attributes-aNode" args={[cloud.node, 1]} />
      </bufferGeometry>
      <shaderMaterial
        ref={mat}
        vertexShader={VERT}
        fragmentShader={FRAG}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={AdditiveBlending}
      />
    </points>
  );
}

function Scene({ calm }: { calm: boolean }) {
  const width = useThree((s) => s.size.width);
  // Fewer points on phones keeps it smooth.
  return <Cloud calm={calm} count={width < 768 ? 3200 : 9000} />;
}

export default function QuantumField({ calm, paused }: { calm: boolean; paused: boolean }) {
  return (
    <Canvas
      camera={{ position: [0, 0, 10.5], fov: 50 }}
      dpr={[1, 1.75]}
      gl={{ antialias: false, alpha: true }}
      frameloop={calm ? "demand" : paused ? "never" : "always"}
      aria-hidden
    >
      <Scene calm={calm} />
    </Canvas>
  );
}
