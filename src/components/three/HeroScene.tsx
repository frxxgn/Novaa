// Escena 3D del hero (React Three Fiber). Se carga bajo demanda.
// Esfera «Nova» con deformación orgánica por ruido, borde de luz violeta,
// anillos orbitales y partículas que reaccionan al cursor.
import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";

const noise = /* glsl */ `
vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1.0/6.0,1.0/3.0);const vec4 D=vec4(0.0,0.5,1.0,2.0);
  vec3 i=floor(v+dot(v,C.yyy));vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz);vec3 l=1.0-g;vec3 i1=min(g.xyz,l.zxy);vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx;vec3 x2=x0-i2+C.yyy;vec3 x3=x0-D.yyy;
  i=mod289(i);
  vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
  float n_=0.142857142857;vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.0*floor(p*ns.z*ns.z);vec4 x_=floor(j*ns.z);vec4 y_=floor(j-7.0*x_);
  vec4 x=x_*ns.x+ns.yyyy;vec4 y=y_*ns.x+ns.yyyy;vec4 h=1.0-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy);vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.0+1.0;vec4 s1=floor(b1)*2.0+1.0;vec4 sh=-step(h,vec4(0.0));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x);vec3 p1=vec3(a0.zw,h.y);vec3 p2=vec3(a1.xy,h.z);vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
  vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0);m=m*m;
  return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}`;

const vertex = /* glsl */ `
uniform float uTime; uniform float uAmp; uniform vec2 uMouse;
varying vec3 vNormal; varying vec3 vView; varying float vNoise;
${noise}
void main(){
  vec3 p = position;
  float n = snoise(p * 1.35 + vec3(uTime * 0.18, uTime * 0.12, uTime * 0.1));
  float n2 = snoise(p * 3.2 - vec3(uTime * 0.25));
  float d = (n * 0.75 + n2 * 0.25) * uAmp + dot(normalize(p.xy), uMouse) * 0.06 * uAmp;
  p += normal * d;
  vNoise = n;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vView = normalize(-mv.xyz);
  vNormal = normalize(normalMatrix * normal);
  gl_Position = projectionMatrix * mv;
}`;

const fragment = /* glsl */ `
uniform vec3 uCore; uniform vec3 uMid; uniform vec3 uRim; uniform vec3 uHot; uniform float uTime;
varying vec3 vNormal; varying vec3 vView; varying float vNoise;
void main(){
  float fres = pow(1.0 - max(dot(normalize(vNormal), normalize(vView)), 0.0), 2.2);
  float band = smoothstep(-0.6, 0.9, vNoise);
  vec3 col = mix(uCore, uMid, band);
  col = mix(col, uRim, fres * 0.95);
  col += uHot * pow(fres, 4.0) * 0.9;
  float spec = pow(max(dot(reflect(-normalize(vView), normalize(vNormal)), normalize(vec3(-0.4, 0.8, 0.6))), 0.0), 24.0);
  col += vec3(1.0) * spec * 0.35;
  gl_FragColor = vec4(col, 1.0);
}`;

function Orb({ colors, intensity }: { colors: { core: string; mid: string; rim: string; hot: string }; intensity: number }) {
  const mesh = useRef<THREE.Mesh>(null);
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uAmp: { value: 0.22 * intensity },
      uMouse: { value: new THREE.Vector2(0, 0) },
      uCore: { value: new THREE.Color(colors.core) },
      uMid: { value: new THREE.Color(colors.mid) },
      uRim: { value: new THREE.Color(colors.rim) },
      uHot: { value: new THREE.Color(colors.hot) },
    }),
    [colors, intensity],
  );
  useFrame((state, delta) => {
    uniforms.uTime.value += delta;
    uniforms.uMouse.value.lerp(new THREE.Vector2(state.pointer.x, state.pointer.y), 0.05);
    if (mesh.current) {
      mesh.current.rotation.y += delta * 0.08;
      mesh.current.rotation.x = THREE.MathUtils.lerp(mesh.current.rotation.x, state.pointer.y * 0.25, 0.04);
      mesh.current.rotation.z = THREE.MathUtils.lerp(mesh.current.rotation.z, -state.pointer.x * 0.2, 0.04);
    }
  });
  return (
    <mesh ref={mesh}>
      <icosahedronGeometry args={[1.25, 64]} />
      <shaderMaterial vertexShader={vertex} fragmentShader={fragment} uniforms={uniforms} />
    </mesh>
  );
}

function Rings({ color }: { color: string }) {
  const group = useRef<THREE.Group>(null);
  useFrame((state, delta) => {
    if (!group.current) return;
    group.current.rotation.z += delta * 0.05;
    group.current.rotation.x = THREE.MathUtils.lerp(group.current.rotation.x, 1.15 + state.pointer.y * 0.15, 0.03);
    group.current.rotation.y = THREE.MathUtils.lerp(group.current.rotation.y, state.pointer.x * 0.2, 0.03);
  });
  return (
    <group ref={group} rotation={[1.15, 0, 0]}>
      {[1.75, 2.05, 2.5].map((r, i) => (
        <mesh key={r} rotation={[0, 0, i * 0.6]}>
          <torusGeometry args={[r, 0.0045 + i * 0.001, 8, 220]} />
          <meshBasicMaterial color={color} transparent opacity={0.55 - i * 0.14} />
        </mesh>
      ))}
    </group>
  );
}

function Particles({ count, color }: { count: number; color: string }) {
  const points = useRef<THREE.Points>(null);
  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const r = 2.2 + Math.random() * 3.2;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      arr[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      arr[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta) * 0.7;
      arr[i * 3 + 2] = r * Math.cos(phi) * 0.6;
    }
    return arr;
  }, [count]);
  useFrame((state, delta) => {
    if (!points.current) return;
    points.current.rotation.y += delta * 0.025;
    points.current.position.x = THREE.MathUtils.lerp(points.current.position.x, state.pointer.x * 0.25, 0.03);
    points.current.position.y = THREE.MathUtils.lerp(points.current.position.y, state.pointer.y * 0.18, 0.03);
  });
  return (
    <points ref={points}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.018} color={color} transparent opacity={0.75} sizeAttenuation depthWrite={false} />
    </points>
  );
}

export default function HeroScene({ colors, intensity = 1, particles = true, compact = false }: { colors: { core: string; mid: string; rim: string; hot: string; ring: string }; intensity?: number; particles?: boolean; compact?: boolean }) {
  return (
    <Canvas
      dpr={[1, compact ? 1.25 : 1.75]}
      camera={{ position: [0, 0, 5.2], fov: 42 }}
      gl={{ antialias: !compact, alpha: true, powerPreference: "high-performance" }}
      style={{ background: "transparent" }}
      aria-hidden
    >
      <Orb colors={colors} intensity={intensity} />
      <Rings color={colors.ring} />
      {particles && <Particles count={compact ? 260 : 700} color={colors.ring} />}
    </Canvas>
  );
}
