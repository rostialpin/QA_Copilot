export default function LoadingSpinner({ 
  size = 'md', 
  text = 'Loading...',
  fullScreen = false 
}) {
  const sizeClasses = {
    sm: 'h-8 w-8',
    md: 'h-12 w-12',
    lg: 'h-16 w-16'
  };

  const spinner = (
    <div className="flex flex-col items-center justify-center">
      <div className="relative">
        {/* Outer ring */}
        <div className={`${sizeClasses[size]} rounded-full border-4 border-blue-200 animate-pulse`}></div>
        
        {/* Inner spinning ring */}
        <div className={`absolute inset-0 ${sizeClasses[size]} rounded-full border-4 border-transparent border-t-blue-600 border-r-cyan-500 animate-spin`}></div>
        
        {/* Center dot */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="h-2 w-2 bg-blue-600 rounded-full animate-ping"></div>
        </div>
        
        {/* Orbiting dots */}
        <div className={`absolute inset-0 ${sizeClasses[size]} animate-spin-slow`}>
          <div className="absolute top-0 left-1/2 transform -translate-x-1/2 h-1.5 w-1.5 bg-cyan-400 rounded-full"></div>
          <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 h-1.5 w-1.5 bg-purple-400 rounded-full"></div>
        </div>
      </div>
      
      {text && (
        <p className="mt-4 text-sm font-medium text-gray-600 animate-pulse">
          {text}
        </p>
      )}
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/80 backdrop-blur-sm">
        {spinner}
      </div>
    );
  }

  return spinner;
}