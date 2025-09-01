import { useState, useEffect } from 'react';
import { Zap, CheckCircle, Loader2, AlertCircle } from 'lucide-react';
import cacheService, { cachedApi } from '../services/cacheService';

export default function DemoMode({ onComplete }) {
  const [isPreloading, setIsPreloading] = useState(false);
  const [preloadStatus, setPreloadStatus] = useState({
    boards: false,
    sprints: false,
    tickets: false,
    testRail: false,
    patterns: false
  });
  const [error, setError] = useState(null);

  const preloadDemoData = async () => {
    setIsPreloading(true);
    setError(null);
    
    try {
      // Step 1: Preload JIRA boards
      console.log('🚀 Preloading JIRA boards...');
      const boards = await cachedApi.getJiraBoards();
      setPreloadStatus(prev => ({ ...prev, boards: true }));
      
      // Step 2: Preload sprints for key boards
      console.log('🚀 Preloading sprints...');
      const boardIds = [2892, 3859, 3860]; // ESW, ESWCTV, ESR
      const sprintPromises = boardIds.map(id => 
        cachedApi.getJiraSprint(id).catch(err => {
          console.warn(`Failed to load sprint for board ${id}:`, err);
          return null;
        })
      );
      const sprints = await Promise.all(sprintPromises);
      setPreloadStatus(prev => ({ ...prev, sprints: true }));
      
      // Step 3: Preload tickets for active sprints
      console.log('🚀 Preloading tickets...');
      const validSprints = sprints.filter(s => s && s.id);
      const ticketPromises = validSprints.map(sprint => 
        cachedApi.getJiraTickets(sprint.id).catch(err => {
          console.warn(`Failed to load tickets for sprint ${sprint.id}:`, err);
          return [];
        })
      );
      await Promise.all(ticketPromises);
      setPreloadStatus(prev => ({ ...prev, tickets: true }));
      
      // Step 4: Preload TestRail projects
      console.log('🚀 Preloading TestRail projects...');
      const testRailProjects = await cachedApi.getTestRailProjects();
      setPreloadStatus(prev => ({ ...prev, testRail: true }));
      
      // Step 5: Preload Cypress patterns
      console.log('🚀 Preloading Cypress patterns...');
      const patterns = await cachedApi.getCypressPatterns();
      setPreloadStatus(prev => ({ ...prev, patterns: true }));
      
      // Store demo mode flag
      localStorage.setItem('demo_mode', 'true');
      localStorage.setItem('demo_preload_time', new Date().toISOString());
      
      console.log('✅ Demo data preloaded successfully!');
      console.log('📊 Cache stats:', cacheService.getStats());
      
      if (onComplete) {
        setTimeout(onComplete, 1000);
      }
    } catch (err) {
      console.error('Error preloading demo data:', err);
      setError(err.message);
    } finally {
      setIsPreloading(false);
    }
  };

  const clearCache = () => {
    cacheService.clear();
    localStorage.removeItem('demo_mode');
    localStorage.removeItem('demo_preload_time');
    setPreloadStatus({
      boards: false,
      sprints: false,
      tickets: false,
      testRail: false,
      patterns: false
    });
    console.log('🧹 Cache cleared');
  };

  useEffect(() => {
    // Check if demo mode is already active
    const demoMode = localStorage.getItem('demo_mode');
    const preloadTime = localStorage.getItem('demo_preload_time');
    
    if (demoMode && preloadTime) {
      const timeSincePreload = Date.now() - new Date(preloadTime).getTime();
      const oneHour = 60 * 60 * 1000;
      
      if (timeSincePreload < oneHour) {
        console.log('✨ Demo mode active with cached data');
        setPreloadStatus({
          boards: true,
          sprints: true,
          tickets: true,
          testRail: true,
          patterns: true
        });
      } else {
        console.log('⏰ Demo cache expired, clearing...');
        clearCache();
      }
    }
  }, []);

  const allPreloaded = Object.values(preloadStatus).every(status => status);
  const stats = cacheService.getStats();

  return (
    <div className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-lg p-6 border border-purple-200">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Zap className="h-5 w-5 text-yellow-500" />
            Demo Mode
          </h3>
          <p className="text-sm text-gray-600 mt-1">
            Preload all data for lightning-fast demo performance
          </p>
        </div>
        
        <div className="text-right">
          <div className="text-xs text-gray-500">Cache Stats</div>
          <div className="text-sm font-medium text-gray-900">
            Hit Rate: {stats.hitRate}
          </div>
          <div className="text-xs text-gray-500">
            {stats.hits} hits / {stats.misses} misses
          </div>
        </div>
      </div>

      <div className="space-y-2 mb-4">
        {Object.entries(preloadStatus).map(([key, status]) => (
          <div key={key} className="flex items-center gap-2">
            {status ? (
              <CheckCircle className="h-4 w-4 text-green-500" />
            ) : isPreloading ? (
              <Loader2 className="h-4 w-4 text-gray-400 animate-spin" />
            ) : (
              <div className="h-4 w-4 rounded-full border-2 border-gray-300" />
            )}
            <span className={`text-sm ${status ? 'text-green-700' : 'text-gray-600'}`}>
              {key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1')}
            </span>
          </div>
        ))}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded p-3 mb-4">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-red-500" />
            <span className="text-sm text-red-700">{error}</span>
          </div>
        </div>
      )}

      <div className="flex gap-2">
        {!allPreloaded && (
          <button
            onClick={preloadDemoData}
            disabled={isPreloading}
            className="flex-1 bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-4 py-2 rounded-lg hover:from-purple-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {isPreloading ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Preloading...
              </span>
            ) : (
              'Activate Demo Mode'
            )}
          </button>
        )}
        
        {allPreloaded && (
          <button
            onClick={clearCache}
            className="flex-1 bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Clear Cache
          </button>
        )}
      </div>

      {allPreloaded && (
        <div className="mt-4 bg-green-50 border border-green-200 rounded-lg p-3">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-green-500" />
            <span className="text-sm text-green-700 font-medium">
              Demo mode active! All data cached for instant loading.
            </span>
          </div>
        </div>
      )}
    </div>
  );
}