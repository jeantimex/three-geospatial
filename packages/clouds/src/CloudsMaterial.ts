/* eslint-disable @typescript-eslint/no-unsafe-declaration-merging */

import {
  Color,
  GLSL3,
  Matrix4,
  Uniform,
  Vector2,
  Vector3,
  type BufferGeometry,
  type Camera,
  type Data3DTexture,
  type DataArrayTexture,
  type Group,
  type Object3D,
  type OrthographicCamera,
  type PerspectiveCamera,
  type Scene,
  type Texture,
  type WebGLRenderer
} from 'three'

import {
  AtmosphereMaterialBase,
  atmosphereMaterialParametersBaseDefaults,
  AtmosphereParameters,
  type AtmosphereMaterialBaseParameters,
  type AtmosphereMaterialBaseUniforms
} from '@takram/three-atmosphere'
import {
  parameters as atmosphereParameters,
  functions
} from '@takram/three-atmosphere/shaders'
import {
  assertType,
  Geodetic,
  resolveIncludes,
  unrollLoops
} from '@takram/three-geospatial'
import {
  depth,
  generators,
  math,
  raySphereIntersection
} from '@takram/three-geospatial/shaders'

import { STBN_TEXTURE_DEPTH, STBN_TEXTURE_SIZE } from './constants'
import {
  createCloudLayerUniforms,
  createCloudParameterUniforms,
  type CloudLayerUniforms,
  type CloudParameterUniforms
} from './uniforms'

import fragmentShader from './shaders/clouds.frag?raw'
import clouds from './shaders/clouds.glsl?raw'
import vertexShader from './shaders/clouds.vert?raw'
import parameters from './shaders/parameters.glsl?raw'

declare module 'three' {
  interface Camera {
    isPerspectiveCamera?: boolean
  }
}

const geodeticScratch = /*#__PURE__*/ new Geodetic()

export interface CloudsMaterialParameters
  extends AtmosphereMaterialBaseParameters {
  depthBuffer?: Texture | null
  sunDirectionRef?: Vector3
  shadowCascadeCount?: number
}

export const cloudsMaterialParametersDefaults = {
  ...atmosphereMaterialParametersBaseDefaults,
  shadowCascadeCount: 4
} satisfies CloudsMaterialParameters

interface CloudsMaterialUniforms
  extends CloudLayerUniforms,
    CloudParameterUniforms {
  [key: string]: Uniform<unknown>
  depthBuffer: Uniform<Texture | null>
  viewMatrix: Uniform<Matrix4>
  inverseProjectionMatrix: Uniform<Matrix4>
  inverseViewMatrix: Uniform<Matrix4>
  resolution: Uniform<Vector2>
  cameraNear: Uniform<number>
  cameraFar: Uniform<number>
  cameraHeight: Uniform<number>
  frame: Uniform<number>
  blueNoiseTexture: Uniform<Data3DTexture | null>
  blueNoiseVectorTexture: Uniform<Data3DTexture | null>

  // Atmospheric parameters
  bottomRadius: Uniform<number> // TODO

  // Scattering parameters
  albedo: Uniform<Color>
  scatterAnisotropy1: Uniform<number>
  scatterAnisotropy2: Uniform<number>
  scatterAnisotropyMix: Uniform<number>
  skyIrradianceScale: Uniform<number>
  powderScale: Uniform<number>
  powderExponent: Uniform<number>

  // Raymarch to clouds
  maxIterations: Uniform<number>
  initialStepSize: Uniform<number>
  maxStepSize: Uniform<number>
  maxRayDistance: Uniform<number>
  minDensity: Uniform<number>
  minTransmittance: Uniform<number>

  // Beer shadow map
  shadowBuffer: Uniform<DataArrayTexture | null>
  shadowTexelSize: Uniform<Vector2>
  shadowIntervals: Uniform<Vector2[]>
  shadowMatrices: Uniform<Matrix4[]>
  shadowFar: Uniform<number>
}

export interface CloudsMaterial {
  uniforms: CloudsMaterialUniforms & AtmosphereMaterialBaseUniforms
}

export class CloudsMaterial extends AtmosphereMaterialBase {
  constructor(
    params?: CloudsMaterialParameters,
    atmosphere = AtmosphereParameters.DEFAULT
  ) {
    const {
      depthBuffer = null,
      sunDirectionRef,
      shadowCascadeCount
    } = {
      ...cloudsMaterialParametersDefaults,
      ...params
    }
    super(
      {
        name: 'CloudsMaterial',
        glslVersion: GLSL3,
        vertexShader,
        fragmentShader: resolveIncludes(unrollLoops(fragmentShader), {
          core: {
            depth,
            math,
            generators,
            raySphereIntersection
          },
          atmosphere: {
            parameters: atmosphereParameters,
            functions
          },
          parameters,
          clouds
        }),
        uniforms: {
          depthBuffer: new Uniform(depthBuffer),
          viewMatrix: new Uniform(new Matrix4()),
          inverseProjectionMatrix: new Uniform(new Matrix4()),
          inverseViewMatrix: new Uniform(new Matrix4()),
          resolution: new Uniform(new Vector2()),
          cameraNear: new Uniform(0),
          cameraFar: new Uniform(0),
          cameraHeight: new Uniform(0),
          frame: new Uniform(0),
          blueNoiseTexture: new Uniform(null),
          blueNoiseVectorTexture: new Uniform(null),

          ...createCloudParameterUniforms(),
          ...createCloudLayerUniforms(),

          // Atmospheric parameters
          bottomRadius: new Uniform(atmosphere.bottomRadius), // TODO
          sunDirection: new Uniform(sunDirectionRef ?? new Vector3()), // Overridden

          // Scattering parameters
          albedo: new Uniform(new Color(0.98, 0.98, 0.98)),
          powderScale: new Uniform(0.8),
          powderExponent: new Uniform(200),
          scatterAnisotropy1: new Uniform(0.8),
          scatterAnisotropy2: new Uniform(-0.3),
          scatterAnisotropyMix: new Uniform(0.5),
          skyIrradianceScale: new Uniform(0.3),

          // Raymarch to clouds
          maxIterations: new Uniform(500),
          initialStepSize: new Uniform(50),
          maxStepSize: new Uniform(1000),
          maxRayDistance: new Uniform(1.5e5),
          minDensity: new Uniform(1e-5),
          minTransmittance: new Uniform(1e-2),

          // Beer shadow map
          shadowBuffer: new Uniform(null),
          shadowTexelSize: new Uniform(new Vector2()),
          shadowIntervals: new Uniform(
            // Populate the max number of elements.
            Array.from({ length: 4 }, () => new Vector2())
          ),
          shadowMatrices: new Uniform(
            // Populate the max number of elements.
            Array.from({ length: 4 }, () => new Matrix4())
          ),
          shadowFar: new Uniform(0)
        } satisfies CloudsMaterialUniforms,
        defines: {
          DEPTH_PACKING: '0',
          USE_SHAPE_DETAIL: '1',
          MULTI_SCATTERING_OCTAVES: '8',
          USE_POWDER: '1',
          USE_GROUND_IRRADIANCE: '1',
          STBN_TEXTURE_SIZE: `${STBN_TEXTURE_SIZE}`,
          STBN_TEXTURE_DEPTH: `${STBN_TEXTURE_DEPTH}`
        }
      },
      atmosphere
    )

    this.shadowCascadeCount = shadowCascadeCount
  }

  override onBeforeRender(
    renderer: WebGLRenderer,
    scene: Scene,
    camera: Camera,
    geometry: BufferGeometry,
    object: Object3D,
    group: Group
  ): void {
    // Disable onBeforeRender in AtmosphereMaterialBase because we're rendering
    // into fullscreen quad with another camera for the scene projection.
  }

  override copyCameraSettings(camera: Camera): void {
    super.copyCameraSettings(camera)

    if (camera.isPerspectiveCamera === true) {
      if (this.defines.PERSPECTIVE_CAMERA !== '1') {
        this.defines.PERSPECTIVE_CAMERA = '1'
        this.needsUpdate = true
      }
    } else {
      if (this.defines.PERSPECTIVE_CAMERA != null) {
        delete this.defines.PERSPECTIVE_CAMERA
        this.needsUpdate = true
      }
    }

    const uniforms = this.uniforms
    const viewMatrix = uniforms.viewMatrix
    const inverseProjectionMatrix = uniforms.inverseProjectionMatrix
    const inverseViewMatrix = uniforms.inverseViewMatrix
    viewMatrix.value.copy(camera.matrixWorldInverse)
    inverseProjectionMatrix.value.copy(camera.projectionMatrixInverse)
    inverseViewMatrix.value.copy(camera.matrixWorld)

    assertType<PerspectiveCamera | OrthographicCamera>(camera)
    uniforms.cameraNear.value = camera.near
    uniforms.cameraFar.value = camera.far

    const cameraHeight = uniforms.cameraHeight
    const position = uniforms.cameraPosition.value
    try {
      cameraHeight.value = geodeticScratch.setFromECEF(position).height
    } catch (error) {
      // Abort when the position is zero.
    }
  }

  setSize(width: number, height: number): void {
    this.uniforms.resolution.value.set(width, height)
  }

  get depthBuffer(): Texture | null {
    return this.uniforms.depthBuffer.value
  }

  set depthBuffer(value: Texture | null) {
    this.uniforms.depthBuffer.value = value
  }

  get depthPacking(): number {
    return +this.defines.DEPTH_PACKING
  }

  set depthPacking(value: number) {
    if (value !== this.depthPacking) {
      this.defines.DEPTH_PACKING = `${value}`
      this.needsUpdate = true
    }
  }

  get useShapeDetail(): boolean {
    return this.defines.USE_SHAPE_DETAIL != null
  }

  set useShapeDetail(value: boolean) {
    if (value !== this.useShapeDetail) {
      if (value) {
        this.defines.USE_SHAPE_DETAIL = '1'
      } else {
        delete this.defines.USE_SHAPE_DETAIL
      }
      this.needsUpdate = true
    }
  }

  get multiScatteringOctaves(): number {
    return +this.defines.MULTI_SCATTERING_OCTAVES
  }

  set multiScatteringOctaves(value: number) {
    if (value !== this.multiScatteringOctaves) {
      this.defines.MULTI_SCATTERING_OCTAVES = `${value}`
      this.needsUpdate = true
    }
  }

  get usePowder(): boolean {
    return this.defines.USE_POWDER != null
  }

  set usePowder(value: boolean) {
    if (value !== this.usePowder) {
      if (value) {
        this.defines.USE_POWDER = '1'
      } else {
        delete this.defines.USE_POWDER
      }
      this.needsUpdate = true
    }
  }

  get useGroundIrradiance(): boolean {
    return this.defines.USE_GROUND_IRRADIANCE != null
  }

  set useGroundIrradiance(value: boolean) {
    if (value !== this.useGroundIrradiance) {
      if (value) {
        this.defines.USE_GROUND_IRRADIANCE = '1'
      } else {
        delete this.defines.USE_GROUND_IRRADIANCE
      }
      this.needsUpdate = true
    }
  }

  get shadowCascadeCount(): number {
    return +this.defines.SHADOW_CASCADE_COUNT
  }

  set shadowCascadeCount(value: number) {
    if (value !== this.shadowCascadeCount) {
      this.defines.SHADOW_CASCADE_COUNT = `${value}`
      this.needsUpdate = true
    }
  }
}
