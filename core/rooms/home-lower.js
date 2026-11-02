/* The small navigation photographs have their own state: never insert a retry
   control inside a story link or let an image failure remove the reading path. */
(() => {
  'use strict';
  for (const holder of document.querySelectorAll('[data-home-photo]')) {
    const image = holder.querySelector('img');
    if (!image) continue;
    let timer = 0, observer = null;
    const settle = () => {
      clearTimeout(timer); observer?.disconnect();
      const loaded = Boolean(image.naturalWidth && image.naturalHeight);
      holder.dataset.image = loaded ? 'loaded' : 'failed';
      if (!loaded) {
        const label = holder.querySelector('.home-photo-fallback small');
        if (label) {
          label.innerHTML = '<span data-locale-variant="zh">原图未载</span><span data-locale-variant="en" lang="en">Unavailable</span>';
        }
      }
    };
    const start = () => {
      clearTimeout(timer);
      timer = setTimeout(() => { if (!image.naturalWidth) holder.dataset.image = 'slow'; }, 6500);
    };
    image.addEventListener('load', settle, { once: true });
    image.addEventListener('error', settle, { once: true });
    if (image.complete) settle();
    else if ('IntersectionObserver' in window) {
      observer = new IntersectionObserver(entries => {
        if (!entries.some(entry => entry.isIntersecting)) return;
        image.loading = 'eager'; start(); observer.disconnect();
      }, { rootMargin: '150px' });
      observer.observe(holder);
    } else start();
  }
})();
