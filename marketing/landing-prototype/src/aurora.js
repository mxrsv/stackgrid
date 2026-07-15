// Hero background — the "aurora" treatment: a WebGL aurora curtain drifting
// behind the stage. Ported from the React Bits <Aurora /> component (ogl) into
// a vanilla mount function so it matches the prototype's plain-DOM lifecycle.
// It replaces the ghost-token "stream" field; that trial history lives in
// NOTES.md.

import { Color, Mesh, Program, Renderer, Triangle } from "ogl";

const VERT = `#version 300 es
in vec2 position;
void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const FRAG = `#version 300 es
precision highp float;

uniform float uTime;
uniform float uAmplitude;
uniform vec3 uColorStops[3];
uniform vec2 uResolution;
uniform float uBlend;

out vec4 fragColor;

vec3 permute(vec3 x) {
  return mod(((x * 34.0) + 1.0) * x, 289.0);
}

float snoise(vec2 v){
  const vec4 C = vec4(
      0.211324865405187, 0.366025403784439,
      -0.577350269189626, 0.024390243902439
  );
  vec2 i  = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod(i, 289.0);

  vec3 p = permute(
      permute(i.y + vec3(0.0, i1.y, 1.0))
    + i.x + vec3(0.0, i1.x, 1.0)
  );

  vec3 m = max(
      0.5 - vec3(
          dot(x0, x0),
          dot(x12.xy, x12.xy),
          dot(x12.zw, x12.zw)
      ),
      0.0
  );
  m = m * m;
  m = m * m;

  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);

  vec3 g;
  g.x  = a0.x  * x0.x  + h.x  * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

struct ColorStop {
  vec3 color;
  float position;
};

#define COLOR_RAMP(colors, factor, finalColor) {              \
  int index = 0;                                            \
  for (int i = 0; i < 2; i++) {                               \
     ColorStop currentColor = colors[i];                    \
     bool isInBetween = currentColor.position <= factor;    \
     index = int(mix(float(index), float(i), float(isInBetween))); \
  }                                                         \
  ColorStop currentColor = colors[index];                   \
  ColorStop nextColor = colors[index + 1];                  \
  float range = nextColor.position - currentColor.position; \
  float lerpFactor = (factor - currentColor.position) / range; \
  finalColor = mix(currentColor.color, nextColor.color, lerpFactor); \
}

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution;

  ColorStop colors[3];
  colors[0] = ColorStop(uColorStops[0], 0.0);
  colors[1] = ColorStop(uColorStops[1], 0.5);
  colors[2] = ColorStop(uColorStops[2], 1.0);

  vec3 rampColor;
  COLOR_RAMP(colors, uv.x, rampColor);

  float height = snoise(vec2(uv.x * 2.0 + uTime * 0.1, uTime * 0.25)) * 0.5 * uAmplitude;
  height = exp(height);
  height = (uv.y * 2.0 - height + 0.2);
  float intensity = 0.6 * height;

  float midPoint = 0.20;
  float auroraAlpha = smoothstep(midPoint - uBlend * 0.5, midPoint + uBlend * 0.5, intensity);

  vec3 auroraColor = intensity * rampColor;

  fragColor = vec4(auroraColor * auroraAlpha, auroraAlpha);
}
`;

// Violet → lavender → indigo curtain. Override via options if the palette
// shifts. Ordered left→mid→right across the gradient (uv.x = 0, 0.5, 1).
const DEFAULT_COLOR_STOPS = ["#8d27e6", "#9167d6", "#3e15df"];

const toRgb = (hex) => {
    const color = new Color(hex);
    return [color.r, color.g, color.b];
};

export function mountAurora(layer, options = {}) {
    if (!layer) {
        return () => {};
    }

    const settings = {
        colorStops: options.colorStops ?? DEFAULT_COLOR_STOPS,
        amplitude: options.amplitude ?? 1.0,
        blend: options.blend ?? 0.5,
        speed: options.speed ?? 0.4,
    };

    const prefersReducedMotion =
        typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Cap at 2× so the shader stays crisp on Retina without paying for 3× panels.
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const renderer = new Renderer({
    alpha: true,
    premultipliedAlpha: true,
    antialias: true,
    dpr,
  });
    const gl = renderer.gl;
    gl.clearColor(0, 0, 0, 0);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.canvas.style.backgroundColor = "transparent";
    gl.canvas.classList.add("aurora-canvas");

    const geometry = new Triangle(gl);
    if (geometry.attributes.uv) {
        delete geometry.attributes.uv;
    }

    const program = new Program(gl, {
        vertex: VERT,
        fragment: FRAG,
        uniforms: {
            uTime: { value: 0 },
            uAmplitude: { value: settings.amplitude },
            uColorStops: { value: settings.colorStops.map(toRgb) },
            uResolution: { value: [layer.offsetWidth, layer.offsetHeight] },
            uBlend: { value: settings.blend },
        },
    });

    const mesh = new Mesh(gl, { geometry, program });
    layer.appendChild(gl.canvas);

  function resize() {
    const width = layer.offsetWidth;
    const height = layer.offsetHeight;
    // Track dpr too, so dragging the window between Retina/external displays
    // keeps the curtain sharp instead of locking to the launch display.
    renderer.dpr = Math.min(window.devicePixelRatio || 1, 2);
    renderer.setSize(width, height);
    program.uniforms.uResolution.value = [
      gl.canvas.width,
      gl.canvas.height,
    ];
  }

    window.addEventListener("resize", resize);
    resize();

    let animateId = 0;
    const update = (t) => {
        animateId = requestAnimationFrame(update);
        program.uniforms.uTime.value = t * 0.01 * settings.speed * 0.1;
        renderer.render({ scene: mesh });
    };

    if (prefersReducedMotion) {
        // Freeze the curtain in a resolved state instead of animating — mirrors
        // how the other hero motion trials honour reduced-motion.
        program.uniforms.uTime.value = 12.0;
        renderer.render({ scene: mesh });
    } else {
        animateId = requestAnimationFrame(update);
    }

    return () => {
        cancelAnimationFrame(animateId);
        window.removeEventListener("resize", resize);
        if (gl.canvas.parentNode === layer) {
            layer.removeChild(gl.canvas);
        }
        gl.getExtension("WEBGL_lose_context")?.loseContext();
    };
}
