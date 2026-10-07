import React, { useState, useEffect } from 'react'
import { Save, X, Image as ImageIcon, Clock, CheckCircle } from 'lucide-react'
import { gameHelpers } from '../insforge'
import { Game, Question, DEFAULT_QUESTION_TIME } from '../types'

interface QuestionEditorProps {
  game: Game
  question?: Question | null
  onSave: () => void
  onCancel: () => void
}

const QuestionEditor: React.FC<QuestionEditorProps> = ({
  game,
  question,
  onSave,
  onCancel
}) => {
  // Estados del formulario
  const [questionText, setQuestionText] = useState('')
  const [options, setOptions] = useState(['', '', '', ''])
  const [correctAnswer, setCorrectAnswer] = useState(0)
  const [timeLimit, setTimeLimit] = useState(DEFAULT_QUESTION_TIME)
  const [imageUrl, setImageUrl] = useState('')
  
  // Estados de la UI
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showPreview, setShowPreview] = useState(false)

  // Cargar datos si estamos editando una pregunta existente
  useEffect(() => {
    if (question) {
      setQuestionText(question.text)
      setOptions(question.options)
      setCorrectAnswer(question.correct_answer)
      setTimeLimit(question.time_limit)
      setImageUrl(question.image_url || '')
    }
  }, [question])

  // Validar formulario
  const isFormValid = () => {
    if (!questionText.trim()) return false
    if (options.some(option => !option.trim())) return false
    if (correctAnswer < 0 || correctAnswer > 3) return false
    if (timeLimit < 5 || timeLimit > 120) return false
    return true
  }

  // Manejar cambio en opciones
  const handleOptionChange = (index: number, value: string) => {
    const newOptions = [...options]
    newOptions[index] = value
    setOptions(newOptions)
  }


  // Guardar pregunta
  const handleSave = async () => {
    if (!isFormValid()) {
      setError('Por favor completa todos los campos correctamente')
      return
    }

    try {
      setSaving(true)
      setError(null)


      // Verificar que tenemos un game ID válido
      if (!game?.id) {
        setError('Error: No se encontró el ID del juego')
        return
      }

      // Obtener el número de orden para la nueva pregunta
      const orderNumber = question?.order_number || (game.questions?.length || 0) + 1

      const questionData = {
        text: questionText.trim(),
        options: options.map(opt => opt.trim()),
        correct_answer: correctAnswer,
        time_limit: timeLimit,
        order_number: orderNumber,
        image_url: imageUrl.trim() || null
      }


      if (question) {
        // Actualizar pregunta existente
        const { error } = await gameHelpers.updateQuestion(question.id, questionData)
        
        if (error) {
          
          // Mostrar error más específico
          let errorMessage = 'Error al actualizar la pregunta'
          
          if (error && typeof error === 'object' && 'code' in error && error.code === 'TIMEOUT') {
            errorMessage = 'La operación tardó demasiado tiempo. Posibles causas:\n• Problemas de conexión a internet\n• Configuración incorrecta de InsForge\n• Problemas con los permisos de la base de datos'
          } else if (typeof error === 'object' && error.message) {
            errorMessage += `: ${error.message}`
          } else if (typeof error === 'string') {
            errorMessage += `: ${error}`
          }
          
          // Errores comunes específicos
          if (error.message?.includes('RLS') || error.message?.includes('policy')) {
            errorMessage = 'Error de permisos: No tienes autorización para editar esta pregunta. Contacta al administrador.'
          } else if (error.message?.includes('not found') || error.message?.includes('404')) {
            errorMessage = 'Error: La pregunta no existe o ya fue eliminada'
          } else if (error.message?.includes('network') || error.message?.includes('fetch')) {
            errorMessage = 'Error de conexión: Verifica tu conexión a internet'
          }
          
          setError(errorMessage)
          console.error('🔴 Error completo:', error)
          return
        }

      } else {
        // Crear nueva pregunta
        const { error } = await gameHelpers.addQuestion(game.id, questionData)
        
        if (error) {
          
          // Mostrar error más específico
          let errorMessage = 'Error al guardar la pregunta'
          
          if (error && typeof error === 'object' && 'code' in error && error.code === 'TIMEOUT') {
            errorMessage = 'La operación tardó demasiado tiempo. Posibles causas:\n• Problemas de conexión a internet\n• Configuración incorrecta de InsForge\n• Problemas con los permisos de la base de datos'
          } else if (typeof error === 'object' && error.message) {
            errorMessage += `: ${error.message}`
          } else if (typeof error === 'string') {
            errorMessage += `: ${error}`
          }
          
          // Errores comunes específicos
          if (error.message?.includes('RLS') || error.message?.includes('policy')) {
            errorMessage = 'Error de permisos: No tienes autorización para crear preguntas en este juego. Contacta al administrador.'
          } else if (error.message?.includes('duplicate')) {
            errorMessage = 'Error: Ya existe una pregunta con ese número de orden'
          } else if (error.message?.includes('foreign key')) {
            errorMessage = 'Error: El juego no existe o no tienes acceso a él'
          } else if (error.message?.includes('network') || error.message?.includes('fetch')) {
            errorMessage = 'Error de conexión: Verifica tu conexión a internet'
          }
          
          setError(errorMessage)
          console.error('🔴 Error completo:', error)
          return
        }

      }

      onSave()
    } catch (err) {
      console.error('Error guardando pregunta:', err)
      setError(`Error inesperado al guardar la pregunta: ${err instanceof Error ? err.message : 'Error desconocido'}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen fondo-caribe">
      {/* Header */}
      <div className="cabecera">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="font-display text-2xl text-white">
                {question ? 'Editar Pregunta' : 'Nueva Pregunta'}
              </h1>
              <p className="text-sm font-semibold text-white/80">
                Juego: {game.title}
              </p>
            </div>
            
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowPreview(!showPreview)}
                className="btn-dominican-outline text-base py-2 px-4"
              >
                {showPreview ? 'Editar' : 'Vista Previa'}
              </button>
              
              <button
                onClick={handleSave}
                disabled={!isFormValid() || saving}
                className="btn-dominican-secondary py-2 px-4 text-base disabled:opacity-50"
              >
                <Save className="w-4 h-4 mr-2" />
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
              
              <button
                onClick={onCancel}
                className="text-white/85 hover:text-white p-2"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Mensaje de error */}
        {error && (
          <div className="mb-6 p-4 bg-dominican-red/10 border border-dominican-red/40 text-dominican-red rounded-lg">
            {error}
          </div>
        )}

        {showPreview ? (
          // Vista previa de la pregunta
          <div className="bg-white rounded-2xl shadow-lg p-8">
            <div className="question-card">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-display text-dominican-blue">Vista Previa</h2>
                <div className="flex items-center gap-2 text-gray-600">
                  <Clock className="w-5 h-5" />
                  <span>{timeLimit}s</span>
                </div>
              </div>
              
              {imageUrl && (
                <div className="mb-6">
                  <img
                    src={imageUrl}
                    alt="Imagen de la pregunta"
                    className="max-w-full h-64 object-cover rounded-lg mx-auto"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none'
                    }}
                  />
                </div>
              )}
              
              <h3 className="text-xl font-semibold text-dominican-blue-dark mb-8">
                {questionText || 'Escribe tu pregunta aquí...'}
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {options.map((option, index) => (
                  <button
                    key={index}
                    className={`answer-option ${
                      index === correctAnswer ? 'answer-option-correct' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span>{option || `Opción ${index + 1}`}</span>
                      {index === correctAnswer && (
                        <CheckCircle className="w-5 h-5 text-palma" />
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          // Formulario de edición
          <div className="grid lg:grid-cols-2 gap-8">
            {/* Formulario principal */}
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <h2 className="text-xl font-display text-dominican-blue mb-6">
                Contenido de la Pregunta
              </h2>
              
              <div className="space-y-6">
                {/* Texto de la pregunta */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Pregunta *
                  </label>
                  <textarea
                    value={questionText}
                    onChange={(e) => setQuestionText(e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-dominican-blue"
                    placeholder="¿Cuál es la capital de República Dominicana?"
                    rows={3}
                    maxLength={500}
                  />
                  <div className="text-right text-xs text-gray-500 mt-1">
                    {questionText.length}/500
                  </div>
                </div>

                {/* Imagen opcional */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    <ImageIcon className="w-4 h-4 inline mr-1" />
                    Imagen (opcional)
                  </label>
                  <input
                    type="url"
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-dominican-blue"
                    placeholder="https://ejemplo.com/imagen.jpg"
                  />
                </div>

                {/* Tiempo límite */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    <Clock className="w-4 h-4 inline mr-1" />
                    Tiempo Límite (segundos) *
                  </label>
                  <input
                    type="number"
                    value={timeLimit}
                    onChange={(e) => setTimeLimit(Number(e.target.value))}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-dominican-blue"
                    min="5"
                    max="120"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Entre 5 y 120 segundos
                  </p>
                </div>
              </div>
            </div>

            {/* Opciones de respuesta */}
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <h2 className="text-xl font-display text-dominican-blue mb-6">
                Opciones de Respuesta
              </h2>
              
              <div className="space-y-4">
                {options.map((option, index) => (
                  <div key={index} className="relative">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Opción {index + 1} *
                      {index === correctAnswer && (
                        <span className="ml-2 text-palma font-normal">
                          (Respuesta Correcta)
                        </span>
                      )}
                    </label>
                    
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={option}
                        onChange={(e) => handleOptionChange(index, e.target.value)}
                        className={`flex-1 p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-dominican-blue ${
                          index === correctAnswer
                            ? 'border-palma/40 bg-palma/10'
                            : 'border-gray-300'
                        }`}
                        placeholder={`Escribe la opción ${index + 1}...`}
                        maxLength={200}
                      />
                      
                      <button
                        onClick={() => setCorrectAnswer(index)}
                        className={`p-3 rounded-lg transition-colors ${
                          index === correctAnswer
                            ? 'bg-palma text-white'
                            : 'bg-gray-200 text-gray-600 hover:bg-green-200'
                        }`}
                        title="Marcar como respuesta correcta"
                      >
                        <CheckCircle className="w-5 h-5" />
                      </button>
                    </div>
                    
                    <div className="text-right text-xs text-gray-500 mt-1">
                      {option.length}/200
                    </div>
                  </div>
                ))}
              </div>

              {/* Instrucciones */}
              <div className="mt-6 p-4 bg-arena border border-dominican-blue/20 rounded-lg">
                <h3 className="font-semibold text-dominican-blue mb-2">
                  💡 Consejos para crear buenas preguntas:
                </h3>
                <ul className="text-sm text-dominican-blue space-y-1">
                  <li>• Haz preguntas claras y específicas</li>
                  <li>• Asegúrate de que solo una respuesta sea correcta</li>
                  <li>• Evita opciones obviamente incorrectas</li>
                  <li>• Usa un lenguaje apropiado para tu audiencia</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Botones de acción en móvil */}
        <div className="lg:hidden mt-8 flex gap-3">
          <button
            onClick={handleSave}
            disabled={!isFormValid() || saving}
            className="btn-dominican-primary flex-1 disabled:opacity-50"
          >
            <Save className="w-4 h-4 mr-2" />
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
          
          <button
            onClick={onCancel}
            className="btn-dominican-outline flex-1"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}

export default QuestionEditor