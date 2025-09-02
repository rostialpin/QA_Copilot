import React, { useState, useEffect } from 'react';
import { Switch, FormControlLabel, Button, TextField, Dialog, DialogTitle, DialogContent, DialogActions, Alert } from '@mui/material';
import { Refresh, CloudSync, Storage } from '@mui/icons-material';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const DataSourceToggle = () => {
  const [useMock, setUseMock] = useState(true);
  const [configStatus, setConfigStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [credentialsDialog, setCredentialsDialog] = useState(false);
  const [credentials, setCredentials] = useState({
    host: 'https://paramount.atlassian.net',
    email: '',
    apiToken: ''
  });

  // Fetch current configuration status
  const fetchConfigStatus = async () => {
    try {
      const response = await fetch(`${API_URL}/api/config/status`);
      const data = await response.json();
      setConfigStatus(data);
      setUseMock(data.jira.useMock);
    } catch (error) {
      console.error('Error fetching config status:', error);
    }
  };

  useEffect(() => {
    fetchConfigStatus();
  }, []);

  // Toggle between mock and real data
  const handleToggle = async (event) => {
    const newUseMock = event.target.checked;
    
    // If switching to real data and no credentials, show dialog
    if (!newUseMock && configStatus && !configStatus.jira.configured) {
      setCredentialsDialog(true);
      return;
    }
    
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/config/jira/toggle-mock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ useMock: newUseMock })
      });
      
      const data = await response.json();
      if (data.success) {
        setUseMock(newUseMock);
        // Clear cache to force refresh
        localStorage.clear();
        window.location.reload();
      }
    } catch (error) {
      console.error('Error toggling data source:', error);
    } finally {
      setLoading(false);
    }
  };

  // Save JIRA credentials
  const handleSaveCredentials = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/config/jira/credentials`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials)
      });
      
      const data = await response.json();
      if (data.success) {
        setCredentialsDialog(false);
        setUseMock(false);
        await fetchConfigStatus();
        // Clear cache and reload
        localStorage.clear();
        window.location.reload();
      }
    } catch (error) {
      console.error('Error saving credentials:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!configStatus) return null;

  return (
    <div style={{ 
      position: 'fixed', 
      top: 70, 
      right: 20, 
      zIndex: 1000,
      backgroundColor: 'white',
      padding: '10px 15px',
      borderRadius: 8,
      boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
      display: 'flex',
      alignItems: 'center',
      gap: 10
    }}>
      {useMock ? <Storage color="action" /> : <CloudSync color="primary" />}
      
      <FormControlLabel
        control={
          <Switch 
            checked={useMock} 
            onChange={handleToggle}
            disabled={loading}
            color="primary"
          />
        }
        label={useMock ? "Mock Data" : "Real JIRA"}
      />
      
      <Button
        size="small"
        startIcon={<Refresh />}
        onClick={() => {
          localStorage.clear();
          window.location.reload();
        }}
        variant="outlined"
      >
        Refresh
      </Button>

      {/* Credentials Dialog */}
      <Dialog 
        open={credentialsDialog} 
        onClose={() => setCredentialsDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Configure JIRA Credentials</DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2 }}>
            Enter your JIRA credentials to connect to real data
          </Alert>
          
          <TextField
            fullWidth
            label="JIRA Host"
            value={credentials.host}
            onChange={(e) => setCredentials({...credentials, host: e.target.value})}
            margin="normal"
            placeholder="https://your-domain.atlassian.net"
          />
          
          <TextField
            fullWidth
            label="Email"
            value={credentials.email}
            onChange={(e) => setCredentials({...credentials, email: e.target.value})}
            margin="normal"
            placeholder="your-email@company.com"
          />
          
          <TextField
            fullWidth
            label="API Token"
            type="password"
            value={credentials.apiToken}
            onChange={(e) => setCredentials({...credentials, apiToken: e.target.value})}
            margin="normal"
            placeholder="Your JIRA API token"
            helperText="Generate token at: https://id.atlassian.com/manage-profile/security/api-tokens"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCredentialsDialog(false)}>Cancel</Button>
          <Button 
            onClick={handleSaveCredentials} 
            variant="contained"
            disabled={loading || !credentials.email || !credentials.apiToken}
          >
            Save & Connect
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
};

export default DataSourceToggle;