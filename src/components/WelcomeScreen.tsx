import React, { useState, useEffect } from 'react'
import { Users, Gamepad2, QrCode, Settings, LogOut, Crown, User } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { statsHelpers } from '../insforge'

interface WelcomeScreenProps {
  onNavigate: (view: 'create-room' | 'join-room' | 'single-player' | 'qr-access' | 'admin') => void
}

const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onNavigate }) => {
  const { userProfile, signOut, isCreator } = useAuth()
  
  // Estados para estadísticas
  const [stats, setStats] = useState({
    activeUsers: 0,
    totalGames: 0,
    totalMatches: 0
  })
  const [loadingStats, setLoadingStats] = useState(true)

  // Cargar estadísticas al montar el componente
  useEffect(() => {
    loadAppStatistics()
  }, [])

  const loadAppStatistics = async () => {
    try {
      setLoadingStats(true)
      const { data, error } = await statsHelpers.getAppStatistics()
      
      if (error) {
        console.error('Error cargando estadísticas:', error)
        // Mantener valores por defecto en caso de error
        return
      }

      if (data) {
        setStats({
          activeUsers: data.activeUsers,
          totalGames: data.totalGames,
          totalMatches: data.totalMatches
        })
      }
    } catch (err) {
      console.error('Error inesperado cargando estadísticas:', err)
    } finally {
      setLoadingStats(false)
    }
  }

  const gameOptions = [
    {
      id: 'create-room',
      title: 'Crear Sala',
      description: 'Inicia una nueva partida multijugador',
      icon: Users,
      color: 'dominican-blue',
      action: () => onNavigate('create-room')
    },
    {
      id: 'join-room',
      title: 'Unirse a Sala',
      description: 'Únete a una partida existente',
      icon: Gamepad2,
      color: 'dominican-red',
      action: () => onNavigate('join-room')
    },
    {
      id: 'single-player',
      title: 'Juego Individual',
      description: 'Practica con cualquier trivia',
      icon: User,
      color: 'green-600',
      action: () => onNavigate('single-player')
    },
    {
      id: 'qr-access',
      title: 'Acceso QR',
      description: 'Escanea un código QR para jugar',
      icon: QrCode,
      color: 'purple-600',
      action: () => onNavigate('qr-access')
    }
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100">
      {/* Header con información del usuario */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-dominican-blue">KLKTUSABES</h1>
              <p className="text-gray-600">🇩🇴 Trivia Dominicana</p>
            </div>
            
            <div className="flex items-center gap-4">
              {/* Información del usuario */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-dominican-blue rounded-full flex items-center justify-center">
                  <span className="text-white font-semibold">
                    {userProfile?.full_name?.charAt(0)?.toUpperCase() || 'U'}
                  </span>
                </div>
                <div className="hidden md:block">
                  <p className="font-semibold text-gray-800">
                    {userProfile?.full_name || 'Usuario'}
                  </p>
                  <div className="flex items-center gap-1">
                    {isCreator && <Crown className="w-4 h-4 text-yellow-500" />}
                    <p className="text-sm text-gray-600 capitalize">
                      {userProfile?.role || 'participante'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Botones de acción */}
              <div className="flex items-center gap-2">
                {isCreator && (
                  <button
                    onClick={() => onNavigate('admin')}
                    className="btn-dominican-outline py-2 px-4 text-sm"
                  >
                    <Settings className="w-4 h-4 mr-2" />
                    Panel Admin
                  </button>
                )}
                
                <button
                  onClick={signOut}
                  className="text-gray-600 hover:text-red-600 p-2 rounded-lg hover:bg-gray-100 transition-colors"
                  title="Cerrar sesión"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Contenido principal */}
      <div className="max-w-6xl mx-auto px-6 py-12">
        {/* Mensaje de bienvenida */}
        <div className="text-center mb-12">
          <h2 className="text-4xl md:text-5xl font-bold text-gray-800 mb-4">
            ¡Bienvenido, {userProfile?.full_name?.split(' ')[0] || 'Tiguer'}! 👋
          </h2>
          <p className="text-xl text-gray-600 mb-2">
            ¿Qué quieres hacer hoy?
          </p>
          <p className="text-gray-500">
            Escoge una opción para comenzar la diversión
          </p>
        </div>

        {/* Opciones de juego */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {gameOptions.map((option) => (
            <div
              key={option.id}
              onClick={option.action}
              className="bg-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer hover:scale-105 group"
            >
              <div className={`w-16 h-16 bg-${option.color} rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform`}>
                <option.icon className="w-8 h-8 text-white" />
              </div>
              
              <h3 className="text-xl font-bold text-gray-800 mb-3">
                {option.title}
              </h3>
              
              <p className="text-gray-600 text-sm leading-relaxed">
                {option.description}
              </p>
            </div>
          ))}
        </div>

        {/* Estadísticas rápidas */}
        <div className="bg-white rounded-2xl p-8 shadow-lg">
          <h3 className="text-2xl font-bold text-gray-800 mb-6 text-center">
            🎯 Estadísticas del Juego
          </h3>
          
          <div className="grid md:grid-cols-3 gap-6 text-center">
            <div className="p-4">
              <div className="text-3xl font-bold text-dominican-blue mb-2">
                {loadingStats ? (
                  <div className="animate-pulse bg-gray-300 h-8 w-16 mx-auto rounded"></div>
                ) : (
                  `${stats.activeUsers}${stats.activeUsers > 0 ? '+' : ''}`
                )}
              </div>
              <p className="text-gray-600">Jugadores Activos</p>
            </div>
            
            <div className="p-4">
              <div className="text-3xl font-bold text-dominican-red mb-2">
                {loadingStats ? (
                  <div className="animate-pulse bg-gray-300 h-8 w-16 mx-auto rounded"></div>
                ) : (
                  stats.totalGames
                )}
              </div>
              <p className="text-gray-600">Trivias Disponibles</p>
            </div>
            
            <div className="p-4">
              <div className="text-3xl font-bold text-green-600 mb-2">
                {loadingStats ? (
                  <div className="animate-pulse bg-gray-300 h-8 w-16 mx-auto rounded"></div>
                ) : (
                  stats.totalMatches.toLocaleString()
                )}
              </div>
              <p className="text-gray-600">Partidas Jugadas</p>
            </div>
          </div>
        </div>

        {/* Instrucciones rápidas */}
        <div className="mt-12 bg-gradient-to-r from-dominican-blue to-dominican-blue-light rounded-2xl p-8 text-white">
          <h3 className="text-2xl font-bold mb-6 text-center">
            🚀 ¿Cómo Jugar?
          </h3>
          
          <div className="grid md:grid-cols-3 gap-6 text-center">
            <div>
              <div className="text-4xl mb-3">1️⃣</div>
              <h4 className="font-semibold mb-2">Escoge tu Modo</h4>
              <p className="text-blue-100 text-sm">
                Crea una sala, únete a una existente, o juega solo
              </p>
            </div>
            
            <div>
              <div className="text-4xl mb-3">2️⃣</div>
              <h4 className="font-semibold mb-2">Invita Amigos</h4>
              <p className="text-blue-100 text-sm">
                Comparte el código de sala o código QR
              </p>
            </div>
            
            <div>
              <div className="text-4xl mb-3">3️⃣</div>
              <h4 className="font-semibold mb-2">¡A Jugar!</h4>
              <p className="text-blue-100 text-sm">
                Responde las preguntas y compite por el primer lugar
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="bg-gray-800 text-white py-8">
        <div className="max-w-6xl mx-auto px-6 text-center">
          <p className="text-gray-300 mb-2">
            Hecho con ❤️ para la comunidad dominicana
          </p>
          <div className="flex justify-center items-center gap-2">
            <span className="text-2xl">🇩🇴</span>
            <span className="text-gray-300">KLKTUSABES v1.0</span>
            <span className="text-2xl">🇩🇴</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default WelcomeScreen