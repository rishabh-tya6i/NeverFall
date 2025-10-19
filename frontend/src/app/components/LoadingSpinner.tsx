"use client";

interface LoadingSpinnerProps {
  size?: "xs" | "sm" | "md" | "lg";
  text?: string;
  className?: string;
}

export default function LoadingSpinner({ 
  size = "lg", 
  text = "Loading...", 
  className = "" 
}: LoadingSpinnerProps) {
  return (
    <div className={`flex flex-col items-center justify-center ${className}`}>
      <span className={`loading loading-spinner loading-${size}`}></span>
      {text && <p className="mt-2 text-sm text-gray-600">{text}</p>}
    </div>
  );
}
