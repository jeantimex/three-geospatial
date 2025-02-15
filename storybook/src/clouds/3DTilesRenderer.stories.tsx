import { type Meta, type StoryFn } from '@storybook/react'

import { Story } from './3DTilesRenderer-Story'

export default {
  title: 'clouds (WIP)/3D Tiles Renderer Integration',
  parameters: {
    layout: 'fullscreen'
  }
} satisfies Meta

export const Tokyo: StoryFn = () => (
  <Story
    dayOfYear={170}
    timeOfDay={7.5}
    exposure={15}
    longitude={139.8146}
    latitude={35.7455}
    heading={-110}
    pitch={-9}
    distance={1000}
    coverage={0.35}
  />
)

export const Fuji: StoryFn = () => (
  <Story
    dayOfYear={200}
    timeOfDay={17.5}
    exposure={10}
    longitude={138.6340}
    latitude={35.5000}
    heading={-91}
    pitch={-27}
    distance={8444}
    coverage={0.4}
  />
)

export const London: StoryFn = () => (
  <Story
    dayOfYear={0}
    timeOfDay={11}
    exposure={15}
    longitude={-0.1293}
    latitude={51.4836}
    heading={-94}
    pitch={-7}
    distance={3231}
    coverage={0.45}
  />
)
