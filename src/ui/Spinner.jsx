export default function Spinner({ size = "md", className = "" }) {
  const sizes = {
    sm: "w-5 h-5 border-2",
    md: "w-8 h-8 border-3",
    lg: "w-12 h-12 border-4",
  };

  return (
    <div
      className={`rounded-full border-blue-500 border-t-transparent animate-spin ${sizes[size]} ${className}`}
    ></div>
  );
}
