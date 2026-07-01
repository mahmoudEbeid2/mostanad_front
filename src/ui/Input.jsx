import React from "react";

const Input = React.forwardRef(({ className = "", ...props }, ref) => {
  return (
    <input
      ref={ref}
      className={`w-full px-4 py-3 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all disabled:opacity-50 text-gray-900 placeholder-gray-400 shadow-sm ${className}`}
      {...props}
    />
  );
});

Input.displayName = "Input";

export default Input;
