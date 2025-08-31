import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import TestGenerator from './pages/TestGenerator';
import CypressGenerator from './pages/CypressGenerator';
import Settings from './pages/Settings';
import TestConnection from './pages/TestConnection';

function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="test-generator" element={<TestGenerator />} />
        <Route path="cypress-generator" element={<CypressGenerator />} />
        <Route path="settings" element={<Settings />} />
        <Route path="test-connection" element={<TestConnection />} />
      </Route>
    </Routes>
  );
}

export default App;
