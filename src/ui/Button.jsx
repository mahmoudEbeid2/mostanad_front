import React from "react";
import Spinner from "./Spinner";

const Button = React.forwardRef(
  ({ children, disabled, isLoading, className = "", variant = "primary", title, ...props }, ref) => {
    const baseStyles =
      "relative flex items-center justify-center gap-2 px-4 py-3 font-semibold rounded-xl transition-all duration-300 ease-out active:scale-95 disabled:pointer-events-none overflow-hidden";

    const variants = {
      primary: "bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-500/20",
      secondary: "bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 shadow-sm",
      ghost: "hover:bg-gray-100 text-gray-600 hover:text-gray-900",
    };
    // a disabled button must read as disabled (it used to keep 70 % of its colour and
    // looked clickable); a loading one stays almost as it was, with its spinner
    const state = disabled && !isLoading ? "opacity-40 saturate-50 !shadow-none" : isLoading ? "opacity-80" : "";

    const button = (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        title={disabled ? undefined : title}
        className={`${baseStyles} ${variants[variant]} ${state} ${className}`}
        {...props}
      >
        {isLoading && <Spinner size="sm" className="absolute" />}
        <span className={`flex items-center justify-center gap-2 transition-opacity ${isLoading ? "opacity-0" : "opacity-100"}`}>
          {children}
        </span>
      </button>
    );
    // a disabled button gets no pointer events, so its reason (title) would never
    // show on hover: the tooltip goes on a wrapper instead
    if (disabled && title) {
      return (
        <span className="inline-flex cursor-not-allowed" title={title}>
          {button}
        </span>
      );
    }
    return button;
  }
);

Button.displayName = "Button";

export default Button;
