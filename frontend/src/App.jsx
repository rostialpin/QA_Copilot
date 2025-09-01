import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import TestGenerator from './pages/TestGenerator';
import UnifiedTestGenerator from './pages/UnifiedGeneratorV2';
import CypressGenerator from './pages/CypressGenerator';
import TestRailBrowser from './pages/TestRailBrowser';
import Settings from './pages/Settings';
import TestConnection from './pages/TestConnection';
import WorkflowPage from './pages/WorkflowPage';

function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="workflow" element={<WorkflowPage />} />
        <Route path="test-generator" element={<TestGenerator />} />
        <Route path="unified-generator" element={<UnifiedTestGenerator />} />
        <Route path="cypress-generator" element={<CypressGenerator />} />
        <Route path="testrail" element={<TestRailBrowser />} />
        <Route path="settings" element={<Settings />} />
        <Route path="test-connection" element={<TestConnection />} />
      </Route>
    </Routes>
  );
}

export default App;
