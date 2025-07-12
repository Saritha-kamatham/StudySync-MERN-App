import { useState } from 'react';

const PasswordModal = ({ isOpen, onClose, onSubmit, roomName, isLoading, userInfo }) => {
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');

  const isAuthenticated = userInfo?.isAuthenticated;

  console.log("🔐 PasswordModal render:", { isOpen, roomName, isLoading, isAuthenticated });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!password.trim()) {
      setError('Password is required');
      return;
    }
    
    // For non-authenticated users, require username
    if (!isAuthenticated && !username.trim()) {
      setError('Username is required');
      return;
    }
    
    // Pass both password and username (if needed)
    onSubmit(password.trim(), !isAuthenticated ? username.trim() : null);
  };

  const handleClose = () => {
    setPassword('');
    setUsername('');
    setError('');
    onClose();
  };

  if (!isOpen) {
    console.log("🔐 PasswordModal not open, returning null");
    return null;
  }

  console.log("🔐 PasswordModal rendering modal for room:", roomName);
  console.log("🔐 PasswordModal props:", { isOpen, roomName, isLoading, isAuthenticated });

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      style={{ zIndex: 9999 }}
      onClick={(e) => {
        // Close modal if clicking the backdrop
        if (e.target === e.currentTarget) {
          handleClose();
        }
      }}
    >
      <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900">
            🔒 Private Room Access
          </h2>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="mb-4">
          <p className="text-gray-600 text-sm mb-2">
            Room "<span className="font-medium text-blue-600">{roomName}</span>" is private.
          </p>
          <p className="text-gray-500 text-xs">
            {isAuthenticated 
              ? "Enter the password to join this room."
              : "Enter your username and the room password to join."
            }
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isAuthenticated && (
            <div>
              <input
                type="text"
                placeholder="Enter your username"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  setError('');
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                autoFocus
                disabled={isLoading}
              />
            </div>
          )}
          
          <div>
            <input
              type="password"
              placeholder="Enter room password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError('');
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              autoFocus={isAuthenticated}
              disabled={isLoading}
            />
          </div>

          {error && (
            <div className="text-red-500 text-sm">{error}</div>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 transition-colors"
              disabled={isLoading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
              disabled={isLoading}
            >
              {isLoading ? 'Verifying...' : 'Join Room'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PasswordModal;
