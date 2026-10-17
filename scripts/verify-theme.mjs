/* global window, document, scrollY, getComputedStyle */
import process from 'node:process';
import console from 'node:console';
import {mkdir} from 'node:fs/promises';
await mkdir('artifacts',{recursive:true});
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { writeFile } from 'node:fs/promises';
import { THEMES, THEME_IDS } from '../src/lib/ThemeController.ts';
const { chromium } = await import(process.argv[2] ? pathToFileURL(process.argv[2]).href : 'playwright');
const browser = await chromium.launch({ executablePath: process.argv[3]||undefined, headless: true, args: ['--disable-gpu-sandbox', '--enable-webgl', '--ignore-gpu-blocklist'] });
const base=process.argv[4]||'http://127.0.0.1:3016';
const results=[],errors=[];
const themeRoot='[data-theme-root]',control='[data-flower-controls]';
const tstate=p=>p.locator(themeRoot).evaluate(el=>({...el.dataset}));
const fstate=p=>p.locator(control).evaluate(el=>({...el.dataset}));
const monitor=p=>{p.on('pageerror',error=>errors.push(error.stack));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});};
async function check(name,fn){try{await fn();results.push({name,passed:true});console.log('PASS',name);}catch(error){results.push({name,passed:false,error:error.message});console.log('FAIL',name,error.message);}}
async function ready(p){const response=await p.goto(base,{waitUntil:'networkidle'});assert.equal(response.status(),200);await p.locator(control).waitFor();await p.waitForFunction(()=>!!document.querySelector('[data-cinematic-root]').dataset.cinemaBoundaries);}
async function seek(p,progress){await p.evaluate(progress=>{const b=document.querySelector('[data-cinematic-root]').dataset.cinemaBoundaries.split(',').map(Number),i=Math.min(4,Math.floor(progress*5));window.scrollTo({top:b[i]+(b[i+1]-b[i])*(progress*5-i),behavior:'instant'});},progress);await p.waitForFunction(progress=>Math.abs(Number(document.querySelector('[data-cinematic-root]').dataset.cinemaProgress)-progress)<.0002,progress);await p.waitForTimeout(350);}
async function settled(p,id){await p.waitForFunction(id=>{const el=document.querySelector('[data-theme-root]');return el.dataset.theme===id&&el.dataset.themeTransitioning==='false';},id);const def=THEMES[id];await p.waitForFunction(({a,b,tx})=>{const el=document.querySelector('[data-flower-controls]');return !el||(el.dataset.petalA===a&&el.dataset.petalB===b&&Math.abs(Number(el.dataset.petalTransmission)-tx)<.000001);},{a:def.petalA.slice(1).toLowerCase(),b:def.petalB.slice(1).toLowerCase(),tx:p.viewportSize().width<768?0:def.transmission});await p.waitForTimeout(150);}
const choose=(p,id)=>p.locator(`[data-theme-choice="${id}"]`).click();
const expected=id=>THEMES[id];
try{
 const desktop=await browser.newContext({viewport:{width:1440,height:960}}),page=await desktop.newPage();monitor(page);
 await check('Color Lab has six keyboard-accessible themes and starts in chapter Auto',async()=>{
  await ready(page);assert.equal(await page.locator('[data-theme-choice]').count(),6);assert.equal((await tstate(page)).theme,'CRIMSON');assert.equal((await tstate(page)).themeMode,'auto');assert.equal(await page.locator('[data-theme-choice][aria-pressed="true"]').count(),1);assert.equal(await page.locator('canvas').evaluate(el=>getComputedStyle(el).filter),'none');await page.locator('canvas').evaluate(el=>{el.dataset.identity='retained';});
 });
 await check('all six themes change real PBR color, transmission, core, lights and CSS together',async()=>{
  await seek(page,.35);
  for(const id of THEME_IDS){await choose(page,id);await settled(page,id);const t=await tstate(page),f=await fstate(page),def=expected(id);assert.equal(t.themeMode,'manual');assert.equal(t.themeAccent,def.accent.slice(1).toLowerCase());assert.equal(f.petalA,def.petalA.slice(1).toLowerCase());assert.equal(f.petalB,def.petalB.slice(1).toLowerCase());assert.equal(f.coreColor,def.core.slice(1).toLowerCase());assert.ok(Math.abs(Number(f.petalTransmission)-def.transmission)<.00001);assert.ok(Math.abs(Number(f.petalMetalness)-def.metalness)<.00001);assert.equal(f.particleColors,[def.particleA,def.particleB].map(x=>x.slice(1).toLowerCase()).join(','));assert.equal(f.lightColors,[def.keyLight,def.rimLight,def.fillLight].map(x=>x.slice(1).toLowerCase()).join(','));assert.equal(await page.locator('canvas').getAttribute('data-identity'),'retained');assert.equal(await page.locator('canvas').evaluate(el=>el.getContext('webgl2').getError()),0);await page.screenshot({path:`artifacts/round4-${id.toLowerCase()}-desktop.png`});}
 });
 await check('interrupted selections continue from the current color and finish in about 1.2 seconds',async()=>{
  await choose(page,'AZURE');await settled(page,'AZURE');await choose(page,'CRIMSON');await page.waitForTimeout(380);
  const samples=await page.evaluate(()=>{const el=document.querySelector('[data-theme-root]');const before={...el.dataset};document.querySelector('[data-theme-choice="VIOLET"]').click();return {before,after:{...el.dataset}};});
  for(const key of ['themeAccent','themePetalA','themeTransmission'])assert.equal(samples.after[key],samples.before[key]);assert.equal(samples.after.themeProgress,'0.00000');assert.equal(samples.after.themeTransitioning,'true');await page.waitForTimeout(80);await choose(page,'NEBULA');await page.waitForTimeout(500);assert.equal((await tstate(page)).themeTransitioning,'true');await settled(page,'NEBULA');assert.equal((await tstate(page)).themeAccent,'168bff');
 });
 await check('manual color survives all chapters and Auto resumes the current chapter in both directions',async()=>{
  await choose(page,'VIOLET');await settled(page,'VIOLET');for(const p of [.12,.35,.53,.75,.97]){await seek(page,p);assert.equal((await tstate(page)).theme,'VIOLET');assert.equal((await tstate(page)).themeMode,'manual');}
  await page.locator('[data-theme-auto]').click();await settled(page,'DUALITY');for(const [p,id] of [[.75,'NEBULA'],[.53,'AZURE'],[.35,'SILVER'],[.12,'CRIMSON']]){await seek(page,p);await settled(page,id);assert.equal((await tstate(page)).themeMode,'auto');}
 });
 await check('dual palettes reuse two materials and GPU resources stabilize after palette warmup',async()=>{
  await seek(page,.55);await choose(page,'DUALITY');await settled(page,'DUALITY');const first=await fstate(page);assert.notEqual(first.petalA,first.petalB);assert.ok(Number(first.petalGradient)>0);await choose(page,'NEBULA');await settled(page,'NEBULA');assert.equal((await fstate(page)).petalGradient,'1.00000');
  for(const id of THEME_IDS){await choose(page,id);await settled(page,id);}const before=await fstate(page);
  for(const id of ['AZURE','VIOLET','DUALITY','CRIMSON','SILVER','NEBULA']){await choose(page,id);await settled(page,id);}const after=await fstate(page);assert.equal(after.petalMaterialIds,first.petalMaterialIds);assert.equal(after.geometries,before.geometries);assert.equal(after.textures,before.textures);assert.ok(Number(after.programs)<=Number(before.programs)+2);console.log('GPU',JSON.stringify({before,after}));
 });
 await check('legacy material shortcuts use the same manual theme and keyboard selection works',async()=>{
  await page.locator('[data-finish="glass"]').click();await settled(page,'AZURE');assert.equal((await tstate(page)).themeMode,'manual');await page.locator('[data-theme-choice="VIOLET"]').focus();await page.keyboard.press('Enter');await settled(page,'VIOLET');assert.equal(await page.locator('[data-theme-choice][aria-pressed="true"]').count(),1);
 });
 await check('theme changes preserve the master timeline, reverse poses, core interaction and Replay',async()=>{
  await seek(page,.35);const pose=await fstate(page);await choose(page,'DUALITY');await settled(page,'DUALITY');await seek(page,.95);await seek(page,.35);const back=await fstate(page);for(const key of ['camera','scatter','sculpture','openness'])assert.equal(back[key],pose[key]);assert.equal(await page.locator('[data-cinematic-root]').getAttribute('data-cinema-trigger-count'),'1');await page.getByRole('button',{name:'Reset flower rotation',exact:true}).click();await page.mouse.click(Number(back.coreX),Number(back.coreY));await page.waitForFunction(()=>Number(document.querySelector('[data-flower-controls]').dataset.pulse)>.1);await seek(page,1);const replay=page.getByRole('button',{name:'REPLAY EXPERIENCE',exact:true});await replay.click();await page.waitForFunction(()=>Number(document.querySelector('[data-cinematic-root]').dataset.cinemaProgress)<.001);assert.equal((await tstate(page)).theme,'DUALITY');assert.equal((await tstate(page)).themeMode,'manual');await seek(page,1);await page.locator('.footer-top').click();await page.waitForFunction(()=>Number(document.querySelector('[data-cinematic-root]').dataset.cinemaProgress)<.001);
 });
 await check('refresh restores late chapter Auto without duplicating its timeline',async()=>{
  await seek(page,.94);await page.reload({waitUntil:'networkidle'});await page.locator(control).waitFor();await settled(page,'DUALITY');assert.equal((await tstate(page)).themeMode,'auto');assert.equal(await page.locator('[data-cinematic-root]').getAttribute('data-cinema-trigger-count'),'1');
 });
 const reduced=await browser.newContext({viewport:{width:1440,height:960},reducedMotion:'reduce'}),rp=await reduced.newPage();monitor(rp);
 await check('reduced-motion changes color immediately and still redraws the real materials',async()=>{
  await ready(rp);await seek(rp,.35);for(const id of ['VIOLET','AZURE','DUALITY','NEBULA']){await choose(rp,id);await settled(rp,id);assert.equal((await tstate(rp)).themeProgress,'1.00000');assert.equal((await fstate(rp)).petalA,THEMES[id].petalA.slice(1).toLowerCase());}await rp.locator('[data-theme-auto]').click();await settled(rp,'SILVER');
 });
 const mobile=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true}),mp=await mobile.newPage();monitor(mp);
 await check('mobile Color Lab expands and collapses without trapping native scrolling',async()=>{
  await ready(mp);assert.equal(await mp.locator('[data-color-lab]').getAttribute('data-open'),'false');await mp.locator('[data-color-lab-toggle]').tap();assert.equal(await mp.locator('[data-color-lab]').getAttribute('data-open'),'true');assert.equal(await mp.locator('[data-theme-choice]:visible').count(),6);await choose(mp,'NEBULA');await settled(mp,'NEBULA');assert.equal((await fstate(mp)).petalTransmission,'0.00000');assert.equal((await fstate(mp)).petals,'27');await mp.screenshot({path:'artifacts/round4-color-lab-mobile.png'});await mp.locator('[data-color-lab-toggle]').tap();await seek(mp,.75);await mp.screenshot({path:'artifacts/round4-nebula-mobile.png'});
  const session=await mobile.newCDPSession(mp),before=await mp.evaluate(()=>scrollY);await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:10,y:650}]});for(let i=1;i<=8;i++){await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:10,y:650-i*28}]});await mp.waitForTimeout(25);}await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await mp.waitForTimeout(500);assert.ok(await mp.evaluate(()=>scrollY)>before+100);await session.detach();assert.equal(await mp.evaluate(()=>document.documentElement.scrollWidth),390);
 });
 await check('mobile fallback keeps all six palettes, DPR cap and responsive controls',async()=>{
  await seek(mp,.35);await mp.locator('[data-color-lab-toggle]').tap();for(const id of THEME_IDS){await choose(mp,id);await settled(mp,id);const f=await fstate(mp);assert.equal(f.petalTransmission,'0.00000');assert.notEqual(f.petalA,'');assert.equal(await mp.locator('canvas').evaluate(el=>el.getContext('webgl2').getError()),0);}assert.ok(await mp.locator('canvas').evaluate(el=>el.width/el.getBoundingClientRect().width)<=1.16);for(const width of [320,430,390]){await mp.setViewportSize({width,height:844});await mp.waitForTimeout(250);assert.equal(await mp.evaluate(()=>document.documentElement.scrollWidth),width);}await mp.keyboard.press('Escape');assert.equal(await mp.locator('[data-color-lab]').getAttribute('data-open'),'false');await seek(mp,1);await mp.locator('.footer-top').tap();await mp.waitForFunction(()=>Number(document.querySelector('[data-cinematic-root]').dataset.cinemaProgress)<.001);
 });
 await check('Color Lab remains usable after WebGL context loss',async()=>{
  await page.locator('canvas').evaluate(el=>el.getContext('webgl2').getExtension('WEBGL_lose_context').loseContext());await page.getByText('BOTANICAL STUDY / OUTLINE MODE',{exact:true}).waitFor();await choose(page,'AZURE');await settled(page,'AZURE');assert.equal((await tstate(page)).themeAccent,'168bff');assert.equal(await page.locator('[data-chapter]').count(),5);
 });
 await check('no hydration, runtime or shader compilation errors',async()=>assert.deepEqual(errors,[]));
}finally{await browser.close();await writeFile('artifacts/theme-verification.json',JSON.stringify({base,results,errors},null,2));}
console.log('RESULT',`${results.filter(x=>x.passed).length}/${results.length}`);if(results.some(x=>!x.passed))process.exitCode=1;
