/* global window, document, scrollTo, HTMLCanvasElement, WebGL2RenderingContext, performance */
import process from 'node:process';
import console from 'node:console';
import { Buffer } from 'node:buffer';
import { setTimeout } from 'node:timers';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { writeFile, readFile, mkdir } from 'node:fs/promises';
await mkdir('artifacts', { recursive: true });
const { chromium } = await import(process.argv[2] ? pathToFileURL(process.argv[2]).href : 'playwright');
const browser = await chromium.launch({ executablePath: process.argv[3] || undefined, headless: true, args: ['--disable-gpu-sandbox', '--enable-webgl', '--ignore-gpu-blocklist'] });
const base = process.argv[4] || 'http://127.0.0.1:3016', results = [], errors = [], measurements = [];
const flower = '[data-flower-controls]', dock = '[data-audio-dock]';
const fs = p => p.locator(flower).evaluate(el => ({ ...el.dataset }));
async function choose(p, id) { const b = p.locator(`[data-theme-choice="${id}"]`); if (!await b.isVisible())
    await p.locator('[data-color-lab] button[aria-expanded]').click(); await b.click(); }
const as = p => p.locator(dock).evaluate(el => ({ ...el.dataset }));
function monitor(p) {
    p.on('pageerror', e => errors.push(e.stack));
    p.on('console', m => {
        const expectedMissingScore = m.text().includes('404 (Not Found)') && m.location().url.includes('/audio/bloom-study-v1.wav');
        if (m.type() === 'error' && !expectedMissingScore) errors.push(m.text());
    });
}
async function check(name, fn) { try {
    await fn();
    results.push({ name, passed: true });
    console.log('PASS', name);
}
catch (e) {
    results.push({ name, passed: false, error: e.message });
    console.log('FAIL', name, e.message);
} }
async function ready(p) { assert.equal((await p.goto(base, { waitUntil: 'networkidle' })).status(), 200); await p.locator(flower).waitFor(); await p.waitForFunction(() => document.querySelector('[data-scene-status]')?.dataset.sceneStatus === 'ready'); }
async function seek(p, n) { await p.evaluate(n => { const b = document.querySelector('[data-cinematic-root]').dataset.cinemaBoundaries.split(',').map(Number), i = Math.min(4, Math.floor(n * 5)); scrollTo({ top: b[i] + (b[i + 1] - b[i]) * (n * 5 - i), behavior: 'instant' }); }, n); await p.waitForFunction(n => Math.abs(Number(document.querySelector('[data-cinematic-root]').dataset.cinemaProgress) - n) < .0002, n); await p.waitForTimeout(300); }
async function status(p, s) { await p.waitForFunction(s => document.querySelector('[data-audio-dock]')?.dataset.audioStatus === s, s); }
async function rest(p) { await p.waitForFunction(() => ['Low', 'Mid', 'High'].every(k => Number(document.querySelector('[data-audio-dock]').dataset['audio' + k]) < .0001)); }
async function instrument(p) { await p.addInitScript(() => { window.__audioContexts = []; const Native = window.AudioContext; if (Native)
    window.AudioContext = class extends Native {
        constructor(...a) { super(...a); window.__audioContexts.push(this); }
    }; }); }
const desktop = await browser.newContext({ viewport: { width: 1440, height: 960 } }), p = await desktop.newPage();
monitor(p);
await instrument(p);
let wavRequests = 0;
p.on('request', r => { if (r.url().endsWith('/audio/bloom-study-v1.wav'))
    wavRequests++; });
try {
    await check('audio starts only after a gesture; HDR depth/bloom renders without GL errors', async () => { await ready(p); await p.waitForTimeout(600); assert.equal(wavRequests, 0); assert.equal(await p.evaluate(() => window.__audioContexts.length), 0); assert.equal((await as(p)).audioStatus, 'off'); const f = await fs(p); assert.equal(f.effectsFailed, 'false'); assert.equal(f.effects, 'true'); assert.equal(await p.locator('canvas').evaluate(c => c.getContext('webgl2').getError()), 0); await p.screenshot({ path: 'artifacts/round5-awakening-desktop.png' }); });
    await check('real local soundtrack drives all three analysed bands and the retained flower', async () => { await seek(p, .35); await p.locator('[data-audio-toggle]').click(); await status(p, 'playing'); await p.waitForFunction(() => ['Low', 'Mid', 'High'].every(k => Number(document.querySelector('[data-audio-dock]').dataset['audio' + k]) > .001)); await p.waitForFunction(() => Number(document.querySelector('[data-flower-controls]').dataset.audioLow) > .001); assert.equal(wavRequests, 1); assert.equal(await p.evaluate(() => window.__audioContexts.length), 1); const f = await fs(p); assert.ok(Number(f.audioEnvelope) > 0); measurements.push({ audio: await as(p), flower: f }); await p.screenshot({ path: 'artifacts/round5-genesis-desktop.png' }); });
    await check('mute decays to rest; pause/resume retains one context and one fetch', async () => { await p.locator('[data-audio-details]').click(); await p.getByRole('slider', { name: 'Audio volume', exact: true }).fill('0'); await rest(p); await p.getByRole('slider', { name: 'Audio volume', exact: true }).fill('55'); await p.waitForFunction(() => Number(document.querySelector('[data-audio-dock]').dataset.audioLow) > .001); await p.locator('[data-audio-toggle]').click(); await status(p, 'paused'); await rest(p); assert.equal(await p.evaluate(() => window.__audioContexts[0].state), 'suspended'); await p.locator('[data-audio-toggle]').click(); await status(p, 'playing'); assert.equal(wavRequests, 1); assert.equal(await p.evaluate(() => window.__audioContexts.length), 1); });
    await check('local file playback and corrupt decode recovery remain usable', async () => { await p.locator('[data-audio-file]').setInputFiles('public/audio/bloom-study-v1.wav'); await status(p, 'playing'); assert.ok(await p.getByText('bloom-study-v1', { exact: true }).isVisible()); await p.locator('[data-audio-file]').setInputFiles({ name: 'broken.wav', mimeType: 'audio/wav', buffer: Buffer.from('invalid waveform') }); await status(p, 'error'); assert.ok(await p.locator('[data-audio-retry]').isVisible()); await p.locator('[data-audio-retry]').click(); await status(p, 'playing'); await p.locator('[data-audio-toggle]').click(); await status(p, 'paused'); await rest(p); await p.keyboard.press('Escape'); assert.equal(await p.locator('[data-audio-details]').getAttribute('aria-expanded'), 'false'); });
    await check('ECO releases post processing and glass transmission without losing navigation', async () => { await p.getByRole('button', { name: 'Reduce rendering quality', exact: true }).click(); await p.waitForFunction(() => document.querySelector('[data-flower-controls]').dataset.renderTier === 'economy'); await choose(p, 'AZURE'); await p.waitForTimeout(1500); const f = await fs(p); assert.equal(f.effects, 'false'); assert.equal(f.petals, '27'); assert.equal(Number(f.petalTransmission), 0); assert.ok(Number(f.particleCount) <= 10); const dims = await p.locator('canvas').evaluate(c => ({ width: c.width, css: c.clientWidth })); assert.ok(dims.width / dims.css <= 1.01); await seek(p, .75); assert.equal(await p.locator('[data-cinematic-root]').getAttribute('data-cinema-trigger-count'), '1'); await p.getByRole('button', { name: 'Reduce rendering quality', exact: true }).click(); });
    await check('sound, manual theme, reverse scrolling and Replay coexist', async () => { await p.locator('[data-audio-toggle]').click(); await status(p, 'playing'); await choose(p, 'DUALITY'); await p.waitForTimeout(1400); for (const n of [.35, .94, .53, .75, 1])
        await seek(p, n); assert.equal(await p.locator('[data-theme-root]').getAttribute('data-theme'), 'DUALITY'); await p.getByRole('button', { name: 'REPLAY EXPERIENCE', exact: true }).click(); await p.waitForFunction(() => Number(document.querySelector('[data-cinematic-root]').dataset.cinemaProgress) < .001); assert.equal((await as(p)).audioStatus, 'playing'); await p.locator('[data-audio-toggle]').click(); await rest(p); });
    const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }), mp = await mobile.newPage();
    monitor(mp);
    await check('mobile, Android-size, narrow phone and tablet layouts remain within viewport', async () => { await ready(mp); for (const [width, height] of [[390, 844], [320, 844], [412, 915], [430, 932], [820, 1180], [1024, 768]]) {
        await mp.setViewportSize({ width, height });
        await mp.waitForTimeout(350);
        await seek(mp, .35);
        assert.equal(await mp.evaluate(() => document.documentElement.scrollWidth), width);
        const f = await fs(mp);
        assert.equal(f.effects, 'false');
        assert.equal(f.petals, '27');
        assert.equal(f.petalTransmission, '0.00000');
        const boxes = await mp.locator('[data-audio-toggle],[data-audio-details],[data-color-lab] > button').evaluateAll(nodes => nodes.filter(n => n.getBoundingClientRect().width).map(n => ({ label: n.getAttribute('aria-label'), x: n.getBoundingClientRect().x, y: n.getBoundingClientRect().y, width: n.getBoundingClientRect().width, height: n.getBoundingClientRect().height })));
        for (const b of boxes) {
            assert.ok(b.width >= 43.9 && b.height >= 43.9, JSON.stringify(b));
            assert.ok(b.x >= 0 && b.x + b.width <= width + .1, JSON.stringify(b));
        }
        measurements.push({ viewport: [width, height], f, boxes });
        await mp.screenshot({ path: `artifacts/round5-${width}-layout.png` });
    } });
    await check('phone drawers have distinct reachable controls and Escape restores focus', async () => { await mp.setViewportSize({ width: 390, height: 844 }); await mp.waitForTimeout(250); await mp.locator('[data-audio-details]').click(); assert.equal(await mp.locator('[data-color-lab]').isVisible(), false); await mp.locator('[data-audio-toggle]').click(); await status(mp, 'playing'); await mp.keyboard.press('Escape'); assert.equal(await mp.locator('[data-color-lab]').isVisible(), true); assert.equal(await mp.locator('[data-audio-details]').evaluate(el => el === document.activeElement), true); await mp.locator('[data-audio-toggle]').click(); await mp.locator('[data-color-lab] button[aria-expanded]').click(); assert.equal((await mp.locator('[data-audio-toggle]').boundingBox()).width, 44); await mp.keyboard.press('Escape'); await seek(mp, 1); await mp.screenshot({ path: 'artifacts/round5-rebirth-mobile.png' }); const replay = await mp.getByRole('button', { name: 'REPLAY EXPERIENCE', exact: true }).boundingBox(); assert.equal(await mp.locator(flower).isVisible(), false); assert.ok(replay.y > 80 && replay.y + replay.height < 700); });
    const reduced = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' }), rp = await reduced.newPage();
    monitor(rp);
    await check('reduced motion can listen while cinematic and reactive motion stay simplified', async () => { await ready(rp); await seek(rp, .35); const first = await fs(rp); assert.equal(first.effects, 'false'); await rp.locator('[data-audio-toggle]').click(); await status(rp, 'playing'); await rp.waitForTimeout(900); await seek(rp, .75); const next = await fs(rp); assert.equal(Number(next.audioLow), 0); assert.equal(Number(next.audioMid), 0); assert.equal(next.camera, first.camera); await rp.locator('[data-audio-toggle]').click(); });
    const broken = await browser.newContext({ viewport: { width: 1280, height: 900 } }), bp = await broken.newPage();
    monitor(bp);
    await instrument(bp);
    await bp.route('**/audio/bloom-study-v1.wav', route => route.fulfill({ status: 404, body: 'missing' }));
    await check('missing soundtrack produces retry state while all chapters still work', async () => { await ready(bp); await bp.locator('[data-audio-toggle]').click(); await status(bp, 'error'); assert.equal(await bp.locator('[data-chapter]').count(), 5); await seek(bp, .94); assert.equal(await bp.locator('[data-cinematic-root]').getAttribute('data-cinema-chapter'), 'rebirth'); await bp.unroute('**/audio/bloom-study-v1.wav'); await bp.locator('[data-audio-toggle]').click(); await status(bp, 'playing'); await bp.locator('[data-audio-toggle]').click(); });
    const slow = await browser.newContext({ viewport: { width: 1000, height: 800 } }), sp = await slow.newPage();
    monitor(sp);
    await sp.route('**/audio/bloom-study-v1.wav', async (route) => { await new Promise(r => setTimeout(r, 800)); try {
        await route.fulfill({ status: 200, contentType: 'audio/wav', body: await readFile('public/audio/bloom-study-v1.wav') });
    }
    catch { /* A cancelled request may already be gone. */ } });
    await check('cancel during slow soundtrack loading never causes late autoplay', async () => { await ready(sp); await sp.locator('[data-audio-toggle]').click(); await status(sp, 'loading'); await sp.locator('[data-audio-toggle]').click(); await status(sp, 'paused'); await sp.waitForTimeout(1200); assert.equal((await as(sp)).audioStatus, 'paused'); await rest(sp); });
    const unsupported = await browser.newContext({ viewport: { width: 1000, height: 800 } }), up = await unsupported.newPage();
    monitor(up);
    await up.addInitScript(() => { Object.defineProperty(window, 'AudioContext', { value: undefined, configurable: true }); Object.defineProperty(window, 'webkitAudioContext', { value: undefined, configurable: true }); const get = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function (type, ...args) { return type === 'webgl2' || type === 'webgl' ? null : get.call(this, type, ...args); }; });
    await check('no WebGL and no Web Audio retains static fallback and five native chapters', async () => { await up.goto(base, { waitUntil: 'networkidle' }); await up.getByText('BOTANICAL STUDY / OUTLINE MODE', { exact: true }).waitFor(); await up.locator('[data-audio-toggle]').click(); await status(up, 'unavailable'); assert.equal(await up.locator('[data-audio-toggle]').isDisabled(), true); assert.equal(await up.locator('[data-chapter]').count(), 5); assert.equal(await up.locator('canvas').count(), 0); await seek(up, 1); await up.getByRole('button', { name: 'REPLAY EXPERIENCE', exact: true }).click(); });
    const postFailure = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const fp = await postFailure.newPage();
    monitor(fp);
    await fp.addInitScript(() => {
        const original = WebGL2RenderingContext.prototype.shaderSource;
        WebGL2RenderingContext.prototype.shaderSource = function (shader, source) {
            // Only the optional compositor fails; real geometry keeps its shaders.
            return original.call(this, shader, source.includes('uniform float uFocus;') ? `${source}\nBLOOM_TEST_COMPOSITOR_FAILURE` : source);
        };
    });
    await check('optional post shader failure returns to the original scene and all chapters', async () => {
        await ready(fp);
        await fp.waitForFunction(() => document.querySelector('[data-flower-controls]').dataset.effectsFailed === 'true');
        assert.equal((await fs(fp)).effects, 'false');
        assert.equal((await fs(fp)).renderTier, 'balanced');
        for (const n of [.12, .35, .53, .75, .97]) await seek(fp, n);
        assert.equal(await fp.locator('canvas').evaluate(c => c.getContext('webgl2').getError()), 0);
        assert.ok(Number((await fs(fp)).drawCalls) > 20);
        await fp.screenshot({ path: 'artifacts/round5-post-fallback.png' });
        await postFailure.close();
    });
    const slowFrames = await browser.newContext({ viewport: { width: 1000, height: 800 } });
    const lp = await slowFrames.newPage();
    monitor(lp);
    await lp.addInitScript(() => {
        const original = window.requestAnimationFrame.bind(window);
        window.requestAnimationFrame = callback => original(() => { setTimeout(() => callback(performance.now()), 40); });
    });
    await check('sustained slow frames automatically enter economy with usable navigation', async () => {
        await ready(lp);
        await lp.waitForFunction(() => document.querySelector('[data-flower-controls]').dataset.renderTier === 'economy', null, { timeout: 20000 });
        const frame = await fs(lp);
        assert.equal(frame.effects, 'false');
        assert.equal(frame.petals, '27');
        await seek(lp, .75);
        assert.equal(await lp.locator('[data-cinematic-root]').getAttribute('data-cinema-chapter'), 'metamorphosis');
        await slowFrames.close();
    });
    await check('no hydration, uncaught runtime or unexpected shader errors', async () => assert.deepEqual(errors, []));
}
finally {
    await browser.close();
    await writeFile('artifacts/production-verification.json', JSON.stringify({ base, results, errors, measurements }, null, 2));
}
console.log('RESULT', `${results.filter(r => r.passed).length}/${results.length}`);
if (results.some(r => !r.passed))
    process.exitCode = 1;
