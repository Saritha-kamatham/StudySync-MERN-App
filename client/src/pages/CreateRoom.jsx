import React, { useState } from "react";
import axios from "../utils/axios";
import { useNavigate } from "react-router-dom";

const CreateRoom = () => {
  const [roomName, setRoomName] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    
    if (!roomName.trim()) {
      setError("Room name is required!");
      return;
    }

    if (!isPublic && !password.trim()) {
      setError("Password is required for private rooms!");
      return;
    }
    
    try {
      const token = localStorage.getItem("token");
      const roomData = {
        name: roomName.trim(),
        isPublic,
        password: isPublic ? null : password.trim()
      };

      await axios.post("/api/rooms", roomData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setSuccess("Room created successfully! Redirecting...");
      
      // Mark this room as created by this user in this session
      localStorage.setItem("createdRoom", roomName);
      
      setTimeout(() => {
        navigate(`/room/${encodeURIComponent(roomName)}`);
      }, 1200);
    } catch (err) {
      setError(
        err.response?.data?.message || "Failed to create room. Try another name."
      );
    }
  };

  return (
    <div className="max-w-md mx-auto mt-8 p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-6 text-center">Create Study Room</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          type="text"
          className="w-full border p-3 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Enter Room Name"
          value={roomName}
          onChange={(e) => setRoomName(e.target.value)}
          required
        />
        
        {/* Room Type Selection */}
        <div className="space-y-3">
          <label className="block text-sm font-medium text-gray-700">Room Type</label>
          
          <div className="space-y-2">
            <label className="flex items-center p-3 border rounded cursor-pointer hover:bg-gray-50">
              <input
                type="radio"
                name="roomType"
                checked={isPublic}
                onChange={() => {
                  setIsPublic(true);
                  setPassword("");
                }}
                className="mr-3"
              />
              <div>
                <div className="font-medium text-green-600">🌍 Public Room</div>
                <div className="text-sm text-gray-500">Anyone can join without a password</div>
              </div>
            </label>
            
            <label className="flex items-center p-3 border rounded cursor-pointer hover:bg-gray-50">
              <input
                type="radio"
                name="roomType"
                checked={!isPublic}
                onChange={() => setIsPublic(false)}
                className="mr-3"
              />
              <div>
                <div className="font-medium text-blue-600">🔒 Private Room</div>
                <div className="text-sm text-gray-500">Requires password to join</div>
              </div>
            </label>
          </div>
        </div>

        {/* Password Input for Private Rooms */}
        {!isPublic && (
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">Room Password</label>
            <input
              type="password"
              className="w-full border p-3 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter room password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required={!isPublic}
            />
            <p className="text-xs text-gray-500">
              Share this password with people you want to invite
            </p>
          </div>
        )}
        
        {error && <div className="text-red-500 text-sm">{error}</div>}
        {success && <div className="text-green-600 text-sm">{success}</div>}
        
        <button
          className={`w-full text-white p-3 rounded transition duration-200 ${
            isPublic 
              ? "bg-green-500 hover:bg-green-600" 
              : "bg-blue-500 hover:bg-blue-600"
          }`}
          type="submit"
        >
          Create {isPublic ? 'Public' : 'Private'} Room
        </button>
      </form>
    </div>
  );
};

export default CreateRoom;
