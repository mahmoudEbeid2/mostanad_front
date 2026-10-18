import { useEffect, useRef, useState } from "react";
import { FileImage } from "lucide-react";

// An <img> whose bytes come through the authorised API client (thumbnails need
// the bearer token, so a plain src URL would 401). `load` resolves to a Blob.
export default function AuthImage({ load, reloadKey, alt, className = "" }) {
  const [url, setUrl] = useState(null);
  const [failed, setFailed] = useState(false);
  const loadRef = useRef(load);
  loadRef.current = load;

  useEffect(() => {
    let alive = true;
    let objectUrl = null;
    setFailed(false);
    Promise.resolve(loadRef.current?.())
      .then((blob) => {
        if (!alive || !blob) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [reloadKey]); // load() is read through a ref; reloadKey decides when to refetch

  if (failed || !url) {
    return (
      <div className={`flex items-center justify-center bg-gray-50 text-gray-300 ${className}`}>
        <FileImage className="w-8 h-8" />
      </div>
    );
  }
  return <img src={url} alt={alt} className={`object-contain bg-white ${className}`} />;
}
