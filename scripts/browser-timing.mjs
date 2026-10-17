/* global document, scrollTo, requestAnimationFrame */

/** Measure native scrolling through the existing master, including theme changes. */
export async function measureScrollJourney(page, direction = 1) {
    const timing = await page.evaluate(direction => new Promise(resolve => {
        const root = document.querySelector('[data-cinematic-root]');
        const boundaries = root.dataset.cinemaBoundaries.split(',').map(Number);
        const intervals = [], slowFrames = [], chapters = new Set();
        let previous = 0, index = 0;
        function sample(now) {
            if (previous) {
                const delta = now - previous;
                intervals.push(delta);
                if (delta > 33.4 && slowFrames.length < 20) slowFrames.push({ ms: delta, progress: root.dataset.cinemaProgress, chapter: root.dataset.cinemaChapter });
            }
            previous = now;
            const progress = direction > 0 ? index / 1200 : 1 - index / 1200;
            const section = Math.min(4, Math.floor(progress * 5));
            const y = boundaries[section] + (boundaries[section + 1] - boundaries[section]) * (progress * 5 - section);
            scrollTo({ top: y, behavior: 'instant' });
            chapters.add(root.dataset.cinemaChapter);
            index += 1;
            if (index <= 1200) { requestAnimationFrame(sample); return; }
            const ordered = [...intervals].sort((a, b) => a - b);
            const seconds = intervals.reduce((a, b) => a + b, 0) / 1000;
            resolve({ direction, frames: intervals.length, seconds, fps: intervals.length / seconds,
                medianMs: ordered[Math.floor(ordered.length * .5)], p95Ms: ordered[Math.floor(ordered.length * .95)],
                maxMs: ordered.at(-1), over33ms: intervals.filter(n => n > 33.4).length, slowFrames, chapters: [...chapters] });
        }
        requestAnimationFrame(sample);
    }), direction);
    await page.waitForTimeout(550);
    return { ...timing, state: await page.locator('[data-flower-controls]').evaluate(el => ({ ...el.dataset })) };
}
