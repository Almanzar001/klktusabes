import React, { useState, useEffect } from 'react'
import { QrCode, Copy, Eye, Trash2, Plus, ArrowLeft, ExternalLink, Trophy } from 'lucide-react'
import QRCodeLib from 'qrcode'
import { useAuth } from '../contexts/AuthContext'
import { qrHelpers, gameHelpers } from '../insforge'
import { Game, QRGameSession, generateQRCode } from '../types'
import QRLeaderboard from './QRLeaderboard'

interface QRGameCreatorProps {
  onBack: () => void
}

const QRGameCreator: React.FC<QRGameCreatorProps> = ({ onBack }) => {
  const { user, isCreator } = useAuth()
  
  // Estados principales
  const [games, setGames] = useState<Game[]>([])
  const [qrSessions, setQRSessions] = useState<QRGameSession[]>([])
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [selectedSessionForLeaderboard, setSelectedSessionForLeaderboard] = useState<QRGameSession | null>(null)
  
  // Estados del formulario
  const [selectedGameId, setSelectedGameId] = useState('')
  const [sessionTitle, setSessionTitle] = useState('')
  const [sessionDescription, setSessionDescription] = useState('')
  const [maxParticipants, setMaxParticipants] = useState(50)
  const [activeTimeHours, setActiveTimeHours] = useState(24)
  
  // Estados de la UI
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copySuccess, setCopySuccess] = useState<string | null>(null)

  // Cargar datos al montar
  useEffect(() => {
    loadGames()
    loadQRSessions()
  }, [])

  const loadGames = async () => {
    try {
      const { data, error } = await gameHelpers.getAllGames()
      if (error) {
        console.error('Error loading games:', error)
        return
      }
      setGames(data || [])
    } catch (err) {
      console.error('Error:', err)
    }
  }

  const loadQRSessions = async () => {
    if (!user) return
    
    try {
      setLoading(true)
      const { data, error } = await qrHelpers.getUserQRSessions(user.id)
      
      if (error) {
        setError('Error al cargar las sesiones QR')
        console.error('Error:', error)
        return
      }

      setQRSessions(data || [])
    } catch (err) {
      setError('Error inesperado al cargar las sesiones')
      console.error('Error:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateQRSession = async () => {
    if (!user || !selectedGameId || !sessionTitle.trim()) {
      setError('Por favor completa todos los campos requeridos')
      return
    }

    try {
      setCreating(true)
      setError(null)

      // Generar código único
      const accessCode = generateQRCode()

      // Crear sesión QR
      const { error } = await qrHelpers.createQRSession(
        accessCode,
        selectedGameId,
        sessionTitle.trim(),
        sessionDescription.trim(),
        user.id,
        maxParticipants,
        activeTimeHours
      )

      if (error) {
        setError('Error al crear la sesión QR')
        console.error('Error:', error)
        return
      }

      // Recargar sesiones
      await loadQRSessions()
      
      // Limpiar formulario
      setSelectedGameId('')
      setSessionTitle('')
      setSessionDescription('')
      setMaxParticipants(50)
      setActiveTimeHours(24)
      setShowCreateForm(false)
    } catch (err) {
      setError('Error inesperado al crear la sesión')
      console.error('Error:', err)
    } finally {
      setCreating(false)
    }
  }

  const handleDeactivateSession = async (sessionId: string) => {
    if (!confirm('¿Estás seguro de que quieres desactivar esta sesión QR?')) {
      return
    }

    try {
      const { error } = await qrHelpers.deactivateQRSession(sessionId)
      
      if (error) {
        setError('Error al desactivar la sesión')
        console.error('Error:', error)
        return
      }

      // Recargar sesiones
      await loadQRSessions()
    } catch (err) {
      setError('Error inesperado al desactivar la sesión')
      console.error('Error:', err)
    }
  }

  const handleShowLeaderboard = (session: QRGameSession) => {
    setSelectedSessionForLeaderboard(session)
  }

  const handleBackFromLeaderboard = () => {
    setSelectedSessionForLeaderboard(null)
  }

  const generateQRCodeImage = async (accessCode: string): Promise<string> => {
    try {
      const url = `${window.location.origin}/#/qr-game/${accessCode}`
      const qrCodeDataURL = await QRCodeLib.toDataURL(url, {
        width: 200,
        margin: 2,
        color: {
          dark: '#002D62', // dominican-blue
          light: '#FFFFFF'
        }
      })
      return qrCodeDataURL
    } catch (err) {
      console.error('Error generating QR code:', err)
      return ''
    }
  }

  const handleCopyURL = async (accessCode: string) => {
    try {
      const url = `${window.location.origin}/#/qr-game/${accessCode}`
      await navigator.clipboard.writeText(url)
      setCopySuccess(accessCode)
      setTimeout(() => setCopySuccess(null), 2000)
    } catch (err) {
      console.error('Error copying to clipboard:', err)
    }
  }

  const handleCopyCode = async (accessCode: string) => {
    try {
      await navigator.clipboard.writeText(accessCode)
      setCopySuccess(accessCode)
      setTimeout(() => setCopySuccess(null), 2000)
    } catch (err) {
      console.error('Error copying to clipboard:', err)
    }
  }

  // Verificar permisos
  if (!isCreator) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">Acceso Restringido</h2>
          <p className="text-gray-600 mb-6">Solo los usuarios creadores pueden crear sesiones QR.</p>
          <button onClick={onBack} className="btn-dominican-primary">
            Volver al Panel
          </button>
        </div>
      </div>
    )
  }

  // Mostrar leaderboard si hay una sesión seleccionada
  if (selectedSessionForLeaderboard) {
    return (
      <QRLeaderboard
        qrSessionId={selectedSessionForLeaderboard.id}
        sessionTitle={selectedSessionForLeaderboard.title}
        onBack={handleBackFromLeaderboard}
      />
    )
  }

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
                <h1 className="text-2xl font-bold text-gray-800">Sesiones QR</h1>
                <p className="text-gray-600">Crea códigos QR para acceso directo a tus juegos</p>
              </div>
            </div>
            
            <button
              onClick={() => setShowCreateForm(true)}
              className="btn-dominican-primary"
            >
              <Plus className="w-5 h-5 mr-2" />
              Nueva Sesión QR
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Mensaje de error */}
        {error && (
          <div className="mb-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg">
            {error}
          </div>
        )}

        {/* Información sobre QR */}
        <div className="bg-purple-50 border border-purple-200 rounded-xl p-6 mb-8">
          <h3 className="text-lg font-bold text-purple-800 mb-2">
            🔗 ¿Qué son las Sesiones QR?
          </h3>
          <p className="text-purple-700 mb-4">
            Las sesiones QR permiten que los jugadores accedan directamente a tus trivias sin necesidad de crear salas multijugador. 
            Ideal para eventos, presentaciones o acceso público.
          </p>
          <div className="grid md:grid-cols-3 gap-4 text-sm">
            <div className="bg-white p-3 rounded-lg">
              <span className="font-semibold text-purple-800">1. Crea:</span>
              <p className="text-purple-600">Genera un código QR único para tu juego</p>
            </div>
            <div className="bg-white p-3 rounded-lg">
              <span className="font-semibold text-purple-800">2. Comparte:</span>
              <p className="text-purple-600">Los usuarios escanean el QR o usan el enlace</p>
            </div>
            <div className="bg-white p-3 rounded-lg">
              <span className="font-semibold text-purple-800">3. Juegan:</span>
              <p className="text-purple-600">Acceso directo e individual a la trivia</p>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="loading-spinner mx-auto mb-4"></div>
            <p className="text-gray-600">Cargando sesiones QR...</p>
          </div>
        ) : qrSessions.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-24 h-24 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <QrCode className="w-12 h-12 text-purple-600" />
            </div>
            <h3 className="text-xl font-semibold text-gray-800 mb-2">
              No tienes sesiones QR
            </h3>
            <p className="text-gray-600 mb-6">
              Crea tu primera sesión QR para compartir tus juegos fácilmente
            </p>
            <button
              onClick={() => setShowCreateForm(true)}
              className="btn-dominican-primary"
            >
              <Plus className="w-5 h-5 mr-2" />
              Crear Primera Sesión QR
            </button>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {qrSessions.map((session) => (
              <QRSessionCard
                key={session.id}
                session={session}
                onCopyURL={() => handleCopyURL(session.access_code)}
                onCopyCode={() => handleCopyCode(session.access_code)}
                onDeactivate={() => handleDeactivateSession(session.id)}
                onShowLeaderboard={() => handleShowLeaderboard(session)}
                copySuccess={copySuccess === session.access_code}
                generateQRCode={() => generateQRCodeImage(session.access_code)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Modal para crear nueva sesión */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-8 max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold text-gray-800 mb-6">
              Crear Nueva Sesión QR
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Seleccionar Juego *
                </label>
                <select
                  value={selectedGameId}
                  onChange={(e) => setSelectedGameId(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-dominican-blue"
                >
                  <option value="">Elige un juego...</option>
                  {games.map((game) => (
                    <option key={game.id} value={game.id}>
                      {game.title} ({game.questions?.length || 0} preguntas)
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Título de la Sesión *
                </label>
                <input
                  type="text"
                  value={sessionTitle}
                  onChange={(e) => setSessionTitle(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-dominican-blue"
                  placeholder="Ej: Trivia del Viernes"
                  maxLength={100}
                />
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Descripción (opcional)
                </label>
                <textarea
                  value={sessionDescription}
                  onChange={(e) => setSessionDescription(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-dominican-blue"
                  placeholder="Describe esta sesión..."
                  rows={3}
                  maxLength={300}
                />
              </div>

              {/* Configuraciones adicionales */}
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Máximo de Participantes
                  </label>
                  <select
                    value={maxParticipants}
                    onChange={(e) => setMaxParticipants(Number(e.target.value))}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-dominican-blue"
                  >
                    <option value={10}>10 participantes</option>
                    <option value={25}>25 participantes</option>
                    <option value={50}>50 participantes</option>
                    <option value={100}>100 participantes</option>
                    <option value={200}>200 participantes</option>
                    <option value={999}>Sin límite</option>
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    Número máximo de personas que pueden participar
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Tiempo Activo
                  </label>
                  <select
                    value={activeTimeHours}
                    onChange={(e) => setActiveTimeHours(Number(e.target.value))}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-dominican-blue"
                  >
                    <option value={1}>1 hora</option>
                    <option value={6}>6 horas</option>
                    <option value={12}>12 horas</option>
                    <option value={24}>24 horas (1 día)</option>
                    <option value={72}>72 horas (3 días)</option>
                    <option value={168}>168 horas (1 semana)</option>
                    <option value={720}>720 horas (30 días)</option>
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    Tiempo que estará disponible la sesión
                  </p>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-3 mt-6">
              <button
                onClick={handleCreateQRSession}
                disabled={!selectedGameId || !sessionTitle.trim() || creating}
                className="btn-dominican-primary flex-1 disabled:opacity-50"
              >
                {creating ? 'Creando...' : 'Crear Sesión QR'}
              </button>
              <button
                onClick={() => {
                  setShowCreateForm(false)
                  setSelectedGameId('')
                  setSessionTitle('')
                  setSessionDescription('')
                  setMaxParticipants(50)
                  setActiveTimeHours(24)
                }}
                className="btn-dominican-outline flex-1"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Componente para cada tarjeta de sesión QR
interface QRSessionCardProps {
  session: QRGameSession
  onCopyURL: () => void
  onCopyCode: () => void
  onDeactivate: () => void
  onShowLeaderboard: () => void
  copySuccess: boolean
  generateQRCode: () => Promise<string>
}

const QRSessionCard: React.FC<QRSessionCardProps> = ({
  session,
  onCopyURL,
  onCopyCode,
  onDeactivate,
  onShowLeaderboard,
  copySuccess,
  generateQRCode
}) => {
  const [qrCodeImage, setQRCodeImage] = useState<string>('')
  const [showQRModal, setShowQRModal] = useState(false)

  useEffect(() => {
    generateQRCode().then(setQRCodeImage)
  }, [])

  const openDirectLink = () => {
    const url = `${window.location.origin}/#/qr-game/${session.access_code}`
    window.open(url, '_blank')
  }

  return (
    <>
      <div className="bg-white rounded-xl shadow-lg p-6 hover:shadow-xl transition-shadow">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <h3 className="text-lg font-bold text-gray-800 mb-1">
              {session.title}
            </h3>
            <p className="text-sm text-gray-600 mb-2">
              {session.description || 'Sin descripción'}
            </p>
            <p className="text-xs text-gray-500">
              Juego: {session.game?.title}
            </p>
          </div>
          
          <button
            onClick={onDeactivate}
            className="text-red-600 hover:text-red-800 p-1"
            title="Desactivar sesión"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>

        {/* Código de acceso */}
        <div className="bg-gray-50 rounded-lg p-3 mb-4">
          <p className="text-xs text-gray-500 mb-1">Código de Acceso:</p>
          <div className="flex items-center justify-between">
            <span className="font-mono font-bold text-lg text-dominican-blue">
              {session.access_code}
            </span>
            <button
              onClick={onCopyCode}
              className="text-dominican-blue hover:text-dominican-blue-light"
              title="Copiar código"
            >
              <Copy className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* QR Code preview */}
        {qrCodeImage && (
          <div className="text-center mb-4">
            <img
              src={qrCodeImage}
              alt="QR Code"
              className="w-24 h-24 mx-auto rounded-lg border border-gray-200 cursor-pointer hover:scale-105 transition-transform"
              onClick={() => setShowQRModal(true)}
            />
            <p className="text-xs text-gray-500 mt-1">Click para ampliar</p>
          </div>
        )}

        {/* Acciones */}
        <div className="space-y-2">
          <button
            onClick={onCopyURL}
            className="w-full flex items-center justify-center gap-2 bg-purple-100 text-purple-700 py-2 px-3 rounded-lg hover:bg-purple-200 transition-colors text-sm"
          >
            <Copy className="w-4 h-4" />
            {copySuccess ? '¡Copiado!' : 'Copiar Enlace'}
          </button>
          
          <button
            onClick={onShowLeaderboard}
            className="w-full flex items-center justify-center gap-2 bg-yellow-100 text-yellow-700 py-2 px-3 rounded-lg hover:bg-yellow-200 transition-colors text-sm"
          >
            <Trophy className="w-4 h-4" />
            Ver Leaderboard
          </button>
          
          <div className="flex gap-2">
            <button
              onClick={() => setShowQRModal(true)}
              className="flex-1 flex items-center justify-center gap-2 bg-gray-100 text-gray-700 py-2 px-3 rounded-lg hover:bg-gray-200 transition-colors text-sm"
            >
              <Eye className="w-4 h-4" />
              Ver QR
            </button>
            
            <button
              onClick={openDirectLink}
              className="flex-1 flex items-center justify-center gap-2 bg-gray-100 text-gray-700 py-2 px-3 rounded-lg hover:bg-gray-200 transition-colors text-sm"
            >
              <ExternalLink className="w-4 h-4" />
              Abrir
            </button>
          </div>
        </div>

        {/* Información adicional */}
        <div className="mt-4 pt-3 border-t border-gray-200 text-xs text-gray-500">
          Creado: {new Date(session.created_at).toLocaleDateString()}
        </div>
      </div>

      {/* Modal para mostrar QR grande */}
      {showQRModal && qrCodeImage && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-8 max-w-sm w-full mx-4">
            <div className="text-center">
              <h3 className="text-lg font-bold text-gray-800 mb-4">
                {session.title}
              </h3>
              
              <img
                src={qrCodeImage}
                alt="QR Code"
                className="w-full max-w-xs mx-auto rounded-lg border border-gray-200 mb-4"
              />
              
              <p className="text-sm text-gray-600 mb-4">
                Escanea este código QR o usa el enlace para acceder directamente al juego
              </p>
              
              <div className="space-y-2">
                <button
                  onClick={onCopyURL}
                  className="w-full btn-dominican-primary"
                >
                  <Copy className="w-4 h-4 mr-2" />
                  {copySuccess ? '¡Enlace Copiado!' : 'Copiar Enlace'}
                </button>
                
                <button
                  onClick={() => setShowQRModal(false)}
                  className="w-full btn-dominican-outline"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default QRGameCreator