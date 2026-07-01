import React from "react";
import Spinner from "./Spinner";

const Button = React.forwardRef(
  ({ children, disabled, isLoading, className = "", variant = "primary", ...props }, ref) => {
    const baseStyles =
      "relative flex items-center justify-center gap-2 px-4 py-3 font-semibold rounded-xl transition-all duration-300 ease-out active:scale-95 disabled:opacity-70 disabled:pointer-events-none overflow-hidden";
      
    const variants = {
      primary: "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-lg shadow-blue-500/30",
      secondary: "bg-gray-800 hover:bg-gray-700 text-white border border-gray-700",
      ghost: "hover:bg-gray-800/50 text-gray-300 hover:text-white",
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={`${baseStyles} ${variants[variant]} ${className}`}
        {...props}
      >
        {isLoading && <Spinner size="sm" />}
        <span className={isLoading ? "opacity-0" : "opacity-100"}>{children}</span>
        {isLoading && (
          <span className="absolute inset-0 flex items-center justify-center">
            <Spinner size="sm" />
          </span>
        )}
      </button>
    );
  }
);

Button.displayName = "Button";

export default Button;
