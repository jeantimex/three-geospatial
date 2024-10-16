// Based on the following work:
// https://github.com/StrandedKitty/three-csm/tree/master/src
// https://github.com/mrdoob/three.js/tree/r169/examples/jsm/csm

import {
  Box3,
  Matrix4,
  Object3D,
  Vector2,
  Vector3,
  type Material,
  type OrthographicCamera,
  type PerspectiveCamera
} from 'three'
import invariant from 'tiny-invariant'

import { CascadedDirectionalLight } from './CascadedDirectionalLight'
import { FrustumCorners } from './FrustumCorners'
import { MaterialStates } from './MaterialStates'
import { splitFrustum, type FrustumSplitMode } from './splitFrustum'

const vectorScratch1 = /*#__PURE__*/ new Vector3()
const vectorScratch2 = /*#__PURE__*/ new Vector3()
const matrixScratch1 = /*#__PURE__*/ new Matrix4()
const matrixScratch2 = /*#__PURE__*/ new Matrix4()
const frustumScratch = /*#__PURE__*/ new FrustumCorners()
const boxScratch = /*#__PURE__*/ new Box3()

export interface CascadedShadowMapsParams {
  cascadeCount?: number
  maxCascadeCount?: number
  far?: number
  mode?: FrustumSplitMode
  lambda?: number
  margin?: number
  fade?: boolean
  disableLastCascadeCutoff?: boolean
  intensity?: number
  mapSize?: number
  bias?: number
  normalBias?: number
}

export const cascadedShadowMapParamsDefaults = {
  cascadeCount: 4,
  far: 100000,
  mode: 'practical',
  lambda: 0.5,
  margin: 200,
  fade: true,
  disableLastCascadeCutoff: false,
  intensity: 1,
  mapSize: 2048,
  bias: 0,
  normalBias: 0
} satisfies Partial<CascadedShadowMapsParams>

export class CascadedShadowMaps {
  maxCascadeCount: number
  far: number
  mode: FrustumSplitMode
  lambda: number
  margin: number
  fade: boolean
  disableLastCascadeCutoff: boolean
  bias: number
  normalBias: number
  needsUpdateFrusta = true

  readonly directionalLight = new CascadedDirectionalLight()
  readonly materialStates = new MaterialStates()
  readonly mainFrustum = new FrustumCorners()
  readonly cascadedFrusta: FrustumCorners[] = []
  readonly splits: number[] = []
  readonly cascades: Vector2[] = []

  constructor(
    readonly mainCamera: PerspectiveCamera | OrthographicCamera,
    params: CascadedShadowMapsParams
  ) {
    const {
      cascadeCount,
      maxCascadeCount = cascadeCount,
      far,
      mode,
      lambda,
      margin,
      fade,
      disableLastCascadeCutoff,
      intensity,
      mapSize,
      bias,
      normalBias
    } = { ...cascadedShadowMapParamsDefaults, ...params }
    this.cascadeCount = cascadeCount
    this.maxCascadeCount = maxCascadeCount
    this.far = far
    this.mode = mode
    this.lambda = lambda
    this.margin = margin
    this.fade = fade
    this.disableLastCascadeCutoff = disableLastCascadeCutoff
    this.bias = bias
    this.normalBias = normalBias
    this.intensity = intensity
    this.mapSize = mapSize
  }

  private updateCascades(): void {
    const splits = this.splits
    splitFrustum(
      this.mode,
      this.cascadeCount,
      this.mainCamera.near,
      Math.min(this.mainCamera.far, this.far),
      this.lambda,
      splits
    )
    this.mainFrustum.setFromCamera(this.mainCamera, this.far)
    this.mainFrustum.split(splits, this.cascadedFrusta)

    const cascades = this.cascades
    for (let i = 0; i < this.maxCascadeCount; ++i) {
      const vector = cascades[i] ?? (cascades[i] = new Vector2())
      vector.set(splits[i - 1] ?? 0, splits[i] ?? 0)
    }
    if (this.disableLastCascadeCutoff) {
      cascades[this.maxCascadeCount - 1].y = Infinity
    }
    cascades.length = this.maxCascadeCount
  }

  private getFrustumRadius(frustum: FrustumCorners): number {
    // Get the two points that represent that furthest points on the frustum
    // assuming that's either the diagonal across the far plane or the diagonal
    // across the whole frustum itself.
    const nearCorners = frustum.near
    const farCorners = frustum.far
    let length = Math.max(
      farCorners[0].distanceTo(farCorners[2]),
      farCorners[0].distanceTo(nearCorners[2])
    )

    // Expand the shadow bounds by the fade width.
    if (this.fade) {
      const camera = this.mainCamera
      const near = camera.near
      const far = Math.min(camera.far, this.far)
      const distance = farCorners[0].z / (far - near)
      length += 0.25 * distance ** 2 * (far - near)
    }
    return length * 0.5
  }

  private updateShadowBounds(): void {
    const frusta = this.cascadedFrusta
    const lights = this.directionalLight.cascadedLights
    invariant(frusta.length === lights.length)

    for (let i = 0; i < frusta.length; ++i) {
      const radius = this.getFrustumRadius(this.cascadedFrusta[i])
      const light = lights[i]
      const camera = light.shadow.camera
      camera.left = -radius
      camera.right = radius
      camera.top = radius
      camera.bottom = -radius
      camera.near = 0
      camera.far = radius * 2 + this.margin
      camera.updateProjectionMatrix()

      // light.shadow.bias = this.bias * radius
      // light.shadow.normalBias = this.normalBias * radius
    }
  }

  private updateFrusta(): void {
    this.updateCascades()
    this.updateShadowBounds()
    this.materialStates.update(this)
  }

  update(): void {
    if (this.needsUpdateFrusta) {
      this.updateFrusta()
      this.needsUpdateFrusta = false
    }

    const directionalLight = this.directionalLight
    const lightDirection = vectorScratch1
      .copy(directionalLight.direction)
      .normalize()
    const lightOrientationMatrix = matrixScratch1.lookAt(
      new Vector3(),
      lightDirection,
      Object3D.DEFAULT_UP
    )
    const cameraToLightMatrix = matrixScratch2.multiplyMatrices(
      matrixScratch2.copy(lightOrientationMatrix).invert(),
      this.mainCamera.matrixWorld
    )

    const margin = this.margin
    const mapSize = this.mapSize
    const frusta = this.cascadedFrusta
    const lights = directionalLight.cascadedLights
    for (let i = 0; i < frusta.length; ++i) {
      const { near, far } = frustumScratch
        .copy(frusta[i])
        .applyMatrix4(cameraToLightMatrix)
      const bbox = boxScratch.makeEmpty()
      for (let j = 0; j < 4; j++) {
        bbox.expandByPoint(near[j])
        bbox.expandByPoint(far[j])
      }
      const center = bbox.getCenter(vectorScratch2)
      center.z = bbox.max.z + margin

      // Round light-space translation to even texel increments.
      const light = lights[i]
      const { left, right, top, bottom } = light.shadow.camera
      const texelWidth = (right - left) / mapSize
      const texelHeight = (top - bottom) / mapSize
      center.x = Math.round(center.x / texelWidth) * texelWidth
      center.y = Math.round(center.y / texelHeight) * texelHeight

      center.applyMatrix4(lightOrientationMatrix)
      light.position.copy(center)
      light.target.position.copy(center)
      light.target.position.add(lightDirection)
    }
  }

  get cascadeCount(): number {
    return this.directionalLight.cascadedLights.length
  }

  set cascadeCount(value: number) {
    if (value !== this.cascadeCount) {
      this.directionalLight.setCount(value)
      this.needsUpdateFrusta = true
    }
  }

  get intensity(): number {
    return this.directionalLight.mainLight.shadow.intensity
  }

  set intensity(value: number) {
    if (value !== this.intensity) {
      const lights = this.directionalLight.cascadedLights
      for (let i = 0; i < lights.length; ++i) {
        lights[i].shadow.intensity = value
      }
    }
  }

  get mapSize(): number {
    return this.directionalLight.mainLight.shadow.mapSize.width
  }

  set mapSize(value: number) {
    if (value !== this.mapSize) {
      const lights = this.directionalLight.cascadedLights
      for (let i = 0; i < lights.length; ++i) {
        const shadow = lights[i].shadow
        shadow.mapSize.width = value
        shadow.mapSize.height = value
        if (shadow.map != null) {
          shadow.map.dispose()
          shadow.map = null
        }
      }
    }
  }

  setupMaterial<T extends Material>(material: T): T {
    return this.materialStates.setup(material, this)
  }

  rollbackMaterial<T extends Material>(material: T): T {
    return this.materialStates.rollback(material)
  }

  dispose(): void {
    this.materialStates.dispose()
    this.directionalLight.dispose()
  }
}
