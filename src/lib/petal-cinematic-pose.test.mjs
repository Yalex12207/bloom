import test from "node:test";
import assert from "node:assert/strict";
import { createPetalDescriptors } from "../components/scene/flower/FlowerController.ts";
import { sampleCinematic } from "./cinematic-state.ts";
import { samplePetalPose } from "./petal-cinematic-pose.ts";
const pose=()=>({x:0,y:0,z:0,rx:0,ry:0,rz:0,angle:0,scale:1,morph:0});

test("petal trajectories stay finite and return to exactly the same pose after arbitrary seeks",()=>{
 const petals=createPetalDescriptors(48154,false),output=pose();
 const expected=petals.map((petal,index)=>({...samplePetalPose(petal,index,sampleCinematic(.53),output)}));
 for(let step=0;step<=300;step++)for(let index=0;index<petals.length;index++){
  samplePetalPose(petals[index],index,sampleCinematic(step/300),output);
  assert.ok(Object.values(output).every(Number.isFinite));assert.ok(output.morph>=0&&output.morph<=1);assert.ok(Math.hypot(output.x,output.y,output.z)<6);
 }
 for(let index=0;index<petals.length;index++)assert.deepEqual(samplePetalPose(petals[index],index,sampleCinematic(.53),output),expected[index]);
});
test("fracture uses both foreground and background depths and sculpture reassembles continuously",()=>{
 const petals=createPetalDescriptors(48154,false),output=pose(),fractured=sampleCinematic(.6);
 const depths=petals.map((petal,index)=>samplePetalPose(petal,index,fractured,output).z);
 assert.ok(Math.min(...depths)<-1);assert.ok(Math.max(...depths)>1);
 for(let index=0;index<petals.length;index++){
  const a={...samplePetalPose(petals[index],index,sampleCinematic(.8-1e-6),output)};
  const b=samplePetalPose(petals[index],index,sampleCinematic(.8+1e-6),output);
  for(const field of Object.keys(a))assert.ok(Math.abs(a[field]-b[field])<.001);
 }
});
