import React, { useState, useEffect } from 'react'
import { Plus, Edit, Trash2, ArrowLeft } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { gameHelpers } from '../insforge'
import { Game, Question } from '../types'
import QuestionEditor from './QuestionEditor'

interface GameEditorProps {
  onBack: () => void
}

const GameEditor: React.FC<GameEditorProps> = ({ onBack }) => {
  const { user, isCreator } = useAuth()
  const [games, setGames] = useState<Game[]>([])
  const [selectedGame, setSelectedGame] = useState<Game | null>(null)
  const [showQuestionEditor, setShowQuestionEditor] = useState(false)
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Estados para crear nuevo juego
  const [showNewGameForm, setShowNewGameForm] = useState(false)
  const [newGameTitle, setNewGameTitle] = useState('')
  const [newGameDescription, setNewGameDescription] = useState('')

  // Estados para editar juego
  const [showEditGameForm, setShowEditGameForm] = useState(false)
  const [editGameTitle, setEditGameTitle] = useState('')
  const [editGameDescription, setEditGameDescription] = useState('')
  const [editingGame, setEditingGame] = useState<Game | null>(null)

  // Cargar juegos al montar el componente
  useEffect(() => {
    loadGames()
  }, [])

  const loadGames = async () => {
    try {
      setLoading(true)
      const { data, error } = await gameHelpers.getAllGames()
      
      if (error) {
        setError('Error al cargar los juegos')
        console.error('Error:', error)
        return
      }

      setGames(data || [])
    } catch (err) {
      setError('Error inesperado al cargar los juegos')
      console.error('Error:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateGame = async () => {
    if (!user || !newGameTitle.trim()) return

    try {
      setSaving(true)
      setError(null)

      const { data, error } = await gameHelpers.createGame(
        newGameTitle.trim(),
        newGameDescription.trim(),
        user.id
      )

      if (error) {
        setError('Error al crear el juego')
        console.error('Error:', error)
        return
      }

      // Actualizar lista de juegos
      await loadGames()
      
      // Limpiar formulario
      setNewGameTitle('')
      setNewGameDescription('')
      setShowNewGameForm(false)
      
      // Seleccionar el juego recién creado
      setSelectedGame(data)
    } catch (err) {
      setError('Error inesperado al crear el juego')
      console.error('Error:', err)
    } finally {
      setSaving(false)
    }
  }

  const handleSelectGame = (game: Game) => {
    setSelectedGame(game)
    setShowQuestionEditor(false)
    setEditingQuestion(null)
  }

  const handleAddQuestion = () => {
    setEditingQuestion(null)
    setShowQuestionEditor(true)
  }

  const handleEditQuestion = (question: Question) => {
    setEditingQuestion(question)
    setShowQuestionEditor(true)
  }

  const handleQuestionSaved = async () => {
    setShowQuestionEditor(false)
    setEditingQuestion(null)
    
    // Recargar el juego seleccionado para ver las preguntas actualizadas
    if (selectedGame) {
      const { data } = await gameHelpers.getGameWithQuestions(selectedGame.id)
      if (data) {
        setSelectedGame(data)
      }
    }
  }

  const handleDeleteQuestion = async (questionId: string) => {
    if (!confirm('¿Estás seguro de que quieres eliminar esta pregunta?')) {
      return
    }

    try {
      setError(null)
      
      const { error } = await gameHelpers.deleteQuestion(questionId)
      
      if (error) {
        setError('Error al eliminar la pregunta: ' + error.message)
        console.error('Error:', error)
        return
      }
      
      
      // Recargar el juego seleccionado para actualizar la lista de preguntas
      if (selectedGame) {
        const { data } = await gameHelpers.getGameWithQuestions(selectedGame.id)
        if (data) {
          setSelectedGame(data)
        }
      }
    } catch (err) {
      setError('Error inesperado al eliminar la pregunta')
      console.error('Error:', err)
    }
  }

  const handleEditGame = (game: Game) => {
    setEditingGame(game)
    setEditGameTitle(game.title)
    setEditGameDescription(game.description || '')
    setShowEditGameForm(true)
  }

  const handleUpdateGame = async () => {
    if (!editingGame || !editGameTitle.trim()) return

    try {
      setSaving(true)
      setError(null)

      const { error } = await gameHelpers.updateGame(editingGame.id, {
        title: editGameTitle.trim(),
        description: editGameDescription.trim()
      })

      if (error) {
        setError('Error al actualizar el juego: ' + error.message)
        console.error('Error:', error)
        return
      }


      // Actualizar la lista de juegos
      await loadGames()
      
      // Actualizar el juego seleccionado si es el que se editó
      if (selectedGame?.id === editingGame.id) {
        const { data: updatedGameData } = await gameHelpers.getGameWithQuestions(editingGame.id)
        if (updatedGameData) {
          setSelectedGame(updatedGameData)
        }
      }
      
      // Limpiar formulario y cerrar modal
      setEditGameTitle('')
      setEditGameDescription('')
      setEditingGame(null)
      setShowEditGameForm(false)
    } catch (err) {
      setError('Error inesperado al actualizar el juego')
      console.error('Error:', err)
    } finally {
      setSaving(false)
    }
  }

  // Verificar si el usuario tiene permisos
  if (!isCreator) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">Acceso Restringido</h2>
          <p className="text-gray-600 mb-6">Solo los usuarios creadores pueden acceder al editor de juegos.</p>
          <button onClick={onBack} className="btn-dominican-primary">
            Volver al Inicio
          </button>
        </div>
      </div>
    )
  }

  // Mostrar editor de preguntas
  if (showQuestionEditor && selectedGame) {
    return (
      <QuestionEditor
        game={selectedGame}
        question={editingQuestion}
        onSave={handleQuestionSaved}
        onCancel={() => {
          setShowQuestionEditor(false)
          setEditingQuestion(null)
        }}
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
              <h1 className="text-2xl font-bold text-gray-800">
                Editor de Juegos
              </h1>
            </div>
            
            <button
              onClick={() => setShowNewGameForm(true)}
              className="btn-dominican-primary"
            >
              <Plus className="w-5 h-5 mr-2" />
              Nuevo Juego
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

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Lista de juegos */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-xl font-bold text-gray-800 mb-4">Mis Juegos</h2>
              
              {loading ? (
                <div className="text-center py-8">
                  <div className="loading-spinner mx-auto mb-4"></div>
                  <p className="text-gray-600">Cargando juegos...</p>
                </div>
              ) : games.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-600 mb-4">No tienes juegos creados</p>
                  <button
                    onClick={() => setShowNewGameForm(true)}
                    className="btn-dominican-outline py-2 px-4 text-sm"
                  >
                    Crear tu primer juego
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {games.map((game) => (
                    <div
                      key={game.id}
                      onClick={() => handleSelectGame(game)}
                      className={`p-4 rounded-lg cursor-pointer transition-all duration-200 ${
                        selectedGame?.id === game.id
                          ? 'bg-dominican-blue text-white'
                          : 'bg-gray-50 hover:bg-gray-100'
                      }`}
                    >
                      <h3 className="font-semibold truncate">{game.title}</h3>
                      <p className={`text-sm mt-1 ${
                        selectedGame?.id === game.id ? 'text-blue-100' : 'text-gray-600'
                      }`}>
                        {game.questions?.length || 0} preguntas
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Detalles del juego seleccionado */}
          <div className="lg:col-span-2">
            {selectedGame ? (
              <div className="bg-white rounded-xl shadow-lg p-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h2 className="text-2xl font-bold text-gray-800">
                        {selectedGame.title}
                      </h2>
                      <button
                        onClick={() => handleEditGame(selectedGame)}
                        className="text-blue-600 hover:text-blue-800 p-1"
                        title="Editar juego"
                      >
                        <Edit className="w-5 h-5" />
                      </button>
                    </div>
                    <p className="text-gray-600 mt-1">
                      {selectedGame.description || 'Sin descripción'}
                    </p>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleAddQuestion}
                      className="btn-dominican-primary"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Agregar Pregunta
                    </button>
                  </div>
                </div>

                {/* Lista de preguntas */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-800">
                    Preguntas ({selectedGame.questions?.length || 0})
                  </h3>
                  
                  {selectedGame.questions && selectedGame.questions.length > 0 ? (
                    selectedGame.questions.map((question, index) => (
                      <div
                        key={question.id}
                        className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="bg-dominican-blue text-white text-sm px-2 py-1 rounded">
                                #{index + 1}
                              </span>
                              <span className="text-sm text-gray-500">
                                {question.time_limit}s
                              </span>
                            </div>
                            <p className="font-semibold text-gray-800 mb-2">
                              {question.text}
                            </p>
                            <div className="grid grid-cols-2 gap-2 text-sm">
                              {question.options.map((option, optIndex) => (
                                <div
                                  key={optIndex}
                                  className={`p-2 rounded ${
                                    optIndex === question.correct_answer
                                      ? 'bg-green-100 text-green-800 border border-green-300'
                                      : 'bg-gray-100'
                                  }`}
                                >
                                  {option}
                                  {optIndex === question.correct_answer && (
                                    <span className="ml-1">✓</span>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2 ml-4">
                            <button
                              onClick={() => handleEditQuestion(question)}
                              className="text-blue-600 hover:text-blue-800 p-1"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteQuestion(question.id)}
                              className="text-red-600 hover:text-red-800 p-1"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8 border-2 border-dashed border-gray-300 rounded-lg">
                      <p className="text-gray-600 mb-4">
                        Este juego no tiene preguntas todavía
                      </p>
                      <button
                        onClick={handleAddQuestion}
                        className="btn-dominican-outline py-2 px-4 text-sm"
                      >
                        Agregar Primera Pregunta
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-xl shadow-lg p-8 text-center">
                <h2 className="text-xl font-semibold text-gray-800 mb-4">
                  Selecciona un Juego
                </h2>
                <p className="text-gray-600">
                  Elige un juego de la lista para ver y editar sus preguntas
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal para crear nuevo juego */}
      {showNewGameForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-8 max-w-md w-full mx-4">
            <h3 className="text-xl font-bold text-gray-800 mb-6">
              Crear Nuevo Juego
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Título del Juego *
                </label>
                <input
                  type="text"
                  value={newGameTitle}
                  onChange={(e) => setNewGameTitle(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-dominican-blue"
                  placeholder="Ej: Trivia de Historia Dominicana"
                  maxLength={100}
                />
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Descripción
                </label>
                <textarea
                  value={newGameDescription}
                  onChange={(e) => setNewGameDescription(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-dominican-blue"
                  placeholder="Describe brevemente tu trivia..."
                  rows={3}
                  maxLength={300}
                />
              </div>
            </div>
            
            <div className="flex items-center gap-3 mt-6">
              <button
                onClick={handleCreateGame}
                disabled={!newGameTitle.trim() || saving}
                className="btn-dominican-primary flex-1 disabled:opacity-50"
              >
                {saving ? 'Creando...' : 'Crear Juego'}
              </button>
              <button
                onClick={() => {
                  setShowNewGameForm(false)
                  setNewGameTitle('')
                  setNewGameDescription('')
                }}
                className="btn-dominican-outline flex-1"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal para editar juego */}
      {showEditGameForm && editingGame && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-8 max-w-md w-full mx-4">
            <h3 className="text-xl font-bold text-gray-800 mb-6">
              Editar Juego
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Título del Juego *
                </label>
                <input
                  type="text"
                  value={editGameTitle}
                  onChange={(e) => setEditGameTitle(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-dominican-blue"
                  placeholder="Ej: Trivia de Historia Dominicana"
                  maxLength={100}
                />
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Descripción
                </label>
                <textarea
                  value={editGameDescription}
                  onChange={(e) => setEditGameDescription(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-dominican-blue"
                  placeholder="Describe brevemente tu trivia..."
                  rows={3}
                  maxLength={300}
                />
              </div>
            </div>
            
            <div className="flex items-center gap-3 mt-6">
              <button
                onClick={handleUpdateGame}
                disabled={!editGameTitle.trim() || saving}
                className="btn-dominican-primary flex-1 disabled:opacity-50"
              >
                {saving ? 'Actualizando...' : 'Actualizar Juego'}
              </button>
              <button
                onClick={() => {
                  setShowEditGameForm(false)
                  setEditGameTitle('')
                  setEditGameDescription('')
                  setEditingGame(null)
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

export default GameEditor