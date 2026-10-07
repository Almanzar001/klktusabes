import React, { useState } from 'react'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import AuthScreen from './components/AuthScreen'
import WelcomeScreen from './components/WelcomeScreen'
import CreateRoom from './components/CreateRoom'
import JoinRoom from './components/JoinRoom'
import SinglePlayerGame from './components/SinglePlayerGame'
import QRGameAccess from './components/QRGameAccess'
import AdminPanel from './components/AdminPanel'
import MultiplayerRoom from './components/MultiplayerRoom'
import { Room, Player } from './types'
import './index.css'

type AppView = 'welcome' | 'create-room' | 'join-room' | 'single-player' | 'qr-access' | 'admin' | 'game-room'

const AppContent: React.FC = () => {
  const { user, loading } = useAuth()
  const [currentView, setCurrentView] = useState<AppView>('welcome')
  const [currentRoom, setCurrentRoom] = useState<Room | null>(null)
  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null)
  const [isQRAccess, setIsQRAccess] = useState(false)

  // Verificar si llegamos desde una URL con código QR
  React.useEffect(() => {
    const hash = window.location.hash
    if (hash.includes('qr-game/')) {
      setIsQRAccess(true)
      setCurrentView('qr-access')
    }
  }, [])

  // Mostrar loading mientras se verifica la autenticación (excepto para acceso QR)
  if (loading && !isQRAccess) {
    return (
      <div className="min-h-screen fondo-caribe flex items-center justify-center">
        <div className="text-center">
          <div className="loading-spinner mx-auto mb-4"></div>
          <h2 className="font-display text-3xl text-dominican-blue">KLKTUSABES</h2>
          <p className="text-gray-600 font-semibold mt-1">Preparando la trivia dominicana…</p>
        </div>
      </div>
    )
  }

  // Si no hay usuario y no es acceso QR, mostrar pantalla de autenticación
  if (!user && !isQRAccess) {
    return <AuthScreen />
  }

  // Navegación entre vistas
  const handleNavigate = (view: AppView) => {
    setCurrentView(view)
  }

  const handleBackToWelcome = () => {
    // Si venimos de acceso QR, redirigir al QR access en lugar del welcome
    if (isQRAccess) {
      setCurrentView('qr-access')
    } else {
      setCurrentView('welcome')
    }
    setCurrentRoom(null)
    setCurrentPlayer(null)
  }

  // player es null cuando quien creó la sala solo dirige la partida y no juega
  const handleJoinRoom = (room: Room, player: Player | null) => {
    setCurrentRoom(room)
    setCurrentPlayer(player)
    setCurrentView('game-room')
  }

  // Renderizar vista actual
  const renderCurrentView = () => {
    switch (currentView) {
      case 'welcome':
        return <WelcomeScreen onNavigate={handleNavigate} />
      
      case 'create-room':
        return (
          <CreateRoom 
            onBack={handleBackToWelcome}
            onJoinRoom={handleJoinRoom}
          />
        )
      
      case 'join-room':
        return (
          <JoinRoom 
            onBack={handleBackToWelcome}
            onJoinRoom={handleJoinRoom}
          />
        )
      
      case 'single-player':
        return (
          <SinglePlayerGame onBack={handleBackToWelcome} />
        )
      
      case 'qr-access':
        return (
          <QRGameAccess 
            onBack={() => {
              if (isQRAccess) {
                // Si venimos de URL QR, limpiar la URL y salir completamente
                window.location.hash = ''
                window.location.reload()
              } else {
                handleBackToWelcome()
              }
            }} 
          />
        )
      
      case 'admin':
        return (
          <AdminPanel onBack={handleBackToWelcome} />
        )

      case 'game-room':
        if (!currentRoom) {
          return <WelcomeScreen onNavigate={handleNavigate} />
        }
        return (
          <MultiplayerRoom
            room={currentRoom}
            player={currentPlayer}
            onBack={handleBackToWelcome}
          />
        )
      
      default:
        return <WelcomeScreen onNavigate={handleNavigate} />
    }
  }

  return (
    <div className="App">
      {renderCurrentView()}
    </div>
  )
}

const App: React.FC = () => {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}

export default App