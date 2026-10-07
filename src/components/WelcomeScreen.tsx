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

  // Los cuatro modos de juego, con los mismos colores que las respuestas de la partida
  const gameOptions = [
    {
      id: 'create-room',
      title: 'Crear Sala',
      description: 'Inicia una partida y comparte el código',
      icon: Users,
      color: 'bg-dominican-red',
      iconColor: 'text-dominican-red',
      action: () => onNavigate('create-room')
    },
    {
      id: 'join-room',
      title: 'Unirse a Sala',
      description: 'Entra con el código de una partida',
      icon: Gamepad2,
      color: 'bg-larimar',
      iconColor: 'text-larimar',
      action: () => onNavigate('join-room')
    },
    {
      id: 'single-player',
      title: 'Juego Individual',
      description: 'Practica con cualquier trivia',
      icon: User,
      color: 'bg-ambar',
      iconColor: 'text-ambar',
      action: () => onNavigate('single-player')
    },
    {
      id: 'qr-access',
      title: 'Acceso QR',
      description: 'Escanea un código QR para jugar',
      icon: QrCode,
      color: 'bg-palma',
      iconColor: 'text-palma',
      action: () => onNavigate('qr-access')
    }
  ]

  return (
    <div className="min-h-screen flex flex-col fondo-caribe text-dominican-blue-dark">
      {/* Header con información del usuario */}
      <header className="cabecera">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h1 className="font-display text-3xl leading-none">KLKTUSABES</h1>
              <p className="text-xs font-semibold text-white/80">Trivia dominicana</p>
            </div>
            
            <div className="flex items-center gap-3">
              {/* Información del usuario */}
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shrink-0">
                  <span className="font-display text-xl text-dominican-blue">
                    {userProfile?.full_name?.charAt(0)?.toUpperCase() || 'U'}
                  </span>
                </div>
                <div className="hidden md:block">
                  <p className="font-bold leading-tight">
                    {userProfile?.full_name || 'Usuario'}
                  </p>
                  <div className="flex items-center gap-1">
                    {isCreator && <Crown className="w-4 h-4 text-yellow-300" />}
                    <p className="text-xs font-semibold text-white/80 capitalize">
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
                    className="btn-dominican-outline py-2 px-4 text-sm gap-2"
                    title="Panel Admin"
                    aria-label="Panel Admin"
                  >
                    <Settings className="w-4 h-4" />
                    <span className="hidden sm:inline">Panel Admin</span>
                  </button>
                )}
                
                <button
                  onClick={signOut}
                  className="p-2 rounded-full bg-white/15 hover:bg-white/25 transition-colors"
                  title="Cerrar sesión"
                  aria-label="Cerrar sesión"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Contenido principal */}
      <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        {/* Mensaje de bienvenida */}
        <div className="text-center mb-8 sm:mb-10">
          <h2 className="font-display text-4xl md:text-6xl text-dominican-blue mb-2">
            ¡Klk, {userProfile?.full_name?.split(' ')[0] || 'tiguer'}!
          </h2>
          <p className="text-lg sm:text-xl font-semibold text-gray-600">
            ¿Qué quieres hacer hoy?
          </p>
        </div>

        {/* Opciones de juego */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5 mb-10">
          {gameOptions.map((option) => (
            <button
              key={option.id}
              onClick={option.action}
              className={`${option.color} tablita group flex flex-col items-center text-center rounded-2xl border-4 border-white px-3 py-6 sm:p-8 text-white shadow-lg transition-all duration-200 hover:-translate-y-1 hover:brightness-110 active:scale-95`}
            >
              <span className="w-16 h-16 bg-white rounded-full shadow flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <option.icon className={`w-8 h-8 ${option.iconColor}`} />
              </span>
              
              <span className="font-display text-xl sm:text-2xl mb-1">
                {option.title}
              </span>
              
              <span className="text-sm font-semibold text-white/90 leading-snug">
                {option.description}
              </span>
            </button>
          ))}
        </div>

        {/* Estadísticas rápidas */}
        <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-lg">
          <h3 className="font-display text-2xl text-dominican-blue mb-4 text-center">
            Así va el juego
          </h3>
          
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="bg-arena rounded-2xl p-3 sm:p-4">
              <div className="font-display text-3xl sm:text-4xl text-dominican-blue">
                {loadingStats ? (
                  <div className="animate-pulse bg-gray-300 h-8 w-16 mx-auto rounded"></div>
                ) : (
                  `${stats.activeUsers}${stats.activeUsers > 0 ? '+' : ''}`
                )}
              </div>
              <p className="text-xs sm:text-sm font-bold text-gray-600">Jugadores activos</p>
            </div>
            
            <div className="bg-arena rounded-2xl p-3 sm:p-4">
              <div className="font-display text-3xl sm:text-4xl text-dominican-red">
                {loadingStats ? (
                  <div className="animate-pulse bg-gray-300 h-8 w-16 mx-auto rounded"></div>
                ) : (
                  stats.totalGames
                )}
              </div>
              <p className="text-xs sm:text-sm font-bold text-gray-600">Trivias disponibles</p>
            </div>
            
            <div className="bg-arena rounded-2xl p-3 sm:p-4">
              <div className="font-display text-3xl sm:text-4xl text-palma">
                {loadingStats ? (
                  <div className="animate-pulse bg-gray-300 h-8 w-16 mx-auto rounded"></div>
                ) : (
                  stats.totalMatches.toLocaleString()
                )}
              </div>
              <p className="text-xs sm:text-sm font-bold text-gray-600">Partidas jugadas</p>
            </div>
          </div>
        </div>

        {/* Instrucciones rápidas */}
        <div className="mt-8 bg-dominican-blue rounded-2xl p-6 sm:p-8 text-white shadow-lg">
          <h3 className="font-display text-2xl mb-5 text-center">
            ¿Cómo se juega?
          </h3>
          
          <div className="grid md:grid-cols-3 gap-5 text-center">
            {[
              { title: 'Escoge tu modo', text: 'Crea una sala, únete a una existente o juega solo' },
              { title: 'Invita a tu gente', text: 'Comparte el código de la sala o el código QR' },
              { title: '¡A jugar!', text: 'Responde rápido y pelea por el primer lugar' }
            ].map((step, index) => (
              <div key={step.title}>
                <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-white text-dominican-red font-display text-2xl flex items-center justify-center">
                  {index + 1}
                </div>
                <h4 className="font-display text-lg mb-1">{step.title}</h4>
                <p className="text-white/80 text-sm font-semibold">{step.text}</p>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-dominican-blue-dark text-white py-6">
        <div className="max-w-6xl mx-auto px-6 text-center">
          <p className="text-white/80 font-semibold text-sm mb-1">
            Hecho con ❤️ para la comunidad dominicana
          </p>
          <p className="text-white/60 text-xs font-semibold">🇩🇴 KLKTUSABES v1.0 🇩🇴</p>
        </div>
      </footer>
    </div>
  )
}

export default WelcomeScreen
