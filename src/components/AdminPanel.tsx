import React, { useState, useEffect } from 'react'
import { Settings, Gamepad2, QrCode, BarChart3, Users, ArrowLeft } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { statsHelpers } from '../insforge'
import GameEditor from './GameEditor'
import QRGameCreator from './QRGameCreator'

interface AdminPanelProps {
  onBack: () => void
}

type AdminView = 'dashboard' | 'games' | 'qr-sessions' | 'stats'

const AdminPanel: React.FC<AdminPanelProps> = ({ onBack }) => {
  const { isCreator, userProfile, user } = useAuth()
  const [currentView, setCurrentView] = useState<AdminView>('dashboard')
  
  // Estados para estadísticas del usuario
  const [userStats, setUserStats] = useState({
    gamesCreated: 0,
    qrSessions: 0,
    activePlayers: 0,
    totalMatches: 0,
    recentGames: []
  })
  const [loadingStats, setLoadingStats] = useState(true)

  // Cargar estadísticas del usuario al montar el componente
  useEffect(() => {
    if (user?.id && currentView === 'dashboard') {
      loadUserStatistics()
    }
  }, [user?.id, currentView])

  const loadUserStatistics = async () => {
    if (!user?.id) return
    
    try {
      setLoadingStats(true)
      const { data, error } = await statsHelpers.getUserStatistics(user.id)
      
      if (error) {
        console.error('Error cargando estadísticas de usuario:', error)
        // Mantener valores por defecto en caso de error
        return
      }

      if (data) {
        setUserStats({
          gamesCreated: data.gamesCreated,
          qrSessions: data.qrSessions,
          activePlayers: data.activePlayers,
          totalMatches: data.totalMatches,
          recentGames: data.recentGames || []
        })
      }
    } catch (err) {
      console.error('Error inesperado cargando estadísticas de usuario:', err)
    } finally {
      setLoadingStats(false)
    }
  }

  // Verificar permisos
  if (!isCreator) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">Acceso Restringido</h2>
          <p className="text-gray-600 mb-6">Solo los usuarios creadores pueden acceder al panel de administración.</p>
          <button onClick={onBack} className="btn-dominican-primary">
            Volver al Inicio
          </button>
        </div>
      </div>
    )
  }

  // Renderizar vista específica
  if (currentView === 'games') {
    return <GameEditor onBack={() => setCurrentView('dashboard')} />
  }

  if (currentView === 'qr-sessions') {
    return <QRGameCreator onBack={() => setCurrentView('dashboard')} />
  }

  // Dashboard principal
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={onBack}
                className="text-dominican-blue hover:text-dominican-blue-light"
              >
                <ArrowLeft className="w-6 h-6" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-800">Panel de Administración</h1>
                <p className="text-gray-600">Gestiona tus juegos y sesiones</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-sm font-semibold flex items-center gap-1">
                <Settings className="w-4 h-4" />
                Creador
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Bienvenida */}
        <div className="bg-gradient-to-r from-dominican-blue to-dominican-blue-light rounded-2xl p-8 text-white mb-8">
          <h2 className="text-3xl font-bold mb-2">
            ¡Hola, {userProfile?.full_name?.split(' ')[0]}! 👋
          </h2>
          <p className="text-blue-100 text-lg">
            Desde aquí puedes crear y gestionar tus trivias, revisar estadísticas y mucho más.
          </p>
        </div>

        {/* Tarjetas de estadísticas rápidas */}
        <div className="grid md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-xl p-6 shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm">Juegos Creados</p>
                <p className="text-2xl font-bold text-gray-800">
                  {loadingStats ? (
                    <div className="animate-pulse bg-gray-300 h-6 w-8 rounded"></div>
                  ) : (
                    userStats.gamesCreated
                  )}
                </p>
              </div>
              <div className="bg-blue-100 p-3 rounded-lg">
                <Gamepad2 className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-xl p-6 shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm">Sesiones QR</p>
                <p className="text-2xl font-bold text-gray-800">
                  {loadingStats ? (
                    <div className="animate-pulse bg-gray-300 h-6 w-8 rounded"></div>
                  ) : (
                    userStats.qrSessions
                  )}
                </p>
              </div>
              <div className="bg-purple-100 p-3 rounded-lg">
                <QrCode className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-xl p-6 shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm">Jugadores Activos</p>
                <p className="text-2xl font-bold text-gray-800">
                  {loadingStats ? (
                    <div className="animate-pulse bg-gray-300 h-6 w-12 rounded"></div>
                  ) : (
                    userStats.activePlayers
                  )}
                </p>
              </div>
              <div className="bg-green-100 p-3 rounded-lg">
                <Users className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-xl p-6 shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm">Partidas Jugadas</p>
                <p className="text-2xl font-bold text-gray-800">
                  {loadingStats ? (
                    <div className="animate-pulse bg-gray-300 h-6 w-12 rounded"></div>
                  ) : (
                    userStats.totalMatches
                  )}
                </p>
              </div>
              <div className="bg-red-100 p-3 rounded-lg">
                <BarChart3 className="w-6 h-6 text-red-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Acciones principales */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Gestionar Juegos */}
          <div
            onClick={() => setCurrentView('games')}
            className="bg-white rounded-xl p-8 shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer hover:scale-105 group"
          >
            <div className="bg-dominican-blue rounded-2xl p-4 w-16 h-16 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <Gamepad2 className="w-8 h-8 text-white" />
            </div>
            
            <h3 className="text-xl font-bold text-gray-800 mb-3">
              Gestionar Juegos
            </h3>
            
            <p className="text-gray-600 text-sm leading-relaxed mb-4">
              Crea nuevos juegos, edita preguntas existentes y organiza tu contenido.
            </p>
            
            <div className="text-dominican-blue font-semibold text-sm group-hover:text-dominican-blue-light">
              Ir al Editor →
            </div>
          </div>

          {/* Sesiones QR */}
          <div
            onClick={() => setCurrentView('qr-sessions')}
            className="bg-white rounded-xl p-8 shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer hover:scale-105 group"
          >
            <div className="bg-purple-600 rounded-2xl p-4 w-16 h-16 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <QrCode className="w-8 h-8 text-white" />
            </div>
            
            <h3 className="text-xl font-bold text-gray-800 mb-3">
              Sesiones QR
            </h3>
            
            <p className="text-gray-600 text-sm leading-relaxed mb-4">
              Crea códigos QR para acceso directo a tus trivias sin necesidad de salas.
            </p>
            
            <div className="text-purple-600 font-semibold text-sm group-hover:text-purple-700">
              Gestionar QR →
            </div>
          </div>

          {/* Estadísticas */}
          <div className="bg-white rounded-xl p-8 shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer hover:scale-105 group opacity-50">
            <div className="bg-green-600 rounded-2xl p-4 w-16 h-16 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <BarChart3 className="w-8 h-8 text-white" />
            </div>
            
            <h3 className="text-xl font-bold text-gray-800 mb-3">
              Estadísticas
            </h3>
            
            <p className="text-gray-600 text-sm leading-relaxed mb-4">
              Analiza el rendimiento de tus juegos y el comportamiento de los jugadores.
            </p>
            
            <div className="text-gray-400 font-semibold text-sm">
              Próximamente...
            </div>
          </div>
        </div>

        {/* Juegos recientes */}
        <div className="mt-12">
          <h3 className="text-2xl font-bold text-gray-800 mb-6">Juegos Recientes</h3>
          
          <div className="bg-white rounded-xl shadow-lg overflow-hidden">
            <div className="p-6">
              <div className="space-y-4">
                {loadingStats ? (
                  // Skeleton loading para juegos recientes
                  Array.from({ length: 3 }).map((_, index) => (
                    <div key={index} className="flex items-center gap-4 p-4 border border-gray-200 rounded-lg animate-pulse">
                      <div className="w-12 h-12 bg-gray-300 rounded-lg"></div>
                      <div className="flex-1">
                        <div className="h-4 bg-gray-300 rounded w-48 mb-2"></div>
                        <div className="h-3 bg-gray-200 rounded w-64"></div>
                      </div>
                      <div className="h-6 bg-gray-300 rounded w-12"></div>
                    </div>
                  ))
                ) : userStats.recentGames.length > 0 ? (
                  userStats.recentGames.map((game: any, index: number) => (
                    <div key={game.id || index} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-dominican-blue rounded-lg flex items-center justify-center">
                          <Gamepad2 className="w-6 h-6 text-white" />
                        </div>
                        <div>
                          <h4 className="font-semibold text-gray-800">{game.title}</h4>
                          <p className="text-sm text-gray-600">
                            {game.questions} preguntas • {game.plays} partidas • Creado hace {game.created}
                          </p>
                        </div>
                      </div>
                      
                      <button
                        onClick={() => setCurrentView('games')}
                        className="text-dominican-blue hover:text-dominican-blue-light font-semibold text-sm"
                      >
                        Editar
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8">
                    <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                      <Gamepad2 className="w-8 h-8 text-gray-400" />
                    </div>
                    <p className="text-gray-600 mb-2">No tienes juegos recientes</p>
                    <button
                      onClick={() => setCurrentView('games')}
                      className="text-dominican-blue hover:text-dominican-blue-light font-semibold text-sm"
                    >
                      Crear tu primer juego →
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AdminPanel