import React from 'react';
import ReactDOM from 'react-dom/client';
import { WorkspacePreview } from './WorkspacePreview';
import './preview.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><WorkspacePreview /></React.StrictMode>,
);
