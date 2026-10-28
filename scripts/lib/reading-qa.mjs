import { createOfflineQaContext } from './offline-qa.mjs';

// This runs against the built artifact with outbound requests blocked. It tests
// the approved reading behavior; live source availability is a separate gate.
export async function readingSystemInteractions({ browser, origin, issueId, manifest }) {
  const context = await createOfflineQaContext(browser, {
    viewport: { width: 390, height: 844 }, locale: 'zh-CN', reducedMotion: 'reduce',
  }, origin);
  const page = await context.newPage();
  const failures = [], facts = {}, errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const check = (condition, label) => { if (!condition) failures.push(label); };
  try {
    await page.goto(origin + '/', { waitUntil: 'domcontentloaded' });
    const modern = await page.locator('[data-reading-system="soft-v1"]').count();
    if (!modern) return { ok: true, applicable: false, detail: 'Isolated pre-reading-system fixture; shared reading system not emitted.' };
    await page.waitForSelector('[data-open-settings]');
    facts.responsive = [];
    for (const [width, height] of [[320,568],[390,844],[430,932],[768,1024],[844,390],[1440,900]]) {
      await page.setViewportSize({ width, height });
      const layout = await page.evaluate(() => ({
        overflow: document.documentElement.scrollWidth - innerWidth,
        buttons: [...document.querySelectorAll('[data-home-category]')].map(button => ({
          label: button.textContent.trim(), nowrap: getComputedStyle(button).whiteSpace,
          shrink: getComputedStyle(button).flexShrink, height: button.getBoundingClientRect().height,
        })),
      }));
      facts.responsive.push({ width, height, ...layout });
      check(layout.overflow <= 0, `home overflow ${width}`);
      check(layout.buttons.length === 5 && layout.buttons.every(button => button.nowrap === 'nowrap' && button.shrink === '0' && button.height >= 43.5), `horizontal categories ${width}`);
    }
    await page.setViewportSize({ width: 390, height: 844 });
    const quote = page.locator('.daily-quote').first();
    check(await quote.count() === 1, 'one daily quotation');
    if (await quote.count()) {
      facts.quote = await quote.evaluate(element => ({ id: element.dataset.quoteId, source: element.querySelector('[data-quote-source]')?.href, text: element.querySelector('[data-quote-original]')?.textContent?.trim() }));
      check(Boolean(facts.quote.id && facts.quote.text && /^https:\/\//.test(facts.quote.source || '')), 'quotation attribution/source');
    }
    const floating = page.locator('.floating-return');
    if (await floating.count()) {
      await page.evaluate(() => scrollTo(0,0));
      await page.waitForFunction(() => document.querySelector('.floating-return').getAttribute('aria-hidden') === 'true');
      await page.evaluate(() => scrollTo(0, Math.min(1200, document.documentElement.scrollHeight-innerHeight)));
      await page.waitForFunction(() => document.querySelector('.floating-return').getAttribute('aria-hidden') === 'false');
      await floating.click();
      await page.waitForFunction(() => document.querySelector('.floating-return').getAttribute('aria-hidden') === 'true');
      facts.floating_directory = 'hidden at top; appears below directory; hides on return';
    }
    const firstCard = page.locator('.category-board .story-card').first();
    const category = await firstCard.getAttribute('data-story-category');
    if (category) await page.locator(`[data-home-category="${category}"]`).click();
    await firstCard.locator('a.story-open').first().click();
    await page.waitForSelector('#article-body');
    const trigger = page.locator('[data-open-settings]').first(), dialog = page.locator('#reading-settings');
    const toolbar = page.locator('.reader-toolbar, .tool-row').first();
    check(await toolbar.locator('[data-language]').count() === 0, 'language only inside reading settings');
    check(await toolbar.locator('a[href*="#article-sources"],a[href*="#sources"]').count() === 0, 'sources only at article end');
    await trigger.click();
    check(await dialog.isVisible(), 'reading settings opens');
    check(await dialog.locator('fieldset,[data-restore],#reset-preferences').count() === 0, 'no redundant settings panels/reset');
    const font = dialog.locator('[data-reader-font]'), output = dialog.locator('[data-reader-font-value]');
    facts.font = [];
    for (const [key, value] of [['Home',17],['End',25]]) {
      await font.focus(); await page.keyboard.press(key);
      const sizes = await page.evaluate(() => ({
        value: document.querySelector('[data-reader-font-value]').textContent.trim(),
        output: getComputedStyle(document.querySelector('[data-reader-font-value]')).fontSize,
        zh: getComputedStyle(document.querySelector('#chinese-reading p')).fontSize,
        en: document.querySelector('#english-reading p') ? getComputedStyle(document.querySelector('#english-reading p')).fontSize : null,
      }));
      facts.font.push(sizes);
      check(sizes.value === `${value}px` && sizes.output === `${value}px` && sizes.zh === `${value}px` && (!sizes.en || sizes.en === `${value}px`), `live ${value}px number and body`);
    }
    await dialog.locator('[data-language="en"]').click();
    check(await page.locator('#chinese-reading').isHidden(), 'Chinese hidden when English selected');
    check(await page.locator('#english-reading').isVisible(), 'English selected');
    facts.styles = []; facts.materials = [];
    await dialog.locator('[data-pref-surface="glass"]').click();
    for (const style of ['field','coral','analog']) {
      await dialog.locator(`[data-pref-style="${style}"]`).click();
      check(await page.locator('html').getAttribute('data-style') === style, `retained style ${style}`);
      for (const theme of ['light','dark','warm']) {
        await dialog.locator(`[data-pref-theme="${theme}"]`).click();
        check(await page.locator('html').getAttribute('data-theme') === theme, `${style} theme ${theme}`);
        facts.styles.push(await page.evaluate(() => ({
          style: document.documentElement.dataset.style, theme: document.documentElement.dataset.theme,
          background: getComputedStyle(document.documentElement).backgroundColor,
          accent: getComputedStyle(document.documentElement).getPropertyValue('--ct-accent').trim(),
          texture: getComputedStyle(document.body, '::before').backgroundImage,
        })));
        const material = await page.evaluate(() => {
          const root = document.documentElement, tool = document.querySelector('.reader-toolbar .tool-inner');
          const css = getComputedStyle(tool), screen = document.querySelector('.reading-tv-surface');
          const screenCss = screen ? getComputedStyle(screen, '::before') : null;
          const reflection = screen ? getComputedStyle(screen, '::after') : null;
          return { style: root.dataset.style, theme: root.dataset.theme,
            backdrop: css.backdropFilter || css.webkitBackdropFilter, highlight: css.backgroundImage, shadow: css.boxShadow,
            edge: css.borderTopWidth, contentBackdrop: getComputedStyle(document.querySelector('#article-body')).backdropFilter,
            screenTexture: screenCss?.backgroundImage, screenOpacity: screenCss?.opacity, screenReflection: reflection?.backgroundImage,
            page: getComputedStyle(root).getPropertyValue('--ct-page').trim(),
            imageFilter: getComputedStyle(document.querySelector('.reader-hero img.official')).filter,
            noiseRunning: window.CTReadingSystem.material().noiseRunning,
          };
        });
        facts.materials.push(material);
        check(material.backdrop.includes('24px') && material.highlight.includes('linear-gradient') && material.shadow !== 'none' && material.edge === '1px', `glass material ${style}/${theme}`);
        check(material.contentBackdrop === 'none' && material.imageFilter === 'none', `unfiltered content ${style}/${theme}`);
        if (style === 'analog') {
          check(material.screenTexture.includes('tv-grain.svg') && material.screenTexture.includes('repeating-linear-gradient') && material.screenOpacity === '0.5' && material.screenReflection.includes('radial-gradient'), `original television material ${theme}`);
          check(!material.noiseRunning, `television reduced-motion ${theme}`);
          if (theme === 'dark') check(material.page === '#1b1917', 'original television warm black palette');
        }
      }
    }
    const styleLooks = facts.styles.filter(item => item.theme === 'light').map(item => [item.background,item.accent,item.texture].join('|'));
    check(new Set(styleLooks).size === 3, 'three retained styles have distinct visual treatments');
    await dialog.locator('[data-pref-surface="solid"]').click();
    check(await toolbar.locator('.tool-inner').evaluate(element => getComputedStyle(element).backdropFilter) === 'none', 'solid material has no backdrop');
    await dialog.locator('[data-pref-surface="glass"]').click();
    const cdp = await context.newCDPSession(page);
    await cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-transparency', value: 'reduce' }] });
    check(await toolbar.locator('.tool-inner').evaluate(element => getComputedStyle(element).backdropFilter) === 'none', 'reduced-transparency solid fallback');
    await cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
    await cdp.detach();
    const last = dialog.locator('input[type="checkbox"]').last();
    await last.focus(); await page.keyboard.press('Tab');
    check(await dialog.evaluate(element => element.contains(document.activeElement)), 'modal keyboard focus contained');
    await page.keyboard.press('Escape');
    check(await dialog.isHidden(), 'Escape closes settings');
    check(await trigger.evaluate(element => document.activeElement === element), 'settings focus returns');
    await page.evaluate(() => scrollTo(0,800));
    await page.waitForFunction(() => Math.abs(document.querySelector('.reader-toolbar').getBoundingClientRect().top - parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--tv-rim-top'))) < 1);
    facts.television_toolbar = await toolbar.evaluate(header => ({
      top: header.getBoundingClientRect().top,
      targets: [...header.querySelectorAll('[data-ct-control]')].map(control => {
        const rect = control.getBoundingClientRect();
        return { name: control.getAttribute('aria-label'), hit: control.contains(document.elementFromPoint(rect.x+rect.width/2, rect.y+rect.height/2)) };
      }),
    }));
    check(facts.television_toolbar.targets.every(target => target.hit), 'television frame does not obstruct toolbar controls');
    const zoom = page.locator('[data-zoom-image]').first();
    if (await zoom.count()) {
      await zoom.click();
      check(await page.locator('#image-dialog').isVisible(), 'image zoom opens');
      const position = await page.evaluate(() => scrollY);
      await page.keyboard.press('Escape');
      check(await page.locator('#image-dialog').isHidden(), 'image zoom closes');
      check(await zoom.evaluate(element => document.activeElement === element), 'image focus returns');
      facts.zoom = { opened: true, closed: true, position, returnedPosition: await page.evaluate(() => scrollY) };
      check(Math.abs(facts.zoom.returnedPosition-position) <= 2, 'image closes at same reading position');
    }
    await page.locator('a[data-reading-return]').first().click();
    await page.waitForSelector('html.reading-ready');
    facts.home_return = { url: page.url(), category, selected: await page.locator('[data-home-category][aria-pressed="true"]').getAttribute('data-home-category') };
    check(new URL(page.url()).pathname === '/', 'home entry returns home');
    if (category) check(await page.locator(`[data-home-category="${category}"]`).getAttribute('aria-pressed') === 'true', 'home filter restored');
    await page.goto(origin + '/archive/?view=articles&category=city');
    const archiveLink = page.locator('[data-catalog="articles"] .story-card:visible a.story-open').first();
    if (await archiveLink.count()) {
      const saved = new URL(page.url());
      await archiveLink.click();
      await page.locator('a[data-reading-return]').first().click();
      const returned = new URL(page.url());
      check(returned.pathname.endsWith('/archive/') && ['view','category','q','month','page'].every(key => returned.searchParams.get(key) === saved.searchParams.get(key)), 'archive filter/route restored');
    }
    check(errors.length === 0, 'reading JavaScript exceptions');
    return { ok: failures.length === 0, applicable: true, failures, facts, page_errors: errors };
  } catch (error) {
    return { ok: false, applicable: true, failures: [...failures,error.message], facts, page_errors: errors };
  } finally { await context.close(); }
}
