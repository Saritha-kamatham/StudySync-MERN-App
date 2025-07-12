import React, { useEffect, useRef, useState } from "react";
import { useSocket } from "../contexts/SocketContext";

const Timer = ({ room, isHost }) => {
  const socket = useSocket();
  const [timer, setTimer] = useState({ running: false, seconds: 25 * 60, label: "Custom Timer" });
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customMinutes, setCustomMinutes] = useState(25);
  const [customSeconds, setCustomSeconds] = useState(0);
  const intervalRef = useRef(null);

  useEffect(() => {
    if (!socket || !room) return;
    
    const handleUpdate = (newTimer) => {
      setTimer(newTimer);
      if (newTimer.running) {
        try {
          new Audio("/sounds/start.mp3").play().catch(() => {});
        } catch (e) {}
      }
      if (!newTimer.running && newTimer.seconds === 0) {
        try {
          new Audio("/sounds/end.mp3").play().catch(() => {});
        } catch (e) {}
      }
    };
    
    socket.on("timer:update", handleUpdate);
    
    const timerStateTimer = setTimeout(() => {
      socket.emit("requestTimerState", { room });
    }, 1200);
    
    return () => {
      socket.off("timer:update", handleUpdate);
      clearTimeout(timerStateTimer);
    };
  }, [socket, room, isHost]);

  useEffect(() => {
    if (!isHost || !timer.running) return;

    const interval = setInterval(() => {
      setTimer(prev => {
        if (prev.seconds <= 1) {
          const newTimer = { ...prev, running: false, seconds: 0 };
          socket.emit("timer:tick", { room, seconds: 0 });
          return newTimer;
        }
        const newTimer = { ...prev, seconds: prev.seconds - 1 };
        socket.emit("timer:tick", { room, seconds: newTimer.seconds });
        return newTimer;
      });
    }, 1000);

    intervalRef.current = interval;
    return () => clearInterval(interval);
  }, [isHost, timer.running, room, socket]);

  const start = () => {
    if (!isHost || timer.running) return;
    const newTimer = { ...timer, running: true };
    setTimer(newTimer);
    socket.emit("timer:start", { room, timer: newTimer });
  };
  
  const pause = () => {
    if (!isHost || !timer.running) return;
    const newTimer = { ...timer, running: false };
    setTimer(newTimer);
    socket.emit("timer:pause", { room });
  };
  
  const reset = () => {
    if (!isHost) return;
    const newTimer = { running: false, seconds: 25 * 60, label: "Custom Timer" };
    setTimer(newTimer);
    socket.emit("timer:reset", { room, timer: newTimer });
  };

  const setCustomTimer = () => {
    if (!isHost) return;
    const totalSeconds = (customMinutes * 60) + customSeconds;
    if (totalSeconds <= 0) return;
    
    const newTimer = { 
      running: false, 
      seconds: totalSeconds, 
      label: `${customMinutes}:${customSeconds.toString().padStart(2, '0')}` 
    };
    setTimer(newTimer);
    socket.emit("timer:reset", { room, timer: newTimer });
    setShowCustomInput(false);
  };

  const quickSetTimer = (minutes) => {
    if (!isHost) return;
    const newTimer = { running: false, seconds: minutes * 60, label: `${minutes} min` };
    setTimer(newTimer);
    socket.emit("timer:reset", { room, timer: newTimer });
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const getTimerColor = () => {
    if (timer.seconds <= 60) return { text: "text-red-500", stroke: "#ef4444", bg: "from-red-100 to-red-50" };
    if (timer.seconds <= 300) return { text: "text-yellow-500", stroke: "#eab308", bg: "from-yellow-100 to-yellow-50" }; 
    return { text: "text-green-500", stroke: "#22c55e", bg: "from-green-100 to-green-50" };
  };

  const getProgress = () => {
    const totalSeconds = parseInt(timer.label.includes('min') ? timer.label.split(' ')[0] * 60 : 25 * 60);
    return ((totalSeconds - timer.seconds) / totalSeconds) * 100;
  };

  const colors = getTimerColor();

  return (
    <div className="bg-white shadow-lg rounded-xl p-6 mb-4 border border-gray-100">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold flex items-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Pomodoro Timer
        </h3>
        <div className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full font-medium">
          {timer.label}
        </div>
      </div>
      
      {/* Circular Timer */}
      <div className="flex justify-center mb-6">
        <div className="relative">
          <svg className="w-40 h-40 transform -rotate-90" viewBox="0 0 100 100">
            {/* Background circle */}
            <circle
              cx="50"
              cy="50"
              r="45"
              stroke="currentColor"
              strokeWidth="6"
              fill="none"
              className="text-gray-200"
            />
            {/* Progress circle */}
            <circle
              cx="50"
              cy="50"
              r="45"
              stroke={colors.stroke}
              strokeWidth="6"
              fill="none"
              strokeDasharray={`${2 * Math.PI * 45}`}
              strokeDashoffset={`${2 * Math.PI * 45 * (1 - getProgress() / 100)}`}
              strokeLinecap="round"
              className="transition-all duration-1000 ease-in-out"
            />
          </svg>
          
          {/* Center content */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className={`text-3xl font-bold ${colors.text}`}>
              {formatTime(timer.seconds)}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {timer.running ? "Running" : "Paused"}
            </div>
          </div>
        </div>
      </div>
      
      {isHost ? (
        <div className="space-y-4">
          <div className="flex justify-center space-x-3">
            <button
              onClick={timer.running ? pause : start}
              className={`px-6 py-3 rounded-full font-medium transition-all transform hover:scale-105 shadow-lg flex items-center space-x-2 ${
                timer.running 
                  ? "bg-yellow-500 hover:bg-yellow-600 text-white shadow-yellow-200" 
                  : "bg-green-500 hover:bg-green-600 text-white shadow-green-200"
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                {timer.running ? (
                  <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
                ) : (
                  <path d="M8 5v14l11-7z"/>
                )}
              </svg>
              <span>{timer.running ? "Pause" : "Start"}</span>
            </button>
            <button
              onClick={reset}
              className="px-6 py-3 bg-gray-500 hover:bg-gray-600 text-white rounded-full font-medium transition-all transform hover:scale-105 shadow-lg shadow-gray-200 flex items-center space-x-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span>Reset</span>
            </button>
          </div>
          
          <div className="flex justify-center space-x-2 flex-wrap">
            {[5, 15, 25, 45, 60].map(minutes => (
              <button
                key={minutes}
                onClick={() => quickSetTimer(minutes)}
                className="px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-sm font-medium transition-all border border-blue-200 hover:border-blue-300"
              >
                {minutes}m
              </button>
            ))}
          </div>
          
          <div className="text-center">
            <button
              onClick={() => setShowCustomInput(!showCustomInput)}
              className="text-blue-600 hover:text-blue-800 text-sm font-medium flex items-center mx-auto space-x-1 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4" />
              </svg>
              <span>{showCustomInput ? "Hide Custom Timer" : "Custom Timer"}</span>
            </button>
          </div>
          
          {showCustomInput && (
            <div className="bg-gradient-to-br from-blue-50 to-gray-50 p-4 rounded-xl border border-blue-100">
              <div className="flex items-center justify-center space-x-2 mb-4">
                <div className="flex flex-col items-center">
                  <label className="text-xs text-gray-600 mb-1">Minutes</label>
                  <input
                    type="number"
                    min="0"
                    max="180"
                    value={customMinutes}
                    onChange={(e) => setCustomMinutes(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-16 p-2 border border-gray-300 rounded-lg text-center text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Min"
                  />
                </div>
                <span className="text-gray-600 font-bold text-lg mt-4">:</span>
                <div className="flex flex-col items-center">
                  <label className="text-xs text-gray-600 mb-1">Seconds</label>
                  <input
                    type="number"
                    min="0"
                    max="59"
                    value={customSeconds}
                    onChange={(e) => setCustomSeconds(Math.max(0, Math.min(59, parseInt(e.target.value) || 0)))}
                    className="w-16 p-2 border border-gray-300 rounded-lg text-center text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Sec"
                  />
                </div>
              </div>
              <button
                onClick={setCustomTimer}
                className="w-full bg-gradient-to-r from-blue-600 to-gray-600 hover:from-blue-700 hover:to-gray-700 text-white py-3 rounded-lg text-sm font-medium transition-all shadow-lg transform hover:scale-105"
              >
                Set Custom Timer
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="text-center">
          <div className={`inline-flex items-center px-6 py-3 rounded-full text-sm font-medium ${
            timer.running 
              ? "bg-green-50 text-green-700 border border-green-200" 
              : "bg-gray-50 text-gray-600 border border-gray-200"
          }`}>
            <div className={`w-2 h-2 rounded-full mr-2 ${
              timer.running ? "bg-green-500 animate-pulse" : "bg-gray-400"
            }`}></div>
            {timer.running ? "Timer is running..." : "Waiting for host to start timer"}
          </div>
        </div>
      )}
    </div>
  );
};

export default Timer;
