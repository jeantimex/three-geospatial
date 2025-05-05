/// <reference types="vite/types/importMeta.d.ts" />

import { OrbitControls, TorusKnot } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { SMAA, ToneMapping } from '@react-three/postprocessing'
import { type StoryFn } from '@storybook/react'
import {
  Fragment,
  useEffect,
  useRef,
  useState,
  type ComponentRef,
  type FC
} from 'react'

import {
  AerialPerspective,
  Atmosphere,
  type AtmosphereApi
} from '@takram/three-atmosphere/r3f'
import {
  Geodetic,
  PointOfView,
  radians,
} from '@takram/three-geospatial'
import {
  Dithering,
  LensFlare,
} from '@takram/three-geospatial-effects/r3f'
import { EastNorthUpFrame } from '@takram/three-geospatial/r3f'

import { EffectComposer } from '../helpers/EffectComposer'
import { Stats } from '../helpers/Stats'
import { useControls } from '../helpers/useControls'
import { useLocalDateControls } from '../helpers/useLocalDateControls'
import { useToneMappingControls } from '../helpers/useToneMappingControls'

const geodetic = new Geodetic(radians(138.5), radians(36.2), 5000)
const position = geodetic.toECEF()

const Scene: FC = () => {
  const { toneMappingMode } = useToneMappingControls({ exposure: 10 })
  const { lensFlare } = useControls(
    'effects',
    {
      lensFlare: true,
    },
    { collapsed: true }
  )
  const motionDate = useLocalDateControls()
  const {
    transmittance, inscatter, sunIrradiance, skyIrradiance, sky, sun, moon, correctAltitude, photometric, correctGeometricError} = useControls(
    'aerial perspective',
    {
      correctAltitude: true,
      correctGeometricError: true,
      inscatter: true,
      moon: true,
      photometric: true,
      sky: true,
      skyIrradiance: true,
      sun: true,
      sunIrradiance: true,
      transmittance: true,
    }
  )

  const { camera } = useThree()
  const [controls, setControls] = useState<ComponentRef<
    typeof OrbitControls
  > | null>(null)

  useEffect(() => {
    const pov = new PointOfView(2000, radians(-90), radians(-20))
    pov.decompose(position, camera.position, camera.quaternion, camera.up)
    if (controls != null) {
      controls.target.copy(position)
      controls.update()
    }
  }, [camera, controls])

  const atmosphereRef = useRef<AtmosphereApi>(null)
  useFrame(() => {
    const atmosphere = atmosphereRef.current
    if (atmosphere == null) {
      return
    }
    atmosphere.updateByDate(new Date(motionDate.get()))
  })

  return (
    <Atmosphere
      ref={atmosphereRef}
      textures='atmosphere'
    >
      <OrbitControls ref={setControls} />
      <EastNorthUpFrame {...geodetic}>
        <TorusKnot
          args={[200, 60, 256, 64]}
          position={[0, 0, 20]}
          receiveShadow
          castShadow
        >
          <meshBasicMaterial color='white' />
        </TorusKnot>
      </EastNorthUpFrame>
      <EffectComposer multisampling={0}>
        <Fragment
          // Effects are order-dependant; we need to reconstruct the nodes.
          key={JSON.stringify([
            sunIrradiance,
            skyIrradiance,
            transmittance,
            inscatter,
            lensFlare,
            correctGeometricError,
            correctAltitude,
            photometric,
            sun,
            sky,
            moon,
          ])}
        >
            <AerialPerspective
              correctAltitude={correctAltitude}
              correctGeometricError={correctGeometricError}
              inscatter={inscatter}
              moon={moon}
              photometric={photometric}
              sky={sky}
              skyIrradiance={skyIrradiance}
              sun={sun}
              sunIrradiance={sunIrradiance}
              transmittance={transmittance}
            />
          {lensFlare && <LensFlare />}
          <>
            <ToneMapping mode={toneMappingMode} />
            <SMAA />
            <Dithering />
          </>
        </Fragment>
      </EffectComposer>
    </Atmosphere>
  )
}

const Story: StoryFn = () => (
  <Canvas
    gl={{
      depth: false,
      logarithmicDepthBuffer: true
    }}
    camera={{ near: 100, far: 1e6 }}
  >
    <Stats />
    <Scene />
  </Canvas>
)

export default Story
