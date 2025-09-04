import { Outlet, NavLink } from 'react-router-dom';
import { 
  HomeIcon, 
  BeakerIcon, 
  CodeBracketIcon,
  FolderOpenIcon,
  Cog6ToothIcon 
} from '@heroicons/react/24/outline';

export default function Layout() {
  const navigation = [
    { name: 'Sprint Dashboard', href: '/', icon: HomeIcon },
    { name: '✨ Create Test Cases', href: '/workflow', icon: BeakerIcon, highlight: true },
    { name: '☕ Automate Tests', href: '/automate-tests', icon: CodeBracketIcon },
    { name: 'TestRail', href: '/testrail', icon: FolderOpenIcon },
    { name: 'Settings', href: '/settings', icon: Cog6ToothIcon },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <div className="flex-shrink-0 flex items-center">
                <h1 className="text-xl font-bold text-indigo-600">🤖 QA Copilot</h1>
              </div>
              <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
                {navigation.map((item) => (
                  <NavLink
                    key={item.name}
                    to={item.href}
                    className={({ isActive }) =>
                      `inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${
                        isActive
                          ? 'border-indigo-500 text-gray-900'
                          : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                      }`
                    }
                  >
                    <item.icon className="h-5 w-5 mr-2" />
                    {item.name}
                  </NavLink>
                ))}
              </div>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <Outlet />
      </main>
    </div>
  );
}
