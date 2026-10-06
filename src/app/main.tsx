import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { AuthProvider } from '../features/auth/AuthContext.tsx';
import { ThemeProvider } from '../theme/ThemeContext.tsx';
import { LanguageProvider } from '../lib/i18n.tsx';
import { ErrorBoundary } from '../components/ErrorBoundary.tsx';
import '../styles/index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <ThemeProvider>
        <LanguageProvider>
          <AuthProvider>
            <App />
          </AuthProvider>
        </LanguageProvider>
      </ThemeProvider>
    </ErrorBoundary>
  </StrictMode>,
);
