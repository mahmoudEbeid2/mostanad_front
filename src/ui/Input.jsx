import React from "react";

const Input = React.forwardRef(({ className = "", ...props }, ref) => {
  return (
    <input
      ref={ref}
      className={`w-full px-4 py-3 bg-gray-800/50 border border-gray-700/50 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all disabled:opacity-50 text-gray-100 placeholder-gray-500 backdrop-blur-sm ${className}`}
      {...props}
    />
  );
});

Input.displayName = "Input";

export default Input;
