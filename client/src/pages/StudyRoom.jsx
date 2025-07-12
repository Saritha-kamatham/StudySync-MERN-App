import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "../utils/axios";
import UserList from "../components/UserList";
import Chat from "../components/Chat";
import Timer from "../components/Timer";
import LoginModal from "../components/LoginModal";
import PasswordModal from "../components/PasswordModal";
import AlertModal from "../components/AlertModal";
import ConfirmModal from "../components/ConfirmModal";
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
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [isLeavingRoom, setIsLeavingRoom] = useState(false);
  
  // Modal states
  const [alertModal, setAlertModal] = useState({ isOpen: false, title: "", message: "", type: "info" });
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: "", message: "", onConfirm: null, type: "warning" });
  
  // Room selection for /study-room page
  const [availableRooms, setAvailableRooms] = useState([]);
  const [roomInput, setRoomInput] = useState("");

  // If we're on /study-room and not /room/:roomName
  useEffect(() => {
    const newRoom = roomName || "";
    
    // Only reset states if we're actually changing rooms, not just refreshing
    if (newRoom !== room) {
      setRoom(newRoom);
      setShowRoomSelection(!roomName);
      // Reset password modal state when room actually changes
      setShowPasswordModal(false);
      setJoinStatus("pending");
      setRoomInfo(null); // Clear previous room info
      setIsLeavingRoom(false); // Reset leaving flag
    }
  }, [roomName, room]);

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
        setAlertModal({
          isOpen: true,
          title: "Room Not Found",
          message: `Room "${roomInput.trim()}" does not exist!`,
          type: "error"
        });
        return;
      } else {
        navigate(`/room/${encodeURIComponent(roomInput.trim())}`);
      }
    } catch (error) {
      console.error("Error checking room existence:", error);
      setAlertModal({
        isOpen: true,
        title: "Error",
        message: "An error occurred while checking if this room exists.",
        type: "error"
      });
    }
  };

  // Fetch room details
  useEffect(() => {
    if (!room || showRoomSelection || isLeavingRoom) {
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
        
        // Check if room is private and user hasn't been verified (but not if leaving)
        if (!res.data.room.isPublic && 
            !isLeavingRoom &&
            !localStorage.getItem(`roomAccess_${room}`) && 
            !sessionStorage.getItem(`roomSession_${room}`)) {
          setShowPasswordModal(true);
          setLoading(false);
          return;
        }
        
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
          setAlertModal({
            isOpen: true,
            title: "Room Not Found",
            message: `Room "${room}" does not exist!`,
            type: "error"
          });
          setTimeout(() => navigate("/study-room"), 2000);
        }
      }
    };
    
    fetchRoom();
  }, [room, navigate, userInfo.id, userInfo.email]); // Removed socket from dependencies to prevent unnecessary re-runs

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
      setAlertModal({
        isOpen: true,
        title: "Session Ended",
        message: reason,
        type: "warning"
      });
      setTimeout(() => navigate("/study-room"), 3000);
    };
    
    socket.on("roomClosed", handleRoomClosed);
    
    return () => {
      socket.off("roomClosed", handleRoomClosed);
    };
  }, [socket, navigate]);

  // Handle password submission for private rooms
  const handlePasswordSubmit = async (password, username) => {
    try {
      setPasswordLoading(true);
      
      const token = localStorage.getItem("token");
      const response = await axios.post(`/api/rooms/${encodeURIComponent(room)}/verify-password`, 
        { password }, 
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      if (response.data.success) {
        // Store access token for this room in both localStorage and sessionStorage
        localStorage.setItem(`roomAccess_${room}`, 'true');
        sessionStorage.setItem(`roomSession_${room}`, 'true');
        
        // If username provided (non-authenticated user), update our local username
        if (username) {
          setUserName(username);
        }
        
        setShowPasswordModal(false);
        setPasswordLoading(false);
        
        // Continue with room joining process
        setJoinStatus("pending");
      }
    } catch (error) {
      setPasswordLoading(false);
      setAlertModal({
        isOpen: true,
        title: "Access Denied",
        message: error.response?.data?.message || "Incorrect password",
        type: "error"
      });
    }
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center p-8">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mb-4"></div>
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

  if (showPasswordModal) {
    return (
      <div className="min-h-screen bg-gray-50">
        <PasswordModal
          isOpen={showPasswordModal}
          onClose={() => {
            setShowPasswordModal(false);
            navigate("/study-room");
          }}
          onSubmit={handlePasswordSubmit}
          roomName={room || roomName || roomInfo?.name || "Unknown Room"}
          isLoading={passwordLoading}
          userInfo={userInfo}
        />
      </div>
    );
  }

  // Room selection UI
  if (showRoomSelection) {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-12">
            <h1 className="text-3xl font-bold text-gray-900 mb-4">
              Study Rooms
            </h1>
            <p className="text-lg text-gray-600">
              Join an existing room or create a new one to start studying
            </p>
          </div>
          
          <div className="card mb-8">
            <div className="card-body">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Join a Room</h2>
              <form onSubmit={handleRoomSelect}>
                <div className="flex gap-3">
                  <input
                    type="text"
                    value={roomInput}
                    onChange={(e) => setRoomInput(e.target.value)}
                    placeholder="Enter room name"
                    className="input-field flex-1"
                  />
                  <button
                    type="submit"
                    className="btn-primary"
                    disabled={loading}
                  >
                    Join Room
                  </button>
                </div>
              </form>
            </div>
          </div>
          
          <div className="card mb-8">
            <div className="card-header">
              <h2 className="text-lg font-semibold text-gray-900">Available Rooms</h2>
            </div>
            <div className="card-body">
              {loading ? (
                <div className="text-center py-8">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500 mb-2"></div>
                  <p className="text-gray-600">Loading rooms...</p>
                </div>
              ) : availableRooms.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto mb-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                  <p className="text-lg font-medium mb-2">No active rooms</p>
                  <p className="text-sm">Be the first to create a study room!</p>
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {availableRooms.map((r) => (
                    <div
                      key={r._id}
                      className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 hover:shadow-md transition-all cursor-pointer group"
                      onClick={() => {
                        setRoomInput(r.name);
                        navigate(`/room/${encodeURIComponent(r.name)}`);
                      }}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <h3 className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                          {r.name}
                        </h3>
                        <span className={`${r.isPublic ? 'badge-success' : 'badge-warning'}`}>
                          {r.isPublic ? "Public" : "Private"}
                        </span>
                      </div>
                      
                      <div className="flex items-center text-sm text-gray-600">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                        </svg>
                        {r.activeCount || 0} users active
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          
          <div className="text-center">
            <button
              onClick={() => navigate("/create-room")}
              className="btn-primary"
            >
              Create New Room
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center p-8">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mb-4"></div>
          <p className="text-lg text-gray-600">Loading room...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-6">
      <div className="max-w-6xl mx-auto px-6">
        {/* Room Header */}
        <div className="card mb-6">
          <div className="card-header">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
              <div>
                <h1 className="text-2xl font-bold text-gray-900 mb-2">{room}</h1>
                <p className="text-sm text-gray-600">
                  Joined as <span className="font-medium">{userName || userInfo.name}</span>
                </p>
              </div>
              {roomInfo && (
                <div className="flex items-center gap-3">
                  <div className="text-center">
                    <div className="text-xs text-gray-500 mb-1">Room Type</div>
                    <span className={`${roomInfo.isPublic ? 'badge-success' : 'badge-primary'}`}>
                      {roomInfo.isPublic ? 'Public' : 'Private'}
                    </span>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-gray-500 mb-1">Your Role</div>
                    <span className={`${isHost ? 'badge-warning' : 'badge-gray'}`}>
                      {isHost ? 'Host' : 'Member'}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {infoError && (
          <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg mb-6">
            {infoError}
          </div>
        )}
        
        {/* Main Content Grid */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left Column - Timer & Users */}
          <div className="lg:col-span-1 space-y-6">
            <Timer room={room} isHost={isHost} />
            <UserList room={room} />
          </div>
          
          {/* Right Column - Chat */}
          <div className="lg:col-span-2">
            <Chat room={room} userName={userName || userInfo.name} />
          </div>
        </div>
        
        {/* Room Actions */}
        <div className="mt-8 flex justify-between items-center">
          <button
            onClick={() => {
              setIsLeavingRoom(true);
              localStorage.removeItem(`roomAccess_${room}`);
              sessionStorage.removeItem(`roomSession_${room}`);
              if (socket) {
                socket.emit("leaveRoom", { room });
                setTimeout(() => navigate("/study-room"), 100);
              } else {
                navigate("/study-room");
              }
            }}
            className="btn-secondary"
          >
            Leave Room
          </button>
          
          {isHost && (
            <button
              onClick={() => {
                setConfirmModal({
                  isOpen: true,
                  title: "End Study Session",
                  message: "Are you sure you want to end this study session for everyone? This action cannot be undone.",
                  type: "danger",
                  onConfirm: () => {
                    if (socket) {
                      socket.emit("endSession", { room });
                      setTimeout(() => {
                        navigate("/study-room");
                      }, 500);
                    } else {
                      navigate("/study-room");
                    }
                    setConfirmModal({ ...confirmModal, isOpen: false });
                  }
                });
              }}
              className="btn-danger"
            >
              End Session
            </button>
          )}
        </div>
      </div>
      
      {/* Modals */}
      <AlertModal
        isOpen={alertModal.isOpen}
        title={alertModal.title}
        message={alertModal.message}
        type={alertModal.type}
        onClose={() => setAlertModal({ ...alertModal, isOpen: false })}
      />
      
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        type={confirmModal.type}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal({ ...confirmModal, isOpen: false })}
        confirmText="End Session"
        cancelText="Cancel"
      />
    </div>
  );
};

export default StudyRoom;
