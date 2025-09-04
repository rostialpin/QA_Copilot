import { useState, useEffect } from 'react';
import { 
  CheckCircleIcon, 
  SparklesIcon, 
  RocketLaunchIcon,
  DocumentTextIcon,
  CodeBracketIcon,
  CommandLineIcon
} from '@heroicons/react/24/outline';

export default function SuccessAnimation({ 
  type = 'manual', // 'manual' or 'automation'
  testCount = 0,
  onComplete,
  show = false
}) {
  const [isVisible, setIsVisible] = useState(false);
  const [particles, setParticles] = useState([]);
  const [codeLines, setCodeLines] = useState([]);

  useEffect(() => {
    if (show) {
      setIsVisible(true);
      
      const isAutomation = type === 'automation';
      
      if (isAutomation) {
        // Generate code snippet lines for automation
        const newCodeLines = Array.from({ length: 8 }, (_, i) => ({
          id: i,
          text: ['@Test', 'public void test()', 'driver.findElement', 'assert.equals', 'click()', 'waitForElement', 'selenium.execute', 'test.passed'][i],
          delay: i * 0.2
        }));
        setCodeLines(newCodeLines);
        // Generate fewer, green-tinted particles for automation
        const newParticles = Array.from({ length: 20 }, (_, i) => ({
          id: i,
          x: 40 + Math.random() * 20, // Concentrated in center
          y: Math.random() * 100,
          color: ['#10B981', '#059669', '#34D399'][Math.floor(Math.random() * 3)],
          delay: Math.random() * 0.3,
          duration: 2 + Math.random() * 1,
          isCode: true
        }));
        setParticles(newParticles);
      } else {
        // Generate colorful confetti for manual tests
        const newParticles = Array.from({ length: 60 }, (_, i) => ({
          id: i,
          x: Math.random() * 100,
          y: Math.random() * 100,
          color: ['#3B82F6', '#10B981', '#F59E0B', '#EC4899', '#8B5CF6', '#EF4444'][Math.floor(Math.random() * 6)],
          delay: Math.random() * 0.5,
          duration: 1.5 + Math.random() * 2,
          size: Math.random() > 0.5 ? 'large' : 'small'
        }));
        setParticles(newParticles);
      }

      // Auto-hide after animation
      const timer = setTimeout(() => {
        setIsVisible(false);
        if (onComplete) onComplete();
      }, 4500);

      return () => clearTimeout(timer);
    }
  }, [show, type, onComplete]);

  if (!isVisible) return null;

  const isAutomation = type === 'automation';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
      {/* Background overlay - different for each type */}
      <div className={`absolute inset-0 animate-fade-in pointer-events-auto ${
        isAutomation ? 'bg-green-900/20' : 'bg-gradient-to-br from-blue-500/10 to-purple-500/10'
      }`} 
           onClick={() => setIsVisible(false)} />
      
      {/* Particles/Effects */}
      <div className="absolute inset-0 overflow-hidden">
        {isAutomation ? (
          <>
            {/* Code lines floating up for automation */}
            {codeLines.map(line => (
              <div
                key={line.id}
                className="absolute text-green-400 font-mono text-sm animate-code-float opacity-60"
                style={{
                  left: `${30 + Math.random() * 40}%`,
                  animationDelay: `${line.delay}s`,
                }}
              >
                {line.text}
              </div>
            ))}
            {/* Matrix-like particles */}
            {particles.map(particle => (
              <div
                key={particle.id}
                className="absolute animate-matrix-fall"
                style={{
                  left: `${particle.x}%`,
                  animationDelay: `${particle.delay}s`,
                  animationDuration: `${particle.duration}s`,
                }}
              >
                <CodeBracketIcon className="h-4 w-4" style={{ color: particle.color }} />
              </div>
            ))}
          </>
        ) : (
          <>
            {/* Colorful confetti for manual tests */}
            {particles.map(particle => (
              <div
                key={particle.id}
                className={`absolute ${particle.size === 'large' ? 'w-3 h-3' : 'w-2 h-2'} animate-confetti rounded-full`}
                style={{
                  left: `${particle.x}%`,
                  top: '-10px',
                  backgroundColor: particle.color,
                  animationDelay: `${particle.delay}s`,
                  animationDuration: `${particle.duration}s`,
                  transform: `rotate(${Math.random() * 360}deg)`
                }}
              />
            ))}
            {/* Floating documents */}
            <DocumentTextIcon className="absolute h-8 w-8 text-blue-400 opacity-30 animate-float-document" 
                            style={{ left: '20%', top: '30%' }} />
            <DocumentTextIcon className="absolute h-6 w-6 text-purple-400 opacity-30 animate-float-document animation-delay-500" 
                            style={{ left: '70%', top: '40%' }} />
          </>
        )}
      </div>

      {/* Success card - different styles for each type */}
      <div className={`relative rounded-2xl shadow-2xl p-8 max-w-md mx-4 ${
        isAutomation 
          ? 'bg-gradient-to-br from-gray-900 to-green-900 text-white animate-automation-slide' 
          : 'bg-white animate-success-bounce'
      }`}>
        {/* Animated background effects */}
        {isAutomation ? (
          /* Terminal-style scanlines for automation */
          <div className="absolute inset-0 rounded-2xl overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-green-500/10 to-transparent animate-scanline" />
          </div>
        ) : (
          /* Colorful circles for manual */
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="absolute w-64 h-64 bg-blue-500 rounded-full opacity-10 animate-ping" />
            <div className="absolute w-48 h-48 bg-purple-500 rounded-full opacity-10 animate-ping animation-delay-200" />
            <div className="absolute w-32 h-32 bg-pink-500 rounded-full opacity-10 animate-ping animation-delay-400" />
          </div>
        )}

        {/* Content */}
        <div className="relative text-center">
          {/* Icon */}
          <div className="flex justify-center mb-4">
            {isAutomation ? (
              <div className="relative">
                <div className="flex items-center justify-center space-x-2">
                  <CommandLineIcon className="h-16 w-16 text-green-400 animate-pulse" />
                  <RocketLaunchIcon className="h-20 w-20 text-green-400 animate-rocket-launch" />
                  <CodeBracketIcon className="h-16 w-16 text-green-400 animate-pulse" />
                </div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="h-32 w-32 border-2 border-green-400 rounded-full opacity-30 animate-ping" />
                </div>
              </div>
            ) : (
              <div className="relative">
                <div className="flex items-center justify-center">
                  <DocumentTextIcon className="h-16 w-16 text-blue-400 absolute -left-4 animate-float-animation" />
                  <CheckCircleIcon className="h-20 w-20 text-blue-500 z-10" />
                  <DocumentTextIcon className="h-16 w-16 text-purple-400 absolute -right-4 animate-float-animation animation-delay-500" />
                </div>
                <SparklesIcon className="absolute -top-2 -right-2 h-10 w-10 text-yellow-500 animate-sparkle" />
                <SparklesIcon className="absolute -bottom-2 -left-2 h-8 w-8 text-pink-500 animate-sparkle animation-delay-200" />
              </div>
            )}
          </div>

          {/* Title */}
          <h2 className={`text-3xl font-bold mb-2 animate-slide-up ${
            isAutomation ? 'text-green-400 font-mono' : 'text-gray-900'
          }`}>
            {isAutomation ? '< Automation Complete />' : '✨ Tests Generated!'}
          </h2>

          {/* Stats */}
          <div className="mb-4">
            <div className={`text-5xl font-bold animate-number-count ${
              isAutomation 
                ? 'text-green-400 font-mono' 
                : 'bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent'
            }`}>
              {testCount}
            </div>
            <p className={`mt-1 ${isAutomation ? 'text-green-300' : 'text-gray-600'}`}>
              {isAutomation ? '// selenium tests compiled' : 'test cases generated'}
            </p>
          </div>

          {/* Success message */}
          <p className={`text-sm animate-fade-in animation-delay-500 ${
            isAutomation ? 'text-green-200 font-mono' : 'text-gray-500'
          }`}>
            {isAutomation 
              ? '> Tests ready for execution_'
              : 'Your test suite has been successfully created!'}
          </p>

          {/* Progress bar animation */}
          <div className="mt-6 h-2 bg-gray-200 bg-opacity-20 rounded-full overflow-hidden">
            <div className={`h-full animate-progress-fill ${
              isAutomation 
                ? 'bg-gradient-to-r from-green-400 to-emerald-400' 
                : 'bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500'
            }`} />
          </div>

          {/* Additional elements for automation */}
          {isAutomation && (
            <div className="mt-4 text-xs text-green-300 font-mono animate-type-text">
              System.out.println("Success!");
            </div>
          )}
        </div>
      </div>
    </div>
  );
}