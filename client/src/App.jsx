import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './components/Login'; // שים לב שהנתיבים תואמים למיקום הקבצים שלך (אם הם לא בתיקיית components, מחק את המילה)
import ChatPage from './components/ChatPage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/chat" element={<ChatPage />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App; // <--- זו השורה שהייתה חסרה!