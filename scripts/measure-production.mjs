/* global document, scrollTo, requestAnimationFrame */
import process from 'node:process';
import console from 'node:console';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { writeFile, mkdir } from 'node:fs/promises';
import { measureScrollJourney } from './browser-timing.mjs';
await mkdir('artifacts', { recursive: true });
const { chromium } = await import(process.argv[2] ? pathToFileURL(process.argv[2]).href : 'playwright');
const browser = await chromium.launch({ executablePath: process.argv[3] || undefined, headless: true, args: ['--disable-gpu-sandbox', '--enable-webgl', '--ignore-gpu-blocklist', '--enable-precise-memory-info'] });
const base = process.argv[4] || 'http://127.0.0.1:3016', samples = [], journeys = [], errors = [];
async function ready(p) { await p.goto(base, { waitUntil: 'networkidle' }); await p.locator('[data-flower-controls]').waitFor(); await p.waitForFunction(() => document.querySelector('[data-scene-status]').dataset.sceneStatus === 'ready'); }
async function seek(p, n) { await p.evaluate(n => { const b = document.querySelector('[data-cinematic-root]').dataset.cinemaBoundaries.split(',').map(Number), i = Math.min(4, Math.floor(n * 5)); scrollTo({ top: b[i] + (b[i + 1] - b[i]) * (n * 5 - i), behavior: 'instant' }); }, n); await p.waitForFunction(n => Math.abs(Number(document.querySelector('[data-cinematic-root]').dataset.cinemaProgress) - n) < .0002, n); await p.waitForTimeout(350); }
const state = p => p.locator('[data-flower-controls]').evaluate(el => ({ ...el.dataset }));
async function choose(p, id) { const b = p.locator(`[data-theme-choice="${id}"]`); if (!await b.isVisible())
    await p.locator('[data-color-lab] button[aria-expanded]').click(); await b.click(); await p.waitForFunction(id => { const e = document.querySelector('[data-theme-root]'); return e.dataset.theme === id && e.dataset.themeTransitioning === 'false'; }, id); await p.waitForTimeout(150); }
async function measure(p, label) { const timing = await p.evaluate(() => new Promise(resolve => { const intervals = []; let previous = 0; function frame(now) { if (previous)
    intervals.push(now - previous); previous = now; if (intervals.length < 240) {
    requestAnimationFrame(frame);
    return;
} const sorted = [...intervals].sort((a, b) => a - b), sum = intervals.reduce((a, b) => a + b, 0); resolve({ frames: intervals.length, seconds: sum / 1000, medianMs: sorted[120], p95Ms: sorted[Math.floor(sorted.length * .95)], fps: intervals.length * 1000 / sum, over33ms: intervals.filter(n => n > 33.4).length }); } requestAnimationFrame(frame); })); samples.push({ label, ...timing, state: await state(p) }); console.log('PERF', JSON.stringify(samples.at(-1))); }
let memory;
try {
    const c = await browser.newContext({ viewport: { width: 1440, height: 960 }, deviceScaleFactor: 1.5 }), p = await c.newPage();
    p.on('pageerror', e => errors.push(e.stack));
    p.on('console', m => { if (m.type() === 'error')
        errors.push(m.text()); });
    await ready(p);
    await seek(p, .35);
    await p.locator('[data-audio-toggle]').click();
    await p.waitForFunction(() => document.querySelector('[data-audio-dock]').dataset.audioStatus === 'playing');
    const gpu = await p.locator('canvas').evaluate(c => { const g = c.getContext('webgl2'), ext = g.getExtension('WEBGL_debug_renderer_info'); return { renderer: ext ? g.getParameter(ext.UNMASKED_RENDERER_WEBGL) : g.getParameter(g.RENDERER), width: c.width, height: c.height, contextAttributes: g.getContextAttributes() }; });
    for (const direction of [1, -1]) {
        const journey = await measureScrollJourney(p, direction);
        assert.equal(journey.chapters.length, 5);
        journeys.push(journey);
        console.log('SCROLL', JSON.stringify(journey));
    }
    for (const [n, id] of [[.35, 'SILVER'], [.53, 'AZURE'], [.75, 'NEBULA'], [.97, 'DUALITY']]) {
        await seek(p, n);
        await choose(p, id);
        await measure(p, `desktop1440x960@1.5/${id}/audio`);
    }
    const session = await c.newCDPSession(p);
    await session.send('Performance.enable');
    const snapshot = async () => { await session.send('HeapProfiler.collectGarbage'); await p.waitForTimeout(250); const metrics = (await session.send('Performance.getMetrics')).metrics; return { flower: await state(p), heapBytes: metrics.find(x => x.name === 'JSHeapUsedSize')?.value, nodes: metrics.find(x => x.name === 'Nodes')?.value }; };
    // Compile and draw both quality families before taking the reference sample.
    for (const id of ['CRIMSON', 'AZURE', 'VIOLET', 'SILVER', 'DUALITY', 'NEBULA'])
        await choose(p, id);
    await p.getByRole('button', { name: 'Reduce rendering quality', exact: true }).click();
    await p.waitForTimeout(500);
    await p.getByRole('button', { name: 'Reduce rendering quality', exact: true }).click();
    await p.waitForTimeout(800);
    await choose(p, 'NEBULA');
    await seek(p, .75);
    const before = await snapshot(), rounds = [];
    for (let i = 0; i < 4; i++) {
        for (const [n, id] of [[.35, 'SILVER'], [.53, 'AZURE'], [.75, 'NEBULA'], [.97, 'DUALITY']]) {
            await seek(p, n);
            await choose(p, id);
        }
        await seek(p, 1);
        await p.getByRole('button', { name: 'REPLAY EXPERIENCE', exact: true }).click();
        await p.waitForFunction(() => Number(document.querySelector('[data-cinematic-root]').dataset.cinemaProgress) < .001);
        await p.locator('[data-audio-toggle]').click();
        await p.waitForTimeout(150);
        await p.locator('[data-audio-toggle]').click();
        await p.getByRole('button', { name: 'Reduce rendering quality', exact: true }).click();
        await p.waitForTimeout(450);
        await p.getByRole('button', { name: 'Reduce rendering quality', exact: true }).click();
        await p.waitForTimeout(700);
        await choose(p, 'NEBULA');
        await seek(p, .75);
        rounds.push(await snapshot());
        console.log('STRESS', i + 1, JSON.stringify(rounds.at(-1)));
    }
    const after = rounds.at(-1);
    for (const key of ['geometries', 'textures', 'programs'])
        assert.ok(Number(after.flower[key]) <= Number(before.flower[key]) + 2, `${key} grew`);
    assert.ok(after.heapBytes < before.heapBytes + 8 * 1024 * 1024, 'persistent heap increase exceeds 8 MiB');
    memory = { gpu, before, rounds, after };
    await c.close();
    for (const [width, height] of [[390, 844], [820, 1180]]) {
        const mc = await browser.newContext({ viewport: { width, height }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }), mp = await mc.newPage();
        mp.on('pageerror', e => errors.push(e.stack));
        await ready(mp);
        await seek(mp, .53);
        await mp.locator('[data-color-lab] button[aria-expanded]').click().catch(() => { });
        await choose(mp, 'AZURE');
        await mp.keyboard.press('Escape');
        await mp.locator('[data-audio-toggle]').click();
        await mp.waitForFunction(() => document.querySelector('[data-audio-dock]').dataset.audioStatus === 'playing');
        await measure(mp, `touch-emulation${width}x${height}@2/AZURE/audio`);
        await mc.close();
    }
    assert.deepEqual(errors, []);
}
finally {
    await browser.close();
    await writeFile('artifacts/production-performance.json', JSON.stringify({ base, samples, journeys, memory, errors }, null, 2));
}
console.log('PASS production timing and four-round GPU/heap stress');
