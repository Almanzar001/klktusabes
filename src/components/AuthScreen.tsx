import React, { useState } from 'react'
import { Shield, Users, Gamepad2, Mail, Eye, EyeOff } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import AnswerBadge, { ANSWER_STYLES } from './AnswerBadge'

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

  const inputClass = 'w-full px-4 py-3 bg-arena border-2 border-dominican-blue/20 rounded-xl focus:outline-none focus:border-dominican-blue'

  return (
    <div className="min-h-screen fondo-caribe text-dominican-blue-dark">
      <div className="min-h-screen flex items-center justify-center px-4 py-8">
        <div className="max-w-4xl w-full">
          {/* Logo y título principal */}
          <div className="text-center mb-8">
            <h1 className="font-display text-6xl md:text-8xl text-dominican-blue animate-slide-in-down">
              KLKTUSABES
            </h1>
            {/* franja de la bandera */}
            <div className="flex w-40 h-2 mx-auto my-3 rounded-full overflow-hidden shadow">
              <span className="flex-1 bg-dominican-blue" />
              <span className="flex-1 bg-white" />
              <span className="flex-1 bg-dominican-red" />
            </div>
            <p className="font-display text-xl md:text-2xl text-dominican-red">
              La trivia con sabor dominicano
            </p>
            <p className="text-gray-600 font-semibold mt-2 max-w-xl mx-auto">
              Crea, comparte y juega preguntas en tiempo real con tu gente.
            </p>

            {/* Los cuatro símbolos de las respuestas del juego */}
            <div className="flex justify-center gap-3 mt-5" aria-hidden="true">
              {ANSWER_STYLES.map((style) => (
                <span key={style.icon} className={`${style.bg} tablita w-14 h-14 rounded-2xl border-4 border-white shadow-lg flex items-center justify-center`}>
                  <AnswerBadge icon={style.icon} color={style.text} className="w-9 h-9" />
                </span>
              ))}
            </div>
          </div>

          {/* Sección de autenticación */}
          <div className="max-w-md mx-auto">
            <div className="bg-white rounded-2xl shadow-xl border-t-8 border-dominican-red p-6 sm:p-8 animate-slide-in-up">
              <div className="text-center mb-6">
                <h2 className="font-display text-3xl text-dominican-blue mb-1">
                  {authMode === 'login' && '¡Entra a jugar!'}
                  {authMode === 'register' && '¡Crea tu cuenta!'}
                  {(authMode === 'reset' || authMode === 'reset-confirm') && 'Restablecer contraseña'}
                  {authMode === 'verify' && 'Verifica tu correo'}
                </h2>
                <p className="text-gray-600 font-semibold text-sm">
                  {authMode === 'login' && 'Inicia sesión para crear o participar en trivias'}
                  {authMode === 'register' && 'Regístrate para empezar a jugar'}
                  {authMode === 'reset' && 'Te enviaremos un código para restablecer tu contraseña'}
                  {authMode === 'verify' && 'Escribe el código de 6 dígitos que enviamos a tu correo'}
                  {authMode === 'reset-confirm' && 'Escribe el código que recibiste y tu nueva contraseña'}
                </p>
              </div>

              {/* Tabs de autenticación */}
              <div className="flex mb-6 bg-arena rounded-xl p-1">
                <button
                  onClick={() => switchMode('login')}
                  className={`flex-1 py-2 px-4 rounded-lg font-display transition-colors ${
                    authMode === 'login'
                      ? 'bg-dominican-blue text-white shadow'
                      : 'text-gray-600 hover:text-dominican-blue'
                  }`}
                >
                  Iniciar sesión
                </button>
                <button
                  onClick={() => switchMode('register')}
                  className={`flex-1 py-2 px-4 rounded-lg font-display transition-colors ${
                    authMode === 'register'
                      ? 'bg-dominican-blue text-white shadow'
                      : 'text-gray-600 hover:text-dominican-blue'
                  }`}
                >
                  Registrarse
                </button>
              </div>

              {/* Formulario de email/contraseña */}
              <form onSubmit={handleEmailAuth} className="space-y-4 mb-5">
                {authMode === 'register' && (
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1.5">
                      Nombre completo
                    </label>
                    <input
                      type="text"
                      name="fullName"
                      value={formData.fullName}
                      onChange={handleInputChange}
                      required
                      className={inputClass}
                      placeholder="Tu nombre completo"
                    />
                  </div>
                )}
                
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1.5">
                    Correo electrónico
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-3.5 w-5 h-5 text-gray-400" />
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      required
                      readOnly={isCodeStep}
                      className={`${inputClass} pl-12`}
                      placeholder="tu@email.com"
                    />
                  </div>
                </div>

                {isCodeStep && (
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1.5">
                      Código de verificación
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
                      className={`${inputClass} font-display text-2xl tracking-widest text-center text-dominican-blue`}
                      placeholder="000000"
                    />
                  </div>
                )}

                {authMode !== 'reset' && authMode !== 'verify' && (
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1.5">
                      {authMode === 'reset-confirm' ? 'Nueva contraseña' : 'Contraseña'}
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        name="password"
                        value={formData.password}
                        onChange={handleInputChange}
                        required
                        className={`${inputClass} pr-12`}
                        placeholder="Tu contraseña"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-3.5 text-gray-400 hover:text-dominican-blue"
                        aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                      >
                        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="btn-dominican-secondary w-full text-xl disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-white"></div>
                  ) : (
                    <>
                      {authMode === 'login' && 'Iniciar sesión'}
                      {authMode === 'register' && 'Crear cuenta'}
                      {authMode === 'reset' && 'Enviar código'}
                      {authMode === 'verify' && 'Verificar correo'}
                      {authMode === 'reset-confirm' && 'Cambiar contraseña'}
                    </>
                  )}
                </button>
              </form>

              {/* Enlaces adicionales */}
              {authMode === 'login' && (
                <div className="text-center mb-4">
                  <button
                    onClick={() => switchMode('reset')}
                    className="text-sm font-bold text-dominican-blue hover:underline"
                  >
                    ¿Olvidaste tu contraseña?
                  </button>
                </div>
              )}

              {authMode === 'verify' && (
                <div className="text-center mb-4">
                  <button
                    onClick={handleResendCode}
                    className="text-sm font-bold text-dominican-blue hover:underline"
                  >
                    Reenviar código
                  </button>
                </div>
              )}

              {(authMode === 'reset' || isCodeStep) && (
                <div className="text-center mb-4">
                  <button
                    onClick={() => switchMode('login')}
                    className="text-sm font-bold text-dominican-blue hover:underline"
                  >
                    Volver al inicio de sesión
                  </button>
                </div>
              )}

              {/* Divider */}
              <div className="relative my-5">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t-2 border-dominican-blue/10" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-3 bg-white font-bold text-gray-500">o</span>
                </div>
              </div>

              {/* Botón de login con Google */}
              <button
                onClick={signInWithGoogle}
                disabled={loading}
                className="btn-dominican-outline w-full gap-3 border-2 border-dominican-blue/15 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Continuar con Google
              </button>

              {/* Mensaje informativo */}
              {notice && (
                <div className="mt-4 px-4 py-3 bg-palma/10 border border-palma/40 text-palma rounded-xl text-sm font-semibold">
                  {notice}
                </div>
              )}

              {/* Mensaje de error */}
              {error && (
                <div className="mt-4 px-4 py-3 bg-dominican-red text-white rounded-xl text-sm font-semibold">
                  {error}
                </div>
              )}

              <p className="mt-5 text-center text-xs font-semibold text-gray-500">
                Al continuar, aceptas nuestros términos de servicio
              </p>
            </div>
          </div>

          {/* Características principales */}
          <div className="grid md:grid-cols-3 gap-4 mt-8 animate-slide-in-up">
            {features.map((feature, index) => (
              <div
                key={index}
                className="bg-white rounded-2xl shadow-lg p-5 text-center"
              >
                <feature.icon className="w-9 h-9 text-dominican-red mx-auto mb-2" />
                <h3 className="font-display text-lg text-dominican-blue">{feature.title}</h3>
                <p className="text-gray-600 font-semibold text-sm">{feature.description}</p>
              </div>
            ))}
          </div>

          {/* Footer */}
          <p className="text-center mt-8 text-sm font-semibold text-gray-600">
            Hecho con ❤️ para la comunidad dominicana 🇩🇴
          </p>
        </div>
      </div>
    </div>
  )
}

export default AuthScreen
