/**
 * Main Application Entry Point
 * @author Krystian Bugalski
 * * Sets up the browser routing logic for the entire React application.
 */
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import Dashboard from './pages/Dashboard';
import { CursorProvider } from './context/CursorContext';
import CustomCursor from './components/ui/CustomCursor';
// Placeholder routes for upcoming public pages
// import Fundacja from './pages/Fundacja';
// import Archiwum from './pages/Archiwum';

function App() {
  return (
    <CursorProvider>
      <CustomCursor />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          {/* Public Pages */}
          {/* <Route path="/fundacja" element={<Fundacja />} /> */}
          {/* <Route path="/archiwum" element={<Archiwum />} /> */}
          
          {/* Enterprise System Route */}
          <Route path="/panel" element={<Dashboard />} />
        </Routes>
      </BrowserRouter>
    </CursorProvider>
  );
}

export default App;