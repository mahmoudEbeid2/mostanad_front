// Page images for the "choose pages" screen: at most `limit` requests at a time,
// and each url fetched once, however often a component asks for it.

/** fetchBlob: url → Promise<Blob>. → { get(url, { first }) → Promise<object url>, destroy() } */
export function createImageLoader(fetchBlob, limit = 6) {
  const cache = new Map();
  const made = new Set();
  const waiting = [];
  let active = 0;

  const next = () => {
    while (active < limit && waiting.length) {
      const job = waiting.shift();
      active++;
      fetchBlob(job.url)
        .then((blob) => {
          const objectUrl = URL.createObjectURL(blob);
          made.add(objectUrl);
          job.resolve(objectUrl);
        }, job.reject)
        .finally(() => {
          active--;
          next();
        });
    }
  };

  return {
    /** first: ahead of the queue (the page in the preview) */
    get(url, { first = false } = {}) {
      if (!cache.has(url)) {
        const image = new Promise((resolve, reject) => {
          const job = { url, resolve, reject };
          if (first) waiting.unshift(job);
          else waiting.push(job);
          next();
        });
        cache.set(url, image);
        image.catch(() => cache.delete(url)); // a failed one may be asked for again
      }
      return cache.get(url);
    },
    destroy() {
      waiting.length = 0;
      for (const objectUrl of made) URL.revokeObjectURL(objectUrl);
      made.clear();
      cache.clear();
    },
  };
}
