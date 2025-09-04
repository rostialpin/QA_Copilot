import { useEffect, useState } from 'react';

export default function AnimatedProgressBar({ 
  progress = 0, 
  label = '', 
  color = 'blue',
  showPercentage = true,
  animated = true,
  size = 'md' 
}) {
  const [currentProgress, setCurrentProgress] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      setCurrentProgress(progress);
    }, 100);
    return () => clearTimeout(timer);
  }, [progress]);

  const sizeClasses = {
    sm: 'h-2',
    md: 'h-4',
    lg: 'h-6'
  };

  const colorClasses = {
    blue: 'bg-gradient-to-r from-blue-500 to-cyan-500',
    green: 'bg-gradient-to-r from-green-500 to-emerald-500',
    purple: 'bg-gradient-to-r from-purple-500 to-pink-500',
    orange: 'bg-gradient-to-r from-orange-500 to-red-500'
  };

  return (
    <div className="w-full">
      {(label || showPercentage) && (
        <div className="flex justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">{label}</span>
          {showPercentage && (
            <span className="text-sm font-medium text-gray-600">
              {Math.round(currentProgress)}%
            </span>
          )}
        </div>
      )}
      <div className={`w-full bg-gray-200 rounded-full overflow-hidden ${sizeClasses[size]}`}>
        <div
          className={`${colorClasses[color]} ${sizeClasses[size]} rounded-full transition-all duration-1000 ease-out relative overflow-hidden`}
          style={{ width: `${currentProgress}%` }}
        >
          {animated && (
            <div className="absolute inset-0 bg-white/30 animate-pulse"></div>
          )}
          {size !== 'sm' && currentProgress > 0 && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="h-full w-20 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer-move"></div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}