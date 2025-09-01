import { useState, useEffect } from 'react';
import { TrendingUp, Database, Zap, Clock, BarChart3 } from 'lucide-react';
import cacheService from '../services/cacheService';

export default function CacheStats({ compact = false }) {
  const [stats, setStats] = useState(null);
  const [refreshInterval, setRefreshInterval] = useState(5000); // 5 seconds

  useEffect(() => {
    const updateStats = () => {
      const currentStats = cacheService.getStats();
      setStats(currentStats);
    };

    // Initial load
    updateStats();

    // Set up interval for auto-refresh
    const interval = setInterval(updateStats, refreshInterval);

    return () => clearInterval(interval);
  }, [refreshInterval]);

  if (!stats) {
    return null;
  }

  // Calculate performance metrics
  const totalRequests = stats.hits + stats.misses;
  const hitRatePercent = totalRequests > 0 ? ((stats.hits / totalRequests) * 100).toFixed(1) : 0;
  const savedTime = stats.hits * 2000; // Estimate 2 seconds saved per cache hit
  const savedTimeStr = savedTime > 60000 
    ? `${Math.floor(savedTime / 60000)}m ${Math.floor((savedTime % 60000) / 1000)}s`
    : `${Math.floor(savedTime / 1000)}s`;

  if (compact) {
    // Compact inline display for header/navbar
    return (
      <div className="flex items-center gap-4 text-sm">
        <div className="flex items-center gap-1">
          <Zap className="h-4 w-4 text-yellow-500" />
          <span className="font-medium">{hitRatePercent}%</span>
        </div>
        <div className="text-gray-500">
          {stats.hits}/{totalRequests} hits
        </div>
      </div>
    );
  }

  // Full stats display
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-indigo-600" />
          Cache Performance
        </h3>
        <select
          value={refreshInterval}
          onChange={(e) => setRefreshInterval(Number(e.target.value))}
          className="text-xs border-gray-300 rounded px-2 py-1"
        >
          <option value={5000}>Refresh: 5s</option>
          <option value={10000}>Refresh: 10s</option>
          <option value={30000}>Refresh: 30s</option>
          <option value={0}>Manual</option>
        </select>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Hit Rate */}
        <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="h-4 w-4 text-green-600" />
            <span className="text-xs font-medium text-green-700">Hit Rate</span>
          </div>
          <div className="text-2xl font-bold text-green-900">{hitRatePercent}%</div>
          <div className="text-xs text-green-600 mt-1">
            {stats.hits} hits / {totalRequests} total
          </div>
        </div>

        {/* Cache Size */}
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-1">
            <Database className="h-4 w-4 text-blue-600" />
            <span className="text-xs font-medium text-blue-700">Cache Size</span>
          </div>
          <div className="text-2xl font-bold text-blue-900">{stats.memoryCacheSize}</div>
          <div className="text-xs text-blue-600 mt-1">
            Memory: {stats.memoryCacheSize} | Storage: {stats.localStorageSize}
          </div>
        </div>

        {/* Time Saved */}
        <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="h-4 w-4 text-purple-600" />
            <span className="text-xs font-medium text-purple-700">Time Saved</span>
          </div>
          <div className="text-2xl font-bold text-purple-900">{savedTimeStr}</div>
          <div className="text-xs text-purple-600 mt-1">
            ~2s per cache hit
          </div>
        </div>

        {/* Performance Score */}
        <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-1">
            <Zap className="h-4 w-4 text-yellow-600" />
            <span className="text-xs font-medium text-yellow-700">Performance</span>
          </div>
          <div className="text-2xl font-bold text-yellow-900">
            {hitRatePercent >= 80 ? 'Excellent' : 
             hitRatePercent >= 60 ? 'Good' : 
             hitRatePercent >= 40 ? 'Fair' : 'Building'}
          </div>
          <div className="text-xs text-yellow-600 mt-1">
            {stats.saves} items cached
          </div>
        </div>
      </div>

      {/* Hit/Miss Bar */}
      <div className="mt-4">
        <div className="flex justify-between text-xs text-gray-600 mb-1">
          <span>Cache Hits ({stats.hits})</span>
          <span>Cache Misses ({stats.misses})</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-green-500 to-green-600 transition-all duration-500"
            style={{ width: `${hitRatePercent}%` }}
          />
        </div>
      </div>

      {/* Tips */}
      {hitRatePercent < 60 && totalRequests > 10 && (
        <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-xs text-yellow-800">
            💡 <strong>Tip:</strong> Cache is building up. Performance will improve as more data is cached.
            {hitRatePercent < 40 && ' Consider using Demo Mode to preload cache for optimal performance.'}
          </p>
        </div>
      )}

      {hitRatePercent >= 80 && (
        <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-xs text-green-800">
            ✨ <strong>Excellent!</strong> Cache is performing optimally. You're saving approximately {savedTimeStr} in load time.
          </p>
        </div>
      )}
    </div>
  );
}