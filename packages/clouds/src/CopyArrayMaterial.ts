import { CopyMaterial } from 'postprocessing'

export class CopyArrayMaterial extends CopyMaterial {
  constructor() {
    super()
    this.fragmentShader = /* glsl */ `
      #include <common>

      #ifdef FRAMEBUFFER_PRECISION_HIGH
        uniform mediump sampler2DArray inputBuffer;
      #else
        uniform lowp sampler2DArray inputBuffer;
      #endif

      uniform float opacity;

      in vec2 vUv;

      #define outputColor0 pc_fragColor
      #if LAYER_COUNT > 1
      layout(location = 1) out vec4 outputColor1;
      #endif // LAYER_COUNT > 1
      #if LAYER_COUNT > 2
      layout(location = 2) out vec4 outputColor2;
      #endif // LAYER_COUNT > 2
      #if LAYER_COUNT > 3
      layout(location = 3) out vec4 outputColor3;
      #endif // LAYER_COUNT > 3

      vec4 mainLayer(float layer) {
        vec4 texel = texture(inputBuffer, vec3(vUv, layer));
        return opacity * texel;
      }

      void main() {
        outputColor0 = mainLayer(0.0);
        #if LAYER_COUNT > 1
        outputColor1 = mainLayer(1.0);
        #endif // LAYER_COUNT > 1
        #if LAYER_COUNT > 2
        outputColor2 = mainLayer(2.0);
        #endif // LAYER_COUNT > 2
        #if LAYER_COUNT > 3
        outputColor3 = mainLayer(3.0);
        #endif // LAYER_COUNT > 3
      }
    `
  }
}
