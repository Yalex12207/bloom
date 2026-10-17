import { BufferGeometry, Float32BufferAttribute } from "three";

export interface PetalGeometryOptions {
  segments?: number;
  across?: number;
  bend?: number;
}

/**
 * A sealed, thin petal volume. The root is at the origin and its tip follows +Y.
 * Mesh scale supplies length/width; morph index zero curls the same vertices into
 * a bud. Both positions and normals morph, keeping physical highlights stable.
 */
export function createPetalGeometry({
  segments = 30,
  across = 12,
  bend = 0.28,
}: PetalGeometryOptions = {}): BufferGeometry {
  const rows = Math.max(4, Math.min(80, Math.round(Number.isFinite(segments) ? segments : 30)));
  const columns = Math.max(4, Math.min(32, Math.round(Number.isFinite(across) ? across : 12)));
  const curvature = Number.isFinite(bend) ? bend : 0.28;
  const stride = columns + 1;
  const surfaceCount = (rows + 1) * stride;
  const positions = new Float32Array(surfaceCount * 2 * 3);
  const closedPositions = new Float32Array(positions.length);
  const uvs = new Float32Array(surfaceCount * 2 * 2);
  const indices: number[] = [];

  for (let side = 0; side < 2; side += 1) {
    const depthOffset = side === 0 ? 0.005 : -0.005;

    for (let row = 0; row <= rows; row += 1) {
      const t = row / rows;
      const lobe = Math.pow(Math.max(0, Math.sin(t * Math.PI)), 0.68);
      const width = Math.max(0.009, lobe * (0.82 + t * 0.18));

      for (let column = 0; column <= columns; column += 1) {
        const u = column / columns * 2 - 1;
        const vertex = side * surfaceCount + row * stride + column;
        const positionIndex = vertex * 3;
        const x = u * width * 0.5;
        const cup = u * u * lobe * 0.125;
        // A restrained center ridge catches the studio strips without a texture.
        const vein = Math.exp(-u * u * 34) * Math.sin(t * Math.PI) * 0.018;
        positions[positionIndex] = x;
        positions[positionIndex + 1] = t;
        positions[positionIndex + 2] = curvature * t * t + cup + vein + depthOffset;

        closedPositions[positionIndex] = x * (1 - t * 0.22);
        closedPositions[positionIndex + 1] = Math.sin(t * 1.75) / 1.75;
        closedPositions[positionIndex + 2] = (1 - Math.cos(t * 1.75)) / 1.75
          + curvature * t * t * 0.2 + cup * 0.85 + vein + depthOffset;
        uvs[vertex * 2] = column / columns;
        uvs[vertex * 2 + 1] = t;
      }
    }
  }

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const a = row * stride + column;
      const b = a + 1;
      const c = a + stride;
      const d = c + 1;
      indices.push(a, b, c, b, d, c);
      indices.push(a + surfaceCount, c + surfaceCount, b + surfaceCount);
      indices.push(b + surfaceCount, c + surfaceCount, d + surfaceCount);
    }
  }

  // Connect both surfaces around all four edges, including the tiny root/tip.
  for (let row = 0; row < rows; row += 1) {
    const left = row * stride;
    const nextLeft = left + stride;
    const right = left + columns;
    const nextRight = right + stride;
    indices.push(left, nextLeft, left + surfaceCount);
    indices.push(nextLeft, nextLeft + surfaceCount, left + surfaceCount);
    indices.push(right, right + surfaceCount, nextRight);
    indices.push(nextRight, right + surfaceCount, nextRight + surfaceCount);
  }

  for (let column = 0; column < columns; column += 1) {
    const bottom = column;
    const top = rows * stride + column;
    indices.push(bottom, bottom + surfaceCount, bottom + 1);
    indices.push(bottom + 1, bottom + surfaceCount, bottom + 1 + surfaceCount);
    indices.push(top, top + 1, top + surfaceCount);
    indices.push(top + 1, top + 1 + surfaceCount, top + surfaceCount);
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  const closedGeometry = new BufferGeometry();
  closedGeometry.setAttribute("position", new Float32BufferAttribute(closedPositions, 3));
  closedGeometry.setIndex(indices);
  closedGeometry.computeVertexNormals();

  geometry.morphAttributes.position = [closedGeometry.getAttribute("position").clone()];
  geometry.morphAttributes.normal = [closedGeometry.getAttribute("normal").clone()];
  geometry.morphTargetsRelative = false;
  geometry.name = "BLOOM / curved petal";
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  closedGeometry.dispose();
  return geometry;
}
