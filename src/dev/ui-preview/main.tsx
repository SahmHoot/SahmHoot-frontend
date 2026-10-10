/// <reference types="vite/client" />
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../../globals.css';

// Independent dev HTML entry. No import from the production app or router.
if (import.meta.env.DEV) {
  void import('./Preview').then(({ Preview }) => {
    createRoot(document.getElementById('root')!).render(
      <StrictMode><Preview /></StrictMode>,
    );
  });
} else {
  document.getElementById('root')!.textContent = '개발 환경에서만 제공되는 화면입니다.';
}
