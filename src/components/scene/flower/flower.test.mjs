import assert from "node:assert/strict";
import test from "node:test";
import { FlowerController, createPetalDescriptors } from "./FlowerController.ts";
import { createPetalGeometry } from "./PetalGeometry.ts";

function advance(controller, seconds) {
  for (let step = 0; step < Math.round(seconds * 100); step += 1) controller.update(0.01);
}

test("seeded sculpture is repeatable and mobile reduces all three layers", () => {
  const desktop = createPetalDescriptors(407, false);
  const mobile = createPetalDescriptors(407, true);
  assert.deepEqual(desktop, createPetalDescriptors(407, false));
  assert.notDeepEqual(desktop, createPetalDescriptors(408, false));
  assert.equal(desktop.length, 42);
  assert.equal(mobile.length, 27);
  for (const layer of ["inner", "middle", "outer"]) {
    assert.ok(mobile.filter((petal) => petal.layer === layer).length
      < desktop.filter((petal) => petal.layer === layer).length);
  }
  assert.ok(desktop.every((petal) => petal.delay >= 0 && petal.delay < 1));
  assert.ok(desktop.every((petal) => petal.length > petal.width));
});

test("curved geometry is sealed and has complete, finite bud morph positions/normals", () => {
  const geometry = createPetalGeometry({ segments: 18, across: 8, bend: 0.28 });
  const position = geometry.getAttribute("position");
  const normal = geometry.getAttribute("normal");
  assert.equal(geometry.morphAttributes.position[0].count, position.count);
  assert.equal(geometry.morphAttributes.normal[0].count, normal.count);
  assert.notDeepEqual(position.array, geometry.morphAttributes.position[0].array);
  for (const attribute of [position, normal, ...geometry.morphAttributes.position,
    ...geometry.morphAttributes.normal]) {
    assert.ok(Array.from(attribute.array).every(Number.isFinite));
  }
  assert.ok(geometry.boundingBox.max.z - geometry.boundingBox.min.z > 0.3);
  assert.ok(Number.isFinite(geometry.boundingSphere.radius));

  const edges = new Map();
  const index = geometry.index;
  for (let offset = 0; offset < index.count; offset += 3) {
    const triangle = [index.getX(offset), index.getX(offset + 1), index.getX(offset + 2)];
    for (let side = 0; side < 3; side += 1) {
      const a = triangle[side];
      const b = triangle[(side + 1) % 3];
      const key = a < b ? `${a}/${b}` : `${b}/${a}`;
      edges.set(key, (edges.get(key) ?? 0) + 1);
    }
  }
  assert.ok(Array.from(edges.values()).every((count) => count === 2));
  geometry.dispose();
});

test("state changes interpolate without resetting the pose", () => {
  const controller = new FlowerController("CLOSED");
  controller.setState("BLOOMING");
  advance(controller, 0.5);
  assert.ok(controller.openness > 0 && controller.openness < 1);
  const previous = controller.openness;
  controller.setState("CLOSED");
  assert.equal(controller.openness, previous);
  advance(controller, 1);
  assert.ok(controller.openness < previous);
  controller.setState("OPEN");
  advance(controller, 6);
  assert.equal(controller.openness, 1);
  controller.setProgress(0.42);
  advance(controller, 6);
  assert.equal(controller.openness, 0.42);
  controller.setState("CLOSED");
  controller.update(0.016, true);
  assert.equal(controller.openness, 0);
});

test("tap pulses, held core bursts, and every envelope returns to rest", () => {
  const controller = new FlowerController("OPEN");
  controller.beginCharge();
  advance(controller, 0.1);
  assert.equal(controller.releaseCharge(), "pulse");
  advance(controller, 0.3);
  assert.ok(controller.pulse > 0);
  assert.equal(controller.burst, 0);
  advance(controller, 2);
  assert.equal(controller.pulse, 0);

  controller.beginCharge();
  advance(controller, 0.27);
  assert.equal(controller.releaseCharge(), "burst");
  advance(controller, 0.3);
  assert.ok(controller.burst > 0);
  advance(controller, 2);
  assert.equal(controller.burst, 0);
  assert.equal(controller.charge, 0);
  controller.beginCharge();
  advance(controller, 0.5);
  controller.cancelCharge();
  assert.equal(controller.isCharging, false);
  assert.equal(controller.charge, 0);
});

test("manual takeover seeds the visible pose and replay clears interaction envelopes",()=>{
 const controller=new FlowerController("OPEN");controller.captureOpenness(.37);controller.setState("CLOSED");
 assert.equal(controller.openness,.37);controller.update(.016);assert.ok(controller.openness<.37&&controller.openness>.3);
 controller.beginCharge();advance(controller,.5);controller.releaseCharge();advance(controller,.2);assert.ok(controller.burst>0);
 controller.resetInteraction();assert.equal(controller.burst,0);assert.equal(controller.pulse,0);assert.equal(controller.isCharging,false);
 advance(controller,.3);assert.equal(controller.burst,0);assert.equal(controller.pulse,0);
});
