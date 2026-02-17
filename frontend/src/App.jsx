import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import FlaggedPage from './pages/FlaggedPage';
import FoldersPage from './pages/FoldersPage';
import Toolbar from './components/Toolbar';

export default function App() {
  return (
    <BrowserRouter>
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        <Toolbar />
        <main style={{ flex: 1 }}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/flagged" element={<FlaggedPage />} />
            <Route path="/folders" element={<FoldersPage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
