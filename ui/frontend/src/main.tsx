import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Initialize theme before rendering (dark mode default)
const root = document.documentElement;
const storedTheme = localStorage.getItem('theme-storage');
let initialTheme = 'dark'; // Default

if (storedTheme) {
  try {
    const parsed = JSON.parse(storedTheme);
    initialTheme = parsed.state?.theme || 'dark';
  } catch {
    // If parsing fails, use default
  }
}

// Apply theme to root element immediately
root.classList.remove('light', 'dark');
root.classList.add(initialTheme);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
