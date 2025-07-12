import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "../utils/axios";
import UserList from "../components/UserList";
import Chat from "../components/Chat";
import Timer from "../components/Timer";
import LoginModal from "../components/LoginModal";
import { useSocket } from "../contexts/SocketContext";
import { useAuth } from "../contexts/AuthContext";

const StudyRoom = () => {
  const navigate = useNavigate();
  const { roomName } = useParams();
  const [room, setRoom] = useState(roomName || "");
  const [isHost, setIsHost] = useState(false);
  const [roomInfo, setRoomInfo] = useState(null);
  const [infoError, setInfoError] = useState("");
  const [loading, setLoading] = useState(true);
  const [joinStatus, setJoinStatus] = useState("pending");
  const socket = useSocket();
  const { getUserInfo, loading: authLoading } = useAuth();
  const userInfo = getUserInfo();
  const [userName, setUserName] = useState("");
  const [showRoomSelection, setShowRoomSelection] = useState(!roomName);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [redirectPath, setRedirectPath] = useState('');
  
  // Room selection for /study-room page
  const [availableRooms, setAvailableRooms] = useState([]);
  const [roomInput, setRoomInput] = useState("");

  // If we're on /study-room and not /room/:roomName
  useEffect(() => {
    setRoom(roomName || "");
    setShowRoomSelection(!roomName);
  }, [roomName]);

  // Check if user is authenticated
  useEffect(() => {
    if (authLoading) return;
    
    if (!userInfo || !userInfo.id) {
      setRedirectPath(window.location.pathname);
      setShowLoginModal(true);
    } else {
      if (userInfo.name && userInfo.name !== 'Anonymous User') {
        setUserName(userInfo.name);
      }
      setShowLoginModal(false);
    }
  }, [userInfo, authLoading]);

  // Fetch available rooms when on the study-room page
  useEffect(() => {
    if (showRoomSelection) {
      const fetchAvailableRooms = async () => {
        try {
          setLoading(true);
          const token = localStorage.getItem("token");
          const res = await axios.get(`/api/rooms`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          setAvailableRooms(res.data.rooms || []);
        } catch (err) {
          console.error("Failed to fetch rooms:", err);
        } finally {
          setLoading(false);
        }
      };
      
      fetchAvailableRooms();
    }
  }, [showRoomSelection]);

  // Handle form submission for room selection
  const handleRoomSelect = async (e) => {
    e.preventDefault();
    
    if (!roomInput.trim()) return;
    
    try {
      const token = localStorage.getItem("token");
      const response = await axios.get(`/api/rooms/${encodeURIComponent(roomInput.trim())}`, {
        headers: { Authorization: `Bearer ${token}` }
      }).catch(error => {
        if (error.response && error.response.status === 404) {
          return { data: null };
        }
        throw error;
      });
      
      const roomExists = response.data && response.data.room;
      
      if (!roomExists) {
        alert(`Room "${roomInput.trim()}" does not exist!`);
        return;
      } else {
        navigate(`/room/${encodeURIComponent(roomInput.trim())}`);
      }
    } catch (error) {
      console.error("Error checking room existence:", error);
      alert("An error occurred while checking if this room exists.");
    }
  };

  // Fetch room details
  useEffect(() => {
    if (!room || showRoomSelection) {
      return;
    }
    
    const fetchRoom = async () => {
      try {
        setLoading(true);
        
        const token = localStorage.getItem("token");
        const res = await axios.get(`/api/rooms/${encodeURIComponent(room)}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        
        setRoomInfo(res.data.room);
        setInfoError("");
        
        // Check if current user is the host
        if (
          res.data.room.host === userInfo.id || 
          res.data.room.host === userInfo.email ||
          (localStorage.getItem("createdRoom") === room)
        ) {
          setIsHost(true);
          
          if (socket) {
            socket.emit("setRoomHost", { room, userId: userInfo.id });
          }
        }
        
        setLoading(false);
      } catch (err) {
        setInfoError(
          err.response?.data?.message || "Could not fetch room info."
        );
        setLoading(false);
        
        if (err.response?.status === 404) {
          alert(`Room "${room}" does not exist!`);
          navigate("/study-room");
        }
      }
    };
    
    fetchRoom();
  }, [room, navigate, userInfo.id, userInfo.email, socket]);

  // Handle socket connection and room joining
  useEffect(() => {
    if (!socket || !room || joinStatus !== "pending") return;
    
    const handleJoinRoom = () => {
      try {
        const joinData = { 
          room,
          userName: userName || userInfo.name,
          asHost: isHost
        };
        socket.emit("joinRoom", joinData);
        setJoinStatus("joined");
      } catch (err) {
        console.error("Error joining room:", err);
        setInfoError("Failed to join the room. Please try again.");
      }
    };
    
    handleJoinRoom();
  }, [socket, room, userName, userInfo.name, isHost, joinStatus]);

  // Handle room closed event
  useEffect(() => {
    if (!socket) return;
    
    const handleRoomClosed = ({ reason }) => {
      alert(reason);
      navigate("/study-room");
    };
    
    socket.on("roomClosed", handleRoomClosed);
    
    return () => {
      socket.off("roomClosed", handleRoomClosed);
    };
  }, [socket, navigate]);

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center p-8">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500 mb-4"></div>
          <p className="text-lg text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (showLoginModal) {
    return (
      <div className="min-h-screen bg-gray-50">
        <LoginModal 
          isOpen={showLoginModal}
          onClose={() => {
            setShowLoginModal(false);
            if (!userInfo || !userInfo.id) {
              navigate('/');
            }
          }}
          redirectAfterLogin={redirectPath}
        />
      </div>
    );
  }

  // Room selection UI
  if (showRoomSelection) {
    return (
      <div className="max-w-4xl mx-auto p-6 min-h-screen bg-gray-50">
        <div className="bg-white shadow-lg rounded-lg p-6 mb-6">
          <h1 className="text-3xl font-bold mb-6 text-center text-purple-700">
            Study Rooms
          </h1>
          
          <form onSubmit={handleRoomSelect} className="mb-8">
            <div className="flex gap-2 mb-4">
              <input
                type="text"
                value={roomInput}
                onChange={(e) => setRoomInput(e.target.value)}
                placeholder="Enter room name"
                className="flex-1 p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
              <button
                type="submit"
                className="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700 transition-colors"
                disabled={loading}
              >
                Join
              </button>
            </div>
          </form>
          
          <h2 className="text-xl font-semibold mb-4">Available Rooms:</h2>
          
          {loading ? (
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-purple-500 mb-2"></div>
              <p>Loading rooms...</p>
            </div>
          ) : availableRooms.length === 0 ? (
            <p className="text-gray-500 text-center py-4">No active study rooms available.</p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {availableRooms.map((r) => (
                <div
                  key={r._id}
                  className="border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => {
                    setRoomInput(r.name);
                    navigate(`/room/${encodeURIComponent(r.name)}`);
                  }}
                >
                  <h3 className="font-medium text-lg mb-1">{r.name}</h3>
                  <p className="text-sm text-gray-600">
                    {r.isPublic ? "Public" : "Private"} • {r.activeCount || 0} active users
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
        
        <div className="text-center">
          <button
            onClick={() => navigate("/create-room")}
            className="bg-green-600 text-white px-6 py-2 rounded hover:bg-green-700 transition-colors shadow-md"
          >
            Create a New Room
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center p-8">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500 mb-4"></div>
          <p className="text-lg text-gray-600">Loading room...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-2">Room: {room}</h1>
      {roomInfo && (
        <div className="mb-4 bg-white shadow rounded p-4">
          <h2 className="font-semibold text-lg mb-2">Room Information</h2>
          <div className="grid grid-cols-2 gap-2">
            <div className="text-gray-600">Name:</div>
            <div>{roomInfo.name}</div>
            
            <div className="text-gray-600">Status:</div>
            <div>{roomInfo.isPublic ? 
              <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-medium">Public</span> : 
              <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs font-medium">Private</span>}
            </div>
            
            <div className="text-gray-600">Your Role:</div>
            <div>{isHost ? 
              <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded-full text-xs font-medium">Host</span> : 
              <span className="bg-gray-100 text-gray-800 px-2 py-1 rounded-full text-xs font-medium">Member</span>}
            </div>
            
            <div className="text-gray-600">Joined As:</div>
            <div>{userName || userInfo.name}</div>
          </div>
        </div>
      )}
      
      {infoError && <div className="text-red-500 text-sm mb-2">{infoError}</div>}
      
      <UserList room={room} />
      <Timer room={room} isHost={isHost} />
      <Chat room={room} userName={userName || userInfo.name} />
      
      <div className="mt-6 flex justify-between">
        <button
          className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
          onClick={() => {
            if (socket) {
              socket.emit("leaveRoom", { room });
              setTimeout(() => navigate("/study-room"), 100);
            } else {
              navigate("/study-room");
            }
          }}
        >
          Leave Room
        </button>
        
        {isHost && (
          <button
            className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
            onClick={() => {
              if (window.confirm("Are you sure you want to end this study session for everyone?")) {
                if (socket) {
                  socket.emit("endSession", { room });
                  setTimeout(() => {
                    navigate("/study-room");
                  }, 500);
                } else {
                  navigate("/study-room");
                }
              }
            }}
          >
            End Session
          </button>
        )}
      </div>
    </div>
  );
};

export default StudyRoom;
