import { Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

const Home = () => {
  const { isAuthenticated, user } = useAuth();
  
  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section */}
      <div className="max-w-7xl mx-auto px-6 py-24">
        <div className="text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
            Study Better, Together
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto mb-12">
            Join your friends in focused study sessions with real-time timers, chat, and collaborative tools. 
            Stay motivated and productive in your virtual study room.
          </p>
          
          {isAuthenticated && user ? (
            <div className="flex flex-col sm:flex-row gap-4 justify-center max-w-md mx-auto">
              <Link to="/study-room" className="btn-primary flex-1 text-center">
                Join Study Room
              </Link>
              <Link to="/create-room" className="btn-secondary flex-1 text-center">
                Create New Room
              </Link>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row gap-4 justify-center max-w-md mx-auto">
              <Link to="/login" className="btn-secondary flex-1 text-center">
                Sign In
              </Link>
              <Link to="/signup" className="btn-primary flex-1 text-center">
                Get Started
              </Link>
            </div>
          )}
        </div>
      </div>
      
      {/* Features Section */}
      <div className="bg-gray-50 py-24">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Everything you need to study effectively
            </h2>
            <p className="text-lg text-gray-600">
              Simple, powerful tools designed for focused learning
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Focus Timer</h3>
              <p className="text-gray-600">Synchronized timers keep everyone on track during study sessions and breaks.</p>
            </div>
            
            <div className="text-center">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-3.582 8-8 8a8.001 8.001 0 01-7.022-4.152A2.978 2.978 0 003 15.5c0-1.65 1.35-3 3-3h.5c.255 0 .507-.035.75-.1A9.967 9.967 0 0112 12c0 1.742-.449 3.378-1.238 4.8A2.976 2.976 0 0113.5 18.5c0-1.65 1.35-3 3-3h.5c1.65 0 3 1.35 3 3 0 1.65-1.35 3-3 3" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Real-time Chat</h3>
              <p className="text-gray-600">Stay connected with your study group through instant messaging.</p>
            </div>
            
            <div className="text-center">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Study Groups</h3>
              <p className="text-gray-600">Create or join study rooms with friends for collaborative learning.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;
