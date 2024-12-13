import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import VideoEditor from './pages/VideoEditor';

function App() {
  return (
    <>
      <Router>
        <Routes>
          <Route path='/' element={<VideoEditor />} />
        </Routes>
      </Router>
    </>
  );
}

export default App;
