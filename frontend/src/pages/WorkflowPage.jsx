import { useLocation } from 'react-router-dom';
import WorkflowWizard from '../components/WorkflowWizard';

export default function WorkflowPage() {
  const location = useLocation();
  const preSelectedTicket = location.state?.ticket || null;
  
  return (
    <div className="min-h-screen bg-gray-50">
      <WorkflowWizard initialTicket={preSelectedTicket} />
    </div>
  );
}