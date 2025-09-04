export default function Logo({ className = "h-8 w-auto" }) {
  return (
    <svg 
      className={className}
      viewBox="0 0 240 50" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="mountainLight" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#93C5FD" />
          <stop offset="100%" stopColor="#60A5FA" />
        </linearGradient>
        <linearGradient id="mountainDark" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#3B82F6" />
          <stop offset="100%" stopColor="#2563EB" />
        </linearGradient>
      </defs>
      
      <g transform="translate(5, 5)">
        {/* Outer circle ring - thinner cyan/blue */}
        <circle 
          cx="20" 
          cy="20" 
          r="19" 
          stroke="#06B6D4" 
          strokeWidth="1.2" 
          fill="none"
        />
        
        {/* Left mountain (darker, behind) */}
        <path
          d="M 5 30 L 15 12 L 20 20 L 22 30 Z"
          fill="url(#mountainDark)"
          opacity="0.9"
        />
        
        {/* Left mountain peak lines */}
        <path
          d="M 15 12 L 12 18 M 15 12 L 18 18"
          stroke="#1E40AF"
          strokeWidth="0.5"
          opacity="0.6"
        />
        
        {/* Right mountain (lighter, front) */}
        <path
          d="M 18 30 L 25 10 L 35 30 Z"
          fill="url(#mountainLight)"
        />
        
        {/* Right mountain peak lines for geometric effect */}
        <path
          d="M 25 10 L 22 16 M 25 10 L 28 16 M 22 16 L 25 22 M 28 16 L 25 22"
          stroke="#60A5FA"
          strokeWidth="0.5"
          opacity="0.5"
        />
        
        {/* Additional geometric lines on right mountain */}
        <path
          d="M 20 20 L 25 22 M 25 22 L 30 24"
          stroke="#3B82F6"
          strokeWidth="0.5"
          opacity="0.4"
        />
        
        {/* Two stars with sparkle effect */}
        <g>
          {/* Star 1 - larger */}
          <g transform="translate(28, 8)">
            <path d="M 0 -2 L 0.5 0.5 L 2.5 0.5 L 0.5 1.5 L 1.5 3.5 L 0 2 L -1.5 3.5 L -0.5 1.5 L -2.5 0.5 L -0.5 0.5 Z" 
                  fill="white"/>
            <path d="M 0 -1 L 0 1 M -1 0 L 1 0" 
                  stroke="white" 
                  strokeWidth="0.3"
                  opacity="0.8"/>
          </g>
          
          {/* Star 2 - smaller */}
          <g transform="translate(32, 5)">
            <path d="M 0 -1.5 L 0.4 0.4 L 2 0.4 L 0.4 1.2 L 1.2 2.8 L 0 1.6 L -1.2 2.8 L -0.4 1.2 L -2 0.4 L -0.4 0.4 Z" 
                  fill="white"/>
            <path d="M 0 -0.8 L 0 0.8 M -0.8 0 L 0.8 0" 
                  stroke="white" 
                  strokeWidth="0.25"
                  opacity="0.8"/>
          </g>
        </g>
      </g>
      
      {/* Text part */}
      <g>
        <text
          x="50"
          y="22"
          fontSize="18"
          fontWeight="700"
          fill="#1F2937"
          fontFamily="Georgia, serif"
        >
          PARAMOUNT
        </text>
        <text
          x="50"
          y="38"
          fontSize="13"
          fontWeight="500"
          fill="#6B7280"
          fontFamily="system-ui, -apple-system, sans-serif"
          letterSpacing="0.5"
        >
          QA COPILOT
        </text>
      </g>
    </svg>
  );
}