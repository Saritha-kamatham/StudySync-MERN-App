import React, { useState, useEffect, useCallback } from "react";
import { useSocket } from '../contexts/SocketContext';
import { useAuth } from '../contexts/AuthContext';
import axios from '../utils/axios';

// RoomJoin emits 'joinRoom' with userName and room
const RoomJoin = ({ setRoom, setIsHost, setUserName }) => {
  const [roomInput, setRoomInput] = useState("");
  const [nameInput, setNameInput] = useState("");
  const [host, setHost] = useState(false);
  const [availableRooms, setAvailableRooms] = useState([]);
  const [showRoomList, setShowRoomList] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  
  const socket = useSocket();
  const { getUserInfo } = useAuth();

  const handleJoin = (e) => {
    e.preventDefault();
    if (!roomInput || !nameInput || !socket) return;
    setRoom(roomInput);
    setUserName(nameInput);
    setIsHost(host);
    // Send userName and room to backend
    socket.emit("joinRoom", { room: roomInput, userName: nameInput });
  };

  // Fetch available rooms
  const fetchAvailableRooms = useCallback(async () => {
    const token = localStorage.getItem("token");
    if (!token) return;
    
    setLoading(true);
    try {
      const res = await axios.get("/api/rooms", {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Cache-Control': 'no-cache'
        },
      });
      
      console.log("✅ Fetched rooms:", res.data.rooms);
      setAvailableRooms(res.data.rooms || []);
      setLoading(false);
    } catch (err) {
      console.error("Failed to fetch rooms:", err);
      setError("Failed to fetch available rooms");
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAvailableRooms();
  }, [fetchAvailableRooms]);

  // Listen for room changes to refresh the room list
  useEffect(() => {
    if (!socket) return;

    const handleRoomChanged = ({ room }) => {
      console.log(`Room ${room} changed - refreshing room list in RoomJoin`);
      fetchAvailableRooms();
    };

    socket.on('roomChanged', handleRoomChanged);

    return () => {
      socket.off('roomChanged', handleRoomChanged);
    };
  }, [socket, fetchAvailableRooms]);

  // Handle room selection - THIS IS THE CRITICAL FUNCTION
  const handleRoomSelect = (room) => {
    console.log("🎯 ROOM CARD CLICKED - SIMPLE TEST!");
    console.log("Room:", room.name);
    console.log("Is Public:", room.isPublic);
    
    if (!nameInput.trim()) {
      setError("Please enter your name first!");
      return;
    }
    
    // All rooms are now public - join directly
    console.log("✅ Public room - joining directly");
    setRoomInput(room.name);
    setRoom(room.name);
    setUserName(nameInput);
    setIsHost(false);
    socket.emit("joinRoom", { room: room.name, userName: nameInput });
  };

  return (
    <div className="flex flex-col gap-4 max-w-md mx-auto mt-10">
      <form className="flex flex-col gap-2" onSubmit={handleJoin}>
        <input
          className="border p-2 rounded"
          placeholder="Your Name"
          value={nameInput}
          onChange={e => setNameInput(e.target.value)}
        />
        <input
          className="border p-2 rounded"
          placeholder="Room Name"
          value={roomInput}
          onChange={e => setRoomInput(e.target.value)}
        />
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={host} onChange={e => setHost(e.target.checked)} />
          Join as Host
        </label>
        <button className="bg-blue-500 text-white p-2 rounded hover:bg-blue-600" type="submit" disabled={!socket}>
          {socket ? "Join Room" : "Connecting..."}
        </button>
      </form>

      {error && <div className="text-red-500 text-sm">{error}</div>}

      {/* Show/Hide Room List Button */}
      <button 
        type="button" 
        className="text-blue-500 underline"
        onClick={() => {
          console.log("🔘 Show rooms button clicked");
          setShowRoomList(!showRoomList);
          if (!showRoomList) {
            fetchAvailableRooms();
          }
        }}
      >
        {showRoomList ? "Hide available rooms" : "Show available rooms"}
      </button>

      {/* Available Rooms List */}
      {showRoomList && (
        <div className="border rounded p-4">
          <h3 className="font-medium mb-2">Available Rooms:</h3>
          {loading ? (
            <p className="text-gray-500">Loading rooms...</p>
          ) : availableRooms.length === 0 ? (
            <p className="text-gray-500">No rooms available</p>
          ) : (
            <div className="space-y-2">
              {availableRooms.map((room) => {
                console.log("🏠 Rendering room:", room.name, "isPublic:", room.isPublic);
                return (
                  <div
                    key={room.name}
                    className="border p-3 rounded cursor-pointer hover:bg-blue-50 transition-colors"
                    onClick={() => {
                      console.log("🎯 CLICK DETECTED - Room:", room.name, "isPublic:", room.isPublic);
                      handleRoomSelect(room);
                    }}
                  >
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{room.name}</span>
                        <span className="text-green-600 text-xs bg-green-100 px-2 py-1 rounded">
                          🌍 Public
                        </span>
                      </div>
                      <span className="text-sm text-gray-500">
                        {room.activeCount || 0} users
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default RoomJoin;
