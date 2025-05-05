import { type StoryFn } from '@storybook/react'
import {
  EffectComposer,
  EffectPass,
  NormalPass,
  RenderPass,
  ToneMappingEffect,
  ToneMappingMode,
  SMAAEffect,
} from 'postprocessing'
import { useLayoutEffect } from 'react'
import {
  Group,
  HalfFloatType,
  Mesh,
  MeshBasicMaterial,
  NoToneMapping,
  PCFSoftShadowMap,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  TorusKnotGeometry,
  Vector3,
  Matrix4,
  WebGLRenderer
} from 'three'
import { OrbitControls } from 'three-stdlib'
import invariant from 'tiny-invariant'

import {
  AerialPerspectiveEffect,
  getMoonDirectionECI,
  getSunDirectionECI,
  getECIToECEFRotationMatrix,
  PrecomputedTexturesLoader,
  SkyMaterial,
  type PrecomputedTextures
} from '@takram/three-atmosphere'
import { Ellipsoid, Geodetic, radians } from '@takram/three-geospatial'
import {
  DitheringEffect,
  LensFlareEffect
} from '@takram/three-geospatial-effects'

let renderer: WebGLRenderer
let camera: PerspectiveCamera
let controls: OrbitControls
let scene: Scene
let skyMaterial: SkyMaterial
let aerialPerspective: AerialPerspectiveEffect
let composer: EffectComposer

const sunDirection = new Vector3()
const moonDirection = new Vector3()
const rotationMatrix = new Matrix4()

// A midnight sun in summer.
const referenceDate = new Date('2025-05-04T12:00:00Z')
const geodetic = new Geodetic(0, radians(67), 1000)
const position = geodetic.toECEF()
const up = Ellipsoid.WGS84.getSurfaceNormal(position)

function init(): void {
  const container = document.getElementById('container')
  invariant(container != null)

  const aspect = window.innerWidth / window.innerHeight
  camera = new PerspectiveCamera(75, aspect, 10, 1e6)
  camera.position.copy(position)
  camera.up.copy(up)

  controls = new OrbitControls(camera, container)
  controls.enableDamping = true
  controls.minDistance = 1e3
  controls.target.copy(position)

  scene = new Scene()

  // SkyMaterial disables projection. Provide a plane that covers clip space.
  skyMaterial = new SkyMaterial()
  const sky = new Mesh(new PlaneGeometry(2, 2), skyMaterial)
  sky.frustumCulled = false
  scene.add(sky)

  const group = new Group()
  Ellipsoid.WGS84.getEastNorthUpFrame(position).decompose(
    group.position,
    group.quaternion,
    group.scale
  )
  scene.add(group)

  const torusKnot = new Mesh(
    new TorusKnotGeometry(200, 60, 256, 64),
    new MeshBasicMaterial({
      color: 'white'
    })
  )
  torusKnot.castShadow = true
  torusKnot.receiveShadow = true
  group.add(torusKnot)

  // Demonstrates forward lighting here. For deferred lighting, set
  // sunIrradiance and skyIrradiance to true, remove SkyLightProbe and
  // SunDirectionalLight, and provide a normal buffer to
  // AerialPerspectiveEffect.
  aerialPerspective = new AerialPerspectiveEffect(camera, {
    correctAltitude: true,
    correctGeometricError: true,
    inscatter: true,
    irradianceScale: 2 / Math.PI,
    moon: true,
    photometric: true,
    sky: true,
    skyIrradiance: true,
    sun: true,
    sunIrradiance: true,
    transmittance: true,
  })

  renderer = new WebGLRenderer({
    depth: false,
    logarithmicDepthBuffer: true
  })
  renderer.setPixelRatio(window.devicePixelRatio)
  renderer.setSize(window.innerWidth, window.innerHeight)
  renderer.toneMapping = NoToneMapping
  renderer.toneMappingExposure = 10
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = PCFSoftShadowMap

  // Use floating-point render buffer, as radiance/luminance is stored here.
  composer = new EffectComposer(renderer, {
    frameBufferType: HalfFloatType,
    multisampling: 8
  })
  const normalPass = new NormalPass(scene, camera)
  normalPass.enabled = false
  composer.addPass(new RenderPass(scene, camera))
  composer.addPass(normalPass)
  composer.addPass(new EffectPass(camera, aerialPerspective))
  composer.addPass(new EffectPass(camera, new LensFlareEffect()))
  composer.addPass(
    new EffectPass(camera,
      new ToneMappingEffect({ mode: ToneMappingMode.AGX }),
      new SMAAEffect(),
      new DitheringEffect()
    )
  )

  // Load precomputed textures.
  new PrecomputedTexturesLoader()
    .setTypeFromRenderer(renderer)
    .load('atmosphere', onPrecomputedTexturesLoad)

  container.appendChild(renderer.domElement)
  window.addEventListener('resize', onWindowResize)
}

function onPrecomputedTexturesLoad(textures: PrecomputedTextures): void {
  Object.assign(skyMaterial, textures)
  Object.assign(aerialPerspective, textures)

  renderer.setAnimationLoop(render)
}

function onWindowResize(): void {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
}

function render(): void {
  const date = referenceDate;
  getECIToECEFRotationMatrix(date, rotationMatrix);
  getSunDirectionECI(date, sunDirection).applyMatrix4(rotationMatrix);
  getMoonDirectionECI(date, moonDirection).applyMatrix4(rotationMatrix);

  skyMaterial.sunDirection.copy(sunDirection)
  skyMaterial.moonDirection.copy(moonDirection)

  aerialPerspective.sunDirection.copy(sunDirection)
  aerialPerspective.moonDirection.copy(moonDirection)

  controls.update()
  composer.render()
}

const Story: StoryFn = () => {
  useLayoutEffect(() => {
    init()
  }, [])
  return <div id='container' />
}

export default Story
