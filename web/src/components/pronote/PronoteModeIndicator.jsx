import React, { useState, useEffect } from 'react';
import { API } from '../../api';

const PronoteModeIndicator = ({ childId }) => {
  const [modeInfo, setModeInfo] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchModeInfo();
  }, [childId]);

  const fetchModeInfo = async () => {
    try {
      const response = await API.get(`/children/${childId}/pronote/status`);
      setModeInfo(response.data);
    } catch (error) {
      console.error('Error fetching Pronote mode:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="pronote-mode-indicator loading">Chargement...</div>;
  }

  if (!modeInfo) {
    return null;
  }

  const getModeStyle = () => {
    if (modeInfo.isRealAccount) {
      return {
        backgroundColor: '#10b981',
        color: 'white',
        icon: '🎉'
      };
    } else if (modeInfo.hasRealConfig) {
      return {
        backgroundColor: '#f59e0b',
        color: 'white',
        icon: '🔄'
      };
    } else {
      return {
        backgroundColor: '#6b7280',
        color: 'white',
        icon: '🧪'
      };
    }
  };

  const modeStyle = getModeStyle();

  return (
    <div 
      className="pronote-mode-indicator"
      style={{
        backgroundColor: modeStyle.backgroundColor,
        color: modeStyle.color,
        padding: '8px 12px',
        borderRadius: '6px',
        fontSize: '14px',
        fontWeight: '500',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        margin: '8px 0'
      }}
    >
      <span className="mode-icon">{modeStyle.icon}</span>
      <span className="mode-message">{modeInfo.modeMessage}</span>
      <span className="data-source" style={{ fontSize: '12px', opacity: 0.8 }}>
        ({modeInfo.dataSource})
      </span>
    </div>
  );
};

export default PronoteModeIndicator;
