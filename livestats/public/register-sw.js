/* The production build generates sw.js. Never cache Metro's development app. */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const response = await fetch('/sw.js', { cache: 'no-store' });
      if (!response.ok || !response.headers.get('content-type')?.includes('javascript')) return;
      await navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' });
      // A new release waits until all app windows close. No automatic reload
      // or skipWaiting: either would risk interrupting live scoring.
    } catch {
      // An installed worker keeps working offline; registration can retry
      // the next time this app opens with a connection.
    }
  });
}
