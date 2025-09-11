import { Outlet, NavLink } from 'react-router-dom';
import { 
  HomeIcon, 
  BeakerIcon, 
  CodeBracketIcon,
  FolderOpenIcon,
  Cog6ToothIcon,
  SparklesIcon,
  RocketLaunchIcon,
  CursorArrowRaysIcon
} from '@heroicons/react/24/outline';
import Logo from './Logo';

export default function Layout() {
  const navigation = [
    { name: 'Sprint Dashboard', href: '/', icon: HomeIcon, color: 'text-blue-600' },
    { name: 'Create Test Cases', href: '/workflow', icon: SparklesIcon, color: 'text-purple-600' },
    { name: 'Automate Tests', href: '/automate-tests', icon: RocketLaunchIcon, color: 'text-green-600' },
    { name: 'Locator Training', href: '/locator-training', icon: CursorArrowRaysIcon, color: 'text-indigo-600' },
    { name: 'TestRail', href: '/testrail', icon: FolderOpenIcon, color: 'text-orange-600' },
    { name: 'Settings', href: '/settings', icon: Cog6ToothIcon, color: 'text-gray-600' },
  ];

  return (
    <div className="min-h-screen gradient-bg">
      <nav className="bg-gradient-to-r from-white/95 via-blue-50/95 to-white/95 backdrop-blur-sm shadow-lg border-b border-blue-100/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-20">
            <div className="flex">
              <div className="flex-shrink-0 flex items-center">
                <Logo className="h-12 w-auto" />
              </div>
              <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
                {navigation.map((item) => (
                  <NavLink
                    key={item.name}
                    to={item.href}
                    className={({ isActive }) =>
                      `inline-flex items-center px-3 pt-1 border-b-2 text-sm font-medium transition-all duration-200 ${
                        isActive
                          ? `border-indigo-500 ${item.color || 'text-gray-900'} scale-105 pulse-glow rounded-lg px-3 py-1`
                          : `border-transparent text-gray-500 hover:border-gray-300 hover:${item.color || 'text-gray-700'} hover:scale-105`
                      }`
                    }
                  >
                    <item.icon className="h-5 w-5 mr-2 transition-transform duration-200 hover:rotate-12" />
                    {item.name}
                  </NavLink>
                ))}
              </div>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8 animate-appear">
        <Outlet />
      </main>
    </div>
  );
}
