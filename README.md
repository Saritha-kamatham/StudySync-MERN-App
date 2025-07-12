# StudySync - MERN Study Room Application 🎓

A modern, professional study room application built with the MERN stack, featuring real-time chat, Pomodoro timer, and collaborative study sessions.

## ✨ Features

- **Real-time Study Rooms**: Create and join study rooms with other users
- **Pomodoro Timer**: Beautiful circular timer with multiple presets
- **Live Chat**: WhatsApp/Instagram-style messaging interface
- **User Authentication**: Secure JWT-based authentication
- **Room Management**: Public and private rooms with password protection
- **Responsive Design**: Professional UI that works on all devices
- **Real-time Updates**: Socket.IO for instant synchronization

## 🚀 Tech Stack

### Frontend
- **React 19** - Modern UI library
- **Vite** - Fast build tool
- **Tailwind CSS** - Utility-first CSS framework
- **React Router** - Client-side routing
- **Socket.IO Client** - Real-time communication
- **Axios** - HTTP client

### Backend
- **Node.js** - JavaScript runtime
- **Express.js** - Web framework
- **MongoDB** - NoSQL database
- **Socket.IO** - Real-time communication
- **JWT** - Authentication
- **bcryptjs** - Password hashing

## 📦 Installation

### Prerequisites
- Node.js (v16 or higher)
- MongoDB Atlas account (or local MongoDB)
- Git

### Local Development

1. **Clone the repository**
   ```bash
   git clone https://github.com/Saksham2509/StudySync-Mern-Project.git
   cd StudySync-Mern-Project
   ```

2. **Install dependencies**
   ```bash
   # Install server dependencies
   cd server
   npm install
   
   # Install client dependencies
   cd ../client
   npm install
   ```

3. **Environment Setup**
   ```bash
   # Server environment variables
   cd server
   cp .env.example .env
   # Edit .env with your MongoDB URI and JWT secret
   
   # Client environment variables (optional for local development)
   cd ../client
   cp .env.example .env.local
   # Edit if you need custom API URL
   ```

4. **Start the application**
   ```bash
   # Start server (from server directory)
   npm run dev
   
   # Start client (from client directory)
   npm run dev
   ```

5. **Access the application**
   - Frontend: http://localhost:5173
   - Backend: http://localhost:5000

## 🌐 Deployment

### Vercel Deployment (Recommended)

1. **Prepare for deployment**
   ```bash
   # Make sure all changes are committed
   git add .
   git commit -m "Ready for deployment"
   git push origin main
   ```

2. **Deploy to Vercel**
   - Connect your GitHub repository to Vercel
   - Set environment variables in Vercel dashboard:
     - `MONGO_URI`: Your MongoDB connection string
     - `JWT_SECRET`: Your JWT secret key
     - `VITE_API_URL`: Your Vercel app URL (e.g., https://your-app.vercel.app)

3. **Configuration**
   - The `vercel.json` file is already configured
   - Both frontend and backend will be deployed together

### Environment Variables

#### Server (.env)
```
PORT=5000
MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/studysync
JWT_SECRET=your-super-secret-jwt-key
```

#### Client (.env.local) - Optional
```
VITE_API_URL=https://your-backend-url.vercel.app
```

## 🎯 Usage

1. **Create an Account**: Sign up with your email and password
2. **Join/Create Rooms**: Browse available study rooms or create your own
3. **Start Studying**: Use the Pomodoro timer and chat with fellow students
4. **Stay Focused**: Collaborate and stay motivated with others

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 👨‍💻 Developer

**Saksham** - [GitHub](https://github.com/Saksham2509)

## 🙏 Acknowledgments

- Built with modern React patterns and best practices
- Inspired by collaborative study platforms
- UI/UX designed for optimal study sessions

---

⭐ Star this repository if you found it helpful!