import {
  extend,
  type ElementProps,
  type ThreeElement
} from '@react-three/fiber'
import { useRef, type FC } from 'react'
import { mergeRefs } from 'react-merge-refs'
import { type Mesh } from 'three'

import { EllipsoidGeometry } from '../EllipsoidGeometry'

declare module '@react-three/fiber' {
  interface ThreeElements {
    ellipsoidGeometry: ThreeElement<typeof EllipsoidGeometry>
  }
}

export interface EllipsoidMeshProps
  extends Omit<ElementProps<typeof Mesh>, 'args'> {
  args?: ConstructorParameters<typeof EllipsoidGeometry>
}

export const EllipsoidMesh: FC<EllipsoidMeshProps> = ({
  ref: forwardedRef,
  args,
  children,
  ...props
}) => {
  const ref = useRef<Mesh | null>(null)
  extend({ EllipsoidGeometry })
  return (
    <mesh ref={mergeRefs([ref, forwardedRef])} {...props}>
      <ellipsoidGeometry args={args} />
      {children}
    </mesh>
  )
}
