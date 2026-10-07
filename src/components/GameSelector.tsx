import React, { useState } from 'react'
import { Search, Play, Clock, HelpCircle, ArrowLeft } from 'lucide-react'
import { Game } from '../types'

interface GameSelectorProps {
  games: Game[]
  onSelectGame: (game: Game) => void
  onBack: () => void
  title?: string
}

const GameSelector: React.FC<GameSelectorProps> = ({
  games,
  onSelectGame,
  onBack,
  title = "Selecciona un Juego"
}) => {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedGame, setSelectedGame] = useState<Game | null>(null)

  // Filtrar juegos basado en la búsqueda
  const filteredGames = games.filter(game =>
    game.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    game.description?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const handleGameSelect = (game: Game) => {
    setSelectedGame(game)
  }

  const handleConfirmSelection = () => {
    if (selectedGame) {
      onSelectGame(selectedGame)
    }
  }

  return (
    <div className="min-h-screen fondo-caribe">
      {/* Header */}
      <div className="cabecera">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className="text-white/85 hover:text-white"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
            <h1 className="font-display text-2xl text-white">{title}</h1>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Barra de búsqueda */}
        <div className="mb-8">
          <div className="relative max-w-md mx-auto">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-dominican-blue"
              placeholder="Buscar juegos..."
            />
          </div>
        </div>

        {filteredGames.length === 0 ? (
          // Estado vacío
          <div className="text-center py-12">
            <div className="w-24 h-24 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
              <HelpCircle className="w-12 h-12 text-gray-400" />
            </div>
            <h3 className="text-xl font-semibold text-dominican-blue-dark mb-2">
              {searchTerm ? 'No se encontraron juegos' : 'No hay juegos disponibles'}
            </h3>
            <p className="text-gray-600 mb-6">
              {searchTerm 
                ? 'Intenta con otros términos de búsqueda'
                : 'Los creadores aún no han publicado juegos'
              }
            </p>
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="btn-dominican-outline"
              >
                Limpiar Búsqueda
              </button>
            )}
          </div>
        ) : (
          // Lista de juegos
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredGames.map((game) => (
              <div
                key={game.id}
                onClick={() => handleGameSelect(game)}
                className={`bg-white rounded-2xl shadow-lg p-6 cursor-pointer transition-all duration-300 hover:shadow-xl hover:scale-105 ${
                  selectedGame?.id === game.id
                    ? 'ring-2 ring-dominican-blue bg-arena'
                    : 'hover:bg-arena'
                }`}
              >
                {/* Header del juego */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-dominican-blue-dark mb-2 line-clamp-2">
                      {game.title}
                    </h3>
                    {game.description && (
                      <p className="text-gray-600 text-sm line-clamp-3">
                        {game.description}
                      </p>
                    )}
                  </div>
                  
                  {selectedGame?.id === game.id && (
                    <div className="ml-2">
                      <div className="w-6 h-6 bg-dominican-blue rounded-full flex items-center justify-center">
                        <div className="w-2 h-2 bg-white rounded-full"></div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Estadísticas del juego */}
                <div className="flex items-center gap-4 text-sm text-gray-600 mb-4">
                  <div className="flex items-center gap-1">
                    <HelpCircle className="w-4 h-4" />
                    <span>{game.questions?.length || 0} preguntas</span>
                  </div>
                  
                  <div className="flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    <span>
                      {game.questions?.reduce((acc, q) => acc + q.time_limit, 0) || 0}s total
                    </span>
                  </div>
                </div>


                {/* Botón de selección */}
                <div className="mt-4">
                  <button
                    className={`w-full py-2 px-4 rounded-lg font-semibold transition-colors ${
                      selectedGame?.id === game.id
                        ? 'bg-dominican-blue text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {selectedGame?.id === game.id ? 'Seleccionado' : 'Seleccionar'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Botón de confirmación */}
        {selectedGame && (
          <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-6 shadow-lg">
            <div className="max-w-6xl mx-auto flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-dominican-blue rounded-lg flex items-center justify-center">
                  <Play className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h4 className="font-semibold text-dominican-blue-dark">{selectedGame.title}</h4>
                  <p className="text-sm text-gray-600">
                    {selectedGame.questions?.length || 0} preguntas • 
                    {' '}~{Math.ceil((selectedGame.questions?.reduce((acc, q) => acc + q.time_limit, 0) || 0) / 60)} min
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setSelectedGame(null)}
                  className="btn-dominican-outline py-2 px-6"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleConfirmSelection}
                  className="btn-dominican-primary py-2 px-6"
                >
                  <Play className="w-4 h-4 mr-2" />
                  Iniciar Juego
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default GameSelector