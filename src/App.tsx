import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { PhilosophyPage } from './pages/PhilosophyPage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/*" element={<PhilosophyPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
