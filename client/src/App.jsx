import { Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import StudyRoom from "./pages/StudyRoom";
import Navbar from "./components/Navbar";
import NotFound from "./pages/NotFound";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import CreateRoom from "./pages/CreateRoom";
import GlobalRoomHandler from "./components/GlobalRoomHandler";

function App() {
  return (
    <>
      <Navbar />
      <GlobalRoomHandler />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/study-room" element={<StudyRoom />} />
        <Route path="/room/:roomName" element={<StudyRoom />} />
        <Route path="/create-room" element={<CreateRoom />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  );
}

export default App;
