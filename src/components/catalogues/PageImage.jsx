import { useEffect, useRef, useState } from "react";
import { FileImage } from "lucide-react";

// One catalogue page image from an imageLoader: a shimmer until it is there.
// lazy: asked for only when it comes near the viewport (the thumbnail grid).
export default function PageImage({ url, loader, lazy = false, alt = "", className = "" }) {
  const [src, setSrc] = useState(null);
  const [failed, setFailed] = useState(false);
  const box = useRef(null);

  useEffect(() => {
    let alive = true;
    setSrc(null);
    setFailed(false);
    const start = () =>
      loader.get(url, { first: !lazy }).then(
        (objectUrl) => alive && setSrc(objectUrl),
        () => alive && setFailed(true)
      );
    if (!lazy) {
      start();
      return () => {
        alive = false;
      };
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        observer.disconnect();
        start();
      },
      // the app scrolls inside <main>: rootMargin only reaches past what its root clips
      { root: box.current.closest("main"), rootMargin: "300px" }
    );
    observer.observe(box.current);
    return () => {
      alive = false;
      observer.disconnect();
    };
  }, [url, loader, lazy]);

  return (
    <div ref={box} className={`relative ${className}`}>
      {src ? (
        <img src={src} alt={alt} className="h-full w-full object-contain" />
      ) : failed ? (
        <div className="flex h-full w-full items-center justify-center text-gray-300" data-testid="page-image-failed">
          <FileImage className="h-6 w-6" aria-hidden="true" />
        </div>
      ) : (
        <div className="h-full w-full animate-pulse bg-gray-100" data-testid="page-image-loading" aria-hidden="true" />
      )}
    </div>
  );
}
