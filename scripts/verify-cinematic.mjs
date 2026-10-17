/* global window, document, scrollY */
import process from 'node:process';
import console from 'node:console';
import {mkdir} from 'node:fs/promises';
await mkdir('artifacts',{recursive:true});
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {writeFile} from 'node:fs/promises';
const {chromium}=await import(process.argv[2] ? pathToFileURL(process.argv[2]).href : 'playwright');
const browser=await chromium.launch({executablePath:process.argv[3]||undefined,headless:true,args:['--disable-gpu-sandbox','--enable-webgl','--ignore-gpu-blocklist']});
const base=process.argv[4]||'http://127.0.0.1:3016';const results=[],errors=[];
const root='[data-cinematic-root]',controls='[data-flower-controls]';
const state=p=>p.locator(controls).evaluate(el=>({...el.dataset}));
const narrative=p=>p.locator(root).evaluate(el=>({...el.dataset}));
const monitor=p=>{p.on('pageerror',error=>errors.push(error.stack));p.on('console',message=>{if(message.type()==='error')errors.push(message.text());});};
async function check(name,fn){try{await fn();console.log('PASS',name);results.push({name,passed:true});}catch(error){console.log('FAIL',name,error.message);results.push({name,passed:false,error:error.message});}}
async function ready(page){await page.goto(base,{waitUntil:'networkidle'});await page.locator(controls).waitFor();await page.waitForFunction(()=>!!document.querySelector('[data-cinematic-root]').dataset.cinemaBoundaries);}
async function seek(page,p){await page.evaluate(p=>{const bounds=document.querySelector('[data-cinematic-root]').dataset.cinemaBoundaries.split(',').map(Number);const i=Math.min(4,Math.floor(p*5));window.scrollTo({top:bounds[i]+(bounds[i+1]-bounds[i])*(p*5-i),behavior:'instant'});},p);await page.waitForFunction(p=>Math.abs(Number(document.querySelector('[data-cinematic-root]').dataset.cinemaProgress)-p)<.0002,p);await page.waitForTimeout(350);}
try{
 const desktop=await browser.newContext({viewport:{width:1440,height:960}});const page=await desktop.newPage();monitor(page);
 await check('one master and one persistent Canvas across all five phases',async()=>{
  await ready(page);await page.locator('canvas').evaluate(el=>{el.dataset.identity='retained';});
  for(const [p,phase] of [[.12,'awakening'],[.34,'genesis'],[.53,'fracture'],[.75,'metamorphosis'],[.97,'rebirth']]){await seek(page,p);assert.equal((await narrative(page)).cinemaChapter,phase);assert.equal((await narrative(page)).cinemaTriggerCount,'1');assert.equal(await page.locator('canvas').getAttribute('data-identity'),'retained');assert.equal(await page.locator('canvas').evaluate(el=>el.getContext('webgl2').getError()),0);await page.screenshot({path:`artifacts/round3-${phase}-desktop.png`});}
 });
 await check('reverse and fast jumps reproduce the same scroll pose',async()=>{
  await seek(page,.34);const before=await state(page);for(const p of [.98,.02,.74,.44,.12,.34])await seek(page,p);const after=await state(page);for(const key of ['camera','scatter','sculpture','openness'])assert.equal(after[key],before[key]);
 });
 await check('refresh restores the current late chapter and camera',async()=>{
  await seek(page,.94);const before=await narrative(page);await page.reload({waitUntil:'networkidle'});await page.locator(controls).waitFor();await page.waitForTimeout(700);const after=await narrative(page);assert.ok(Math.abs(Number(after.cinemaProgress)-Number(before.cinemaProgress))<.003);assert.equal(after.cinemaChapter,'rebirth');assert.equal(after.cinemaTriggerCount,'1');
 });
 await check('native chapter menu and hash deep links land on their timeline section',async()=>{
  await page.getByRole('button',{name:/The chapters/}).click();await page.locator('.chapter-menu-link').filter({hasText:'GENESIS'}).click();await page.waitForFunction(()=>Math.abs(Number(document.querySelector('[data-cinematic-root]').dataset.cinemaProgress)-.2)<.002);await page.reload({waitUntil:'networkidle'});await page.waitForTimeout(500);assert.ok(Math.abs(Number((await narrative(page)).cinemaProgress)-.2)<.003);
 });
 await check('manual closed takeover stays continuous and later scroll releases it',async()=>{
  await seek(page,.32);const before=Number((await state(page)).openness);await page.getByRole('button',{name:'CLOSED',exact:true}).click();await page.waitForTimeout(70);const after=Number((await state(page)).openness);assert.ok(after<=before+.02);await seek(page,.55);await page.waitForTimeout(850);assert.ok(Number((await state(page)).openness)>.995);
 });
 await check('drag, core pulse, and long press work with the external event source',async()=>{
  await seek(page,.39);await page.getByRole('button',{name:'Reset flower rotation',exact:true}).click();let d=await state(page);const x=Number(d.coreX),y=Number(d.coreY);await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+65,y+25,{steps:8});await page.mouse.up();await page.waitForTimeout(180);assert.notEqual((await state(page)).rotation,'0.000,0.000');await page.getByRole('button',{name:'Reset flower rotation',exact:true}).click();await page.waitForTimeout(150);d=await state(page);await page.mouse.click(Number(d.coreX),Number(d.coreY));await page.waitForFunction(()=>Number(document.querySelector('[data-flower-controls]').dataset.pulse)>.1);await page.waitForTimeout(1700);await page.mouse.move(Number(d.coreX),Number(d.coreY));await page.mouse.down();await page.waitForTimeout(600);assert.ok(Number((await state(page)).charge)>.25);await page.mouse.up();await page.waitForFunction(()=>Number(document.querySelector('[data-flower-controls]').dataset.burst)>.1);
 });
 await check('all physical finishes retain dissolve and stable GPU resources',async()=>{
  await seek(page,.55);for(const finish of ['glass','crimson','violet','silver']){await page.locator(`[data-finish="${finish}"]`).click();await page.waitForTimeout(160);assert.equal(await page.locator('canvas').evaluate(el=>el.getContext('webgl2').getError()),0);}for(const p of [.98,.33,.54,.75])await seek(page,p);const before=await state(page);for(const p of [.99,.01,.75,.33,.54,.99,.75])await seek(page,p);const after=await state(page);assert.ok(Number(after.geometries)<=Number(before.geometries)+1);assert.ok(Number(after.textures)<=Number(before.textures)+1);console.log('GPU_STABILITY',JSON.stringify({before,after}));
 });
 await check('Replay remains visible at the end and resets progress and user effects',async()=>{
  await seek(page,1);const button=page.getByRole('button',{name:'REPLAY EXPERIENCE',exact:true});const box=await button.boundingBox();assert.ok(box.y>=90&&box.y+box.height<=960);await button.click();await page.waitForFunction(()=>Number(document.querySelector('[data-cinematic-root]').dataset.cinemaProgress)<.001);assert.equal((await state(page)).burst,'0.000');assert.equal((await state(page)).pulse,'0.000');assert.equal((await state(page)).rotation,'0.000,0.000');
 });
 const reduced=await browser.newContext({viewport:{width:1440,height:960},reducedMotion:'reduce'});const rp=await reduced.newPage();monitor(rp);
 await check('reduced motion preserves narrative and instantly releases local pose',async()=>{
  await ready(rp);await seek(rp,.35);const first=await state(rp);await rp.getByRole('button',{name:'CLOSED',exact:true}).click();await rp.waitForTimeout(200);assert.equal((await state(rp)).openness,'0.000');await seek(rp,.55);assert.equal((await state(rp)).openness,'1.000');assert.equal((await state(rp)).camera,first.camera);await seek(rp,.94);assert.equal((await narrative(rp)).cinemaChapter,'rebirth');
 });
 const mobile=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true});const mp=await mobile.newPage();monitor(mp);
 await check('mobile supports all phases without overflow or additional Canvas',async()=>{
  await ready(mp);for(const [p,phase] of [[.12,'awakening'],[.34,'genesis'],[.53,'fracture'],[.75,'metamorphosis'],[.97,'rebirth']]){await seek(mp,p);assert.equal((await narrative(mp)).cinemaChapter,phase);assert.equal(await mp.evaluate(()=>document.documentElement.scrollWidth),390);assert.equal((await state(mp)).petals,'27');assert.equal(await mp.locator('canvas').count(),1);await mp.screenshot({path:`artifacts/round3-${phase}-mobile.png`});}
 });
 await check('mobile touch rotates locally and scrolls the narrative outside the flower',async()=>{
  await seek(mp,.39);const d=await state(mp);const session=await mobile.newCDPSession(mp);const x=Number(d.coreX),y=Number(d.coreY),before=await mp.evaluate(()=>scrollY);await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});for(let i=1;i<=8;i++){await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+i*6,y:y+i*2}]});await mp.waitForTimeout(20);}await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await mp.waitForTimeout(180);assert.notEqual((await state(mp)).rotation,'0.000,0.000');assert.equal(await mp.evaluate(()=>scrollY),before);
  await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:10,y:650}]});for(let i=1;i<=10;i++){await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:10,y:650-i*30}]});await mp.waitForTimeout(25);}await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await mp.waitForTimeout(600);assert.ok(await mp.evaluate(()=>scrollY)>before+100);await session.detach();
 });
 await check('mobile resize refreshes one master and preserves reachable Replay',async()=>{
  for(const width of [320,430,390]){await mp.setViewportSize({width,height:844});await mp.waitForTimeout(250);assert.equal(await mp.evaluate(()=>document.documentElement.scrollWidth),width);assert.equal((await narrative(mp)).cinemaTriggerCount,'1');}await seek(mp,1);const box=await mp.getByRole('button',{name:'REPLAY EXPERIENCE',exact:true}).boundingBox();assert.ok(box.y>75&&box.y+box.height<790);const content=await mp.locator('.rebirth-content').boundingBox();const footer=await mp.locator('.site-footer').boundingBox();assert.ok(footer.y>=content.y+content.height+20);await mp.screenshot({path:'artifacts/round3-finale-mobile.png'});
 });
 await check('WebGL loss keeps all five native chapters usable',async()=>{await page.locator('canvas').evaluate(el=>el.getContext('webgl2').getExtension('WEBGL_lose_context').loseContext());await page.getByText('BOTANICAL STUDY / OUTLINE MODE',{exact:true}).waitFor();assert.equal(await page.locator('canvas').count(),0);assert.equal(await page.locator('[data-chapter]').count(),5);});
 await check('no hydration, browser runtime, or shader errors',async()=>assert.deepEqual(errors,[]));
}finally{await browser.close();await writeFile('artifacts/cinematic-verification.json',JSON.stringify({base,results,errors},null,2));}
console.log('RESULT',`${results.filter(r=>r.passed).length}/${results.length}`);if(results.some(r=>!r.passed))process.exitCode=1;
