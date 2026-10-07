import React, { useState } from 'react'
import { Shield, Users, Gamepad2, Mail, Eye, EyeOff } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

const AuthScreen: React.FC = () => {
  const {
    signInWithGoogle,
    signInWithEmail,
    signUpWithEmail,
    verifyEmail,
    resendVerificationEmail,
    resetPassword,
    confirmPasswordReset,
    submitting: loading,
    error
  } = useAuth()
  // 'verify' y 'reset-confirm' son los pasos donde se introduce el código enviado por correo
  const [authMode, setAuthMode] = useState<'login' | 'register' | 'reset' | 'verify' | 'reset-confirm'>('login')
  const [showPassword, setShowPassword] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    fullName: '',
    code: ''
  })
  const isCodeStep = authMode === 'verify' || authMode === 'reset-confirm'

  const features = [
    {
      icon: Gamepad2,
      title: 'Juegos Interactivos',
      description: 'Crea y participa en trivias en tiempo real'
    },
    {
      icon: Users,
      title: 'Multijugador',
      description: 'Hasta 20 jugadores por sala'
    },
    {
      icon: Shield,
      title: 'Seguro y Confiable',
      description: 'Autenticación segura'
    }
  ]

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    })
  }

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setNotice(null)
    
    if (authMode === 'login') {
      const { needsVerification } = await signInWithEmail(formData.email, formData.password)
      if (needsVerification) {
        setAuthMode('verify')
      }
    } else if (authMode === 'register') {
      const { needsVerification } = await signUpWithEmail(formData.email, formData.password, formData.fullName)
      if (needsVerification) {
        setAuthMode('verify')
        setNotice('Te enviamos un código de 6 dígitos a tu correo.')
      }
    } else if (authMode === 'verify') {
      await verifyEmail(formData.email, formData.code.trim())
    } else if (authMode === 'reset') {
      const sent = await resetPassword(formData.email)
      if (sent) {
        setFormData({ ...formData, password: '', code: '' })
        setAuthMode('reset-confirm')
        setNotice('Si el correo está registrado, te enviamos un código de 6 dígitos.')
      }
    } else if (authMode === 'reset-confirm') {
      const changed = await confirmPasswordReset(formData.email, formData.code.trim(), formData.password)
      if (changed) {
        setFormData({ ...formData, password: '', code: '' })
        setAuthMode('login')
        setNotice('Contraseña actualizada. Ya puedes iniciar sesión.')
      }
    }
  }

  const handleResendCode = async () => {
    setNotice(null)
    const sent = await resendVerificationEmail(formData.email)
    if (sent) {
      setNotice('Te enviamos un nuevo código a tu correo.')
    }
  }

  const switchMode = (mode: 'login' | 'register' | 'reset') => {
    setNotice(null)
    setAuthMode(mode)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-dominican-blue via-dominican-blue-light to-dominican-red">
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-4xl w-full">
          <div className="text-center mb-12">
            {/* Logo y título principal */}
            <div className="mb-8">
              <h1 className="text-6xl md:text-8xl font-bold text-white mb-4 animate-slide-in-down">
                KLKTUSABES
              </h1>
              <div className="w-32 h-2 bg-dominican-red mx-auto mb-4 rounded-full"></div>
              <p className="text-xl md:text-2xl text-blue-100 font-semibold">
                🇩🇴 Trivia Dominicana Interactiva 🇩🇴
              </p>
            </div>

            {/* Descripción */}
            <p className="text-lg text-blue-100 mb-8 max-w-2xl mx-auto">
              La primera plataforma de trivia interactiva con sabor dominicano. 
              Crea, comparte y disfruta de juegos de preguntas en tiempo real con tus amigos.
            </p>
          </div>

          {/* Características principales */}
          <div className="grid md:grid-cols-3 gap-6 mb-12 animate-slide-in-up">
            {features.map((feature, index) => (
              <div 
                key={index}
                className="bg-white/10 backdrop-blur-lg rounded-xl p-6 text-center hover:bg-white/20 transition-all duration-300 hover:scale-105"
              >
                <feature.icon className="w-12 h-12 text-white mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-white mb-2">{feature.title}</h3>
                <p className="text-blue-100 text-sm">{feature.description}</p>
              </div>
            ))}
          </div>

          {/* Sección de autenticación */}
          <div className="max-w-md mx-auto">
            <div className="bg-white rounded-2xl shadow-2xl p-8 animate-slide-in-up">
              <div className="text-center mb-6">
                <h2 className="text-2xl font-bold text-gray-800 mb-2">
                  {authMode === 'login' && '¡Únete a la Diversión!'}
                  {authMode === 'register' && '¡Crea tu Cuenta!'}
                  {(authMode === 'reset' || authMode === 'reset-confirm') && 'Restablecer Contraseña'}
                  {authMode === 'verify' && 'Verifica tu Correo'}
                </h2>
                <p className="text-gray-600">
                  {authMode === 'login' && 'Inicia sesión para crear o participar en trivias'}
                  {authMode === 'register' && 'Regístrate para empezar a jugar'}
                  {authMode === 'reset' && 'Te enviaremos un código para restablecer tu contraseña'}
                  {authMode === 'verify' && 'Escribe el código de 6 dígitos que enviamos a tu correo'}
                  {authMode === 'reset-confirm' && 'Escribe el código que recibiste y tu nueva contraseña'}
                </p>
              </div>

              {/* Tabs de autenticación */}
              <div className="flex mb-6 bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => switchMode('login')}
                  className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                    authMode === 'login'
                      ? 'bg-white text-dominican-blue shadow-sm'
                      : 'text-gray-600 hover:text-gray-800'
                  }`}
                >
                  Iniciar Sesión
                </button>
                <button
                  onClick={() => switchMode('register')}
                  className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                    authMode === 'register'
                      ? 'bg-white text-dominican-blue shadow-sm'
                      : 'text-gray-600 hover:text-gray-800'
                  }`}
                >
                  Registrarse
                </button>
              </div>

              {/* Formulario de email/contraseña */}
              <form onSubmit={handleEmailAuth} className="space-y-4 mb-6">
                {authMode === 'register' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Nombre Completo
                    </label>
                    <input
                      type="text"
                      name="fullName"
                      value={formData.fullName}
                      onChange={handleInputChange}
                      required
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-dominican-blue focus:border-transparent"
                      placeholder="Tu nombre completo"
                    />
                  </div>
                )}
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Correo Electrónico
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      required
                      readOnly={isCodeStep}
                      className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-dominican-blue focus:border-transparent"
                      placeholder="tu@email.com"
                    />
                  </div>
                </div>

                {isCodeStep && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Código de Verificación
                    </label>
                    <input
                      type="text"
                      name="code"
                      value={formData.code}
                      onChange={handleInputChange}
                      required
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={6}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-dominican-blue focus:border-transparent tracking-widest text-center text-lg"
                      placeholder="000000"
                    />
                  </div>
                )}

                {authMode !== 'reset' && authMode !== 'verify' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {authMode === 'reset-confirm' ? 'Nueva Contraseña' : 'Contraseña'}
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        name="password"
                        value={formData.password}
                        onChange={handleInputChange}
                        required
                        className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-dominican-blue focus:border-transparent"
                        placeholder="Tu contraseña"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
                      >
                        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-dominican-blue hover:bg-dominican-blue-light text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                >
                  {loading ? (
                    <div className="loading-spinner"></div>
                  ) : (
                    <>
                      {authMode === 'login' && 'Iniciar Sesión'}
                      {authMode === 'register' && 'Crear Cuenta'}
                      {authMode === 'reset' && 'Enviar Código'}
                      {authMode === 'verify' && 'Verificar Correo'}
                      {authMode === 'reset-confirm' && 'Cambiar Contraseña'}
                    </>
                  )}
                </button>
              </form>

              {/* Enlaces adicionales */}
              {authMode === 'login' && (
                <div className="text-center mb-4">
                  <button
                    onClick={() => switchMode('reset')}
                    className="text-sm text-dominican-blue hover:underline"
                  >
                    ¿Olvidaste tu contraseña?
                  </button>
                </div>
              )}

              {authMode === 'verify' && (
                <div className="text-center mb-4">
                  <button
                    onClick={handleResendCode}
                    className="text-sm text-dominican-blue hover:underline"
                  >
                    Reenviar código
                  </button>
                </div>
              )}

              {(authMode === 'reset' || isCodeStep) && (
                <div className="text-center mb-4">
                  <button
                    onClick={() => switchMode('login')}
                    className="text-sm text-dominican-blue hover:underline"
                  >
                    Volver al inicio de sesión
                  </button>
                </div>
              )}

              {/* Divider */}
              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white text-gray-500">o</span>
                </div>
              </div>

              {/* Botón de login con Google */}
              <button
                onClick={signInWithGoogle}
                disabled={loading}
                className="w-full bg-white border-2 border-gray-300 hover:bg-gray-50 text-gray-700 font-semibold py-3 px-6 rounded-lg transition-all duration-200 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-center gap-3"
              >
                {loading ? (
                  <div className="loading-spinner"></div>
                ) : (
                  <>
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                    Continuar con Google
                  </>
                )}
              </button>

              {/* Mensaje informativo */}
              {notice && (
                <div className="mt-4 p-3 bg-green-100 border border-green-400 text-green-700 rounded-lg text-sm">
                  {notice}
                </div>
              )}

              {/* Mensaje de error */}
              {error && (
                <div className="mt-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-lg text-sm">
                  {error}
                </div>
              )}

              {/* Información adicional */}
              <div className="mt-6 text-center">
                <p className="text-xs text-gray-500 mb-4">
                  Al continuar, aceptas nuestros términos de servicio
                </p>
                
                <div className="flex items-center justify-center gap-4 text-xs text-gray-400">
                  <span>🔒 Seguro</span>
                  <span>⚡ Rápido</span>
                  <span>🎮 Divertido</span>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="text-center mt-12">
            <p className="text-blue-100 text-sm">
              Hecho con ❤️ para la comunidad dominicana
            </p>
            <div className="flex justify-center gap-2 mt-2">
              <span className="text-2xl">🇩🇴</span>
              <span className="text-blue-100 text-sm">República Dominicana</span>
              <span className="text-2xl">🇩🇴</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AuthScreen