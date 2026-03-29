import React from 'react';
import { LogoMark } from './LogoMark';

export const LoadingScreen: React.FC<{ message?: string }> = ({ message = 'Accessing Vault' }) => {
  return (
    <div className="loading-screen">
      <div className="loading-mesh" />
      
      <div className="loading-logo-container">
        <LogoMark size="lg" />
      </div>
      
      <div className="loading-bar-container">
        <div className="loading-bar-progress" />
      </div>
      
      <div className="loading-text">
        {message}
      </div>
    </div>
  );
};
