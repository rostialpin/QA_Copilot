import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import TestRailBrowser from './pages/TestRailBrowser';
import Settings from './pages/Settings';
import TestConnection from './pages/TestConnection';
import WorkflowPage from './pages/WorkflowPage';
import AutomateExistingTests from './pages/AutomateExistingTests';

function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="workflow" element={<WorkflowPage />} />
        <Route path="automate-tests" element={<AutomateExistingTests />} />
        <Route path="testrail" element={<TestRailBrowser />} />
        <Route path="settings" element={<Settings />} />
        <Route path="test-connection" element={<TestConnection />} />
      </Route>
    </Routes>
  );
}

export default App;
