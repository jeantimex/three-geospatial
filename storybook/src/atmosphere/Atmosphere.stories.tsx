import { type Meta } from '@storybook/react'

import _Basic from './Atmosphere-Basic'
import _MovingEllipsoid from './Atmosphere-MovingEllipsoid'
import _Vanilla from './Atmosphere-Vanilla'
import _VanillaTorusKnotDeferredLighting from './Atmosphere-Vanilla-TorusKnot-Deferred-Lighting'
import _TorusKnot from './Atmosphere-TorusKnot'
import _TorusKnotDeferredLighting from './Atmosphere-TorusKnot-Deferred-Lighting'

export default {
  title: 'atmosphere/Atmosphere',
  parameters: {
    layout: 'fullscreen'
  }
} satisfies Meta

export const Basic = _Basic
export const MovingEllipsoid = _MovingEllipsoid
export const Vanilla = _Vanilla
export const VanillaTorusKnotDeferredLighting = _VanillaTorusKnotDeferredLighting
export const TorusKnot = _TorusKnot
export const TorusKnotDeferredLighting = _TorusKnotDeferredLighting
