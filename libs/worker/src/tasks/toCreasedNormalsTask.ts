/* eslint-env worker */

import { BufferAttribute, BufferGeometry } from 'three'
import { toCreasedNormals } from 'three-stdlib'

import { isNotNullish } from '@geovanni/core'

import { Transfer, type TransferResult } from '../transfer'
import { type BufferGeometryAttributes } from '../types'

export function toCreasedNormalsTask(
  input: BufferGeometryAttributes,
  creaseAngle?: number
): TransferResult<BufferGeometryAttributes> {
  const geometry = new BufferGeometry()
  for (const [name, attribute] of Object.entries(input.attributes)) {
    geometry.setAttribute(
      name,
      new BufferAttribute(
        attribute.array,
        attribute.itemSize,
        attribute.normalized
      )
    )
  }
  if (input.index != null) {
    geometry.index = new BufferAttribute(
      input.index.array,
      input.index.itemSize,
      input.index.normalized
    )
  }
  const result = toCreasedNormals(geometry, creaseAngle)
  return Transfer(
    result,
    [
      ...Object.values(result.attributes).map(
        attribute => attribute.array.buffer
      ),
      result.index?.array.buffer
    ].filter(isNotNullish)
  )
}
