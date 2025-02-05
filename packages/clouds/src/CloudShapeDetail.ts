import { resolveIncludes } from '@takram/three-geospatial'
import { math } from '@takram/three-geospatial/shaders'

import { CLOUD_SHAPE_DETAIL_TEXTURE_SIZE } from './constants'
import { Procedural3DTexture } from './Procedural3DTexture'

import fragmentShader from './shaders/cloudShapeDetail.frag?raw'
import perlin from './shaders/perlin.glsl?raw'
import tileableNoise from './shaders/tileableNoise.glsl?raw'

export class CloudShapeDetail extends Procedural3DTexture {
  constructor() {
    super({
      size: CLOUD_SHAPE_DETAIL_TEXTURE_SIZE,
      fragmentShader: resolveIncludes(fragmentShader, {
        core: { math },
        perlin,
        tileableNoise
      })
    })
  }
}
