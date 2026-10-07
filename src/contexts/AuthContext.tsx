import React, { createContext, useContext, useEffect, useState } from 'react'
import { AuthChangeEvent, type UserSchema } from '@insforge/sdk'
import { insforge, authHelpers } from '../insforge'
import { UserProfile } from '../types'

interface AuthContextType {
  user: UserSchema | null
  userProfile: UserProfile | null
  // loading: verificación inicial de la sesión; submitting: acción de autenticación en curso
  loading: boolean
  submitting: boolean
  error: string | null
  signInWithGoogle: () => Promise<void>
  // Devuelve needsVerification cuando el correo aún no ha sido verificado
  signInWithEmail: (email: string, password: string) => Promise<{ needsVerification: boolean }>
  signUpWithEmail: (email: string, password: string, fullName: string) => Promise<{ needsVerification: boolean }>
  verifyEmail: (email: string, code: string) => Promise<boolean>
  resendVerificationEmail: (email: string) => Promise<boolean>
  // Envía el código de restablecimiento; true si se envió
  resetPassword: (email: string) => Promise<boolean>
  confirmPasswordReset: (email: string, code: string, newPassword: string) => Promise<boolean>
  signOut: () => Promise<void>
  isCreator: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth debe ser usado dentro de un AuthProvider')
  }
  return context
}

interface AuthProviderProps {
  children: React.ReactNode
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<UserSchema | null>(null)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Verificar si el usuario es creador
  const isCreator = userProfile?.role === 'creador'

  // Función para cargar el perfil del usuario
  const loadUserProfile = async (userId: string) => {
    try {
      const { data, error } = await authHelpers.getUserProfile(userId)
      if (error) {
        console.error('Error cargando perfil:', error)
        setError('Error al cargar el perfil del usuario')
        return
      }
      setUserProfile(data)
    } catch (err) {
      console.error('Error inesperado:', err)
      setError('Error inesperado al cargar el perfil')
    }
  }

  // Guardar el usuario que acaba de iniciar sesión y cargar su perfil
  const startSession = async (signedInUser: UserSchema) => {
    setUser(signedInUser)
    await loadUserProfile(signedInUser.id)
  }

  // Inicializar estado de autenticación
  useEffect(() => {
    let cancelled = false

    const initializeAuth = async () => {
      try {
        // Restaura la sesión con la cookie de refresco y completa el retorno de OAuth
        const { user: currentUser, error: sessionError } = await authHelpers.getCurrentUser()
        if (cancelled) return

        // 401 = no hay sesión guardada (visitante sin iniciar sesión)
        if (sessionError && sessionError.statusCode !== 401) {
          console.error('Error obteniendo sesión:', sessionError)
        }

        if (currentUser) {
          await startSession(currentUser)
        }
      } catch (err) {
        console.error('Error inicializando auth:', err)
        if (!cancelled) setError('Error al inicializar la autenticación')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    initializeAuth()

    // La sesión puede cerrarse fuera de signOut (por ejemplo, si expira)
    const unsubscribe = insforge.auth.onAuthStateChange((event) => {
      if (event === AuthChangeEvent.SIGNED_OUT) {
        setUser(null)
        setUserProfile(null)
      }
    })

    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [])

  // Función para iniciar sesión con Google
  const signInWithGoogle = async () => {
    try {
      setSubmitting(true)
      setError(null)

      const { error } = await authHelpers.signInWithGoogle()

      if (error) {
        console.error('Error en login con Google:', error)
        setError('Error al iniciar sesión con Google: ' + error.message)
      }
    } catch (err) {
      console.error('Error inesperado en login:', err)
      setError('Error inesperado al iniciar sesión')
    } finally {
      setSubmitting(false)
    }
  }

  // Función para registrarse con email y contraseña
  const signUpWithEmail = async (email: string, password: string, fullName: string) => {
    try {
      setSubmitting(true)
      setError(null)

      const { data, error } = await authHelpers.signUpWithEmail(email, password, fullName)

      if (error) {
        console.error('Error en registro:', error)
        setError('Error al registrarse: ' + error.message)
        return { needsVerification: false }
      }

      if (data?.requireEmailVerification) {
        return { needsVerification: true }
      }

      if (data?.accessToken && data.user) {
        await startSession(data.user)
      }
    } catch (err) {
      console.error('Error inesperado en registro:', err)
      setError('Error inesperado al registrarse')
    } finally {
      setSubmitting(false)
    }
    return { needsVerification: false }
  }

  // Función para verificar el correo con el código recibido
  const verifyEmail = async (email: string, code: string) => {
    try {
      setSubmitting(true)
      setError(null)

      const { data, error } = await authHelpers.verifyEmail(email, code)

      if (error || !data) {
        console.error('Error verificando correo:', error)
        setError('Código inválido o expirado. Revisa tu correo o solicita uno nuevo.')
        return false
      }

      // La verificación deja la sesión iniciada
      await startSession(data.user)
      return true
    } catch (err) {
      console.error('Error inesperado al verificar correo:', err)
      setError('Error inesperado al verificar el correo')
      return false
    } finally {
      setSubmitting(false)
    }
  }

  // Función para reenviar el código de verificación
  const resendVerificationEmail = async (email: string) => {
    try {
      setError(null)

      const { error } = await authHelpers.resendVerificationEmail(email)

      if (error) {
        console.error('Error reenviando código:', error)
        setError('Error al reenviar el código: ' + error.message)
        return false
      }
      return true
    } catch (err) {
      console.error('Error inesperado al reenviar código:', err)
      setError('Error inesperado al reenviar el código')
      return false
    }
  }

  // Función para iniciar sesión con email y contraseña
  const signInWithEmail = async (email: string, password: string) => {
    try {
      setSubmitting(true)
      setError(null)

      const { data, error } = await authHelpers.signInWithEmail(email, password)

      if (error) {
        console.error('Error en login con email:', error)

        // 403: la cuenta existe pero el correo no está verificado
        if (error.statusCode === 403) {
          setError('Debes verificar tu correo antes de iniciar sesión.')
          return { needsVerification: true }
        }

        setError('Error al iniciar sesión: ' + error.message)
      } else if (data?.user) {
        await startSession(data.user)
      }
    } catch (err) {
      console.error('Error inesperado en login:', err)
      setError('Error inesperado al iniciar sesión')
    } finally {
      setSubmitting(false)
    }
    return { needsVerification: false }
  }

  // Función para restablecer contraseña
  const resetPassword = async (email: string) => {
    try {
      setSubmitting(true)
      setError(null)

      const { error } = await authHelpers.resetPassword(email)

      if (error) {
        console.error('Error al restablecer contraseña:', error)
        setError('Error al enviar correo de restablecimiento: ' + error.message)
        return false
      }
      return true
    } catch (err) {
      console.error('Error inesperado al restablecer contraseña:', err)
      setError('Error inesperado al restablecer contraseña')
      return false
    } finally {
      setSubmitting(false)
    }
  }

  // Función para cambiar la contraseña con el código recibido por correo
  const confirmPasswordReset = async (email: string, code: string, newPassword: string) => {
    try {
      setSubmitting(true)
      setError(null)

      const { error } = await authHelpers.confirmPasswordReset(email, code, newPassword)

      if (error) {
        console.error('Error al cambiar contraseña:', error)
        setError('No se pudo cambiar la contraseña: ' + error.message)
        return false
      }
      return true
    } catch (err) {
      console.error('Error inesperado al cambiar contraseña:', err)
      setError('Error inesperado al cambiar la contraseña')
      return false
    } finally {
      setSubmitting(false)
    }
  }

  // Función para cerrar sesión
  const signOut = async () => {
    try {
      setSubmitting(true)
      setError(null)

      const { error } = await authHelpers.signOut()

      if (error) {
        console.error('Error en logout:', error)
        setError('Error al cerrar sesión: ' + error.message)
      } else {
        // Limpiar estado local
        setUser(null)
        setUserProfile(null)
      }
    } catch (err) {
      console.error('Error inesperado en logout:', err)
      setError('Error inesperado al cerrar sesión')
    } finally {
      setSubmitting(false)
    }
  }

  const value: AuthContextType = {
    user,
    userProfile,
    loading,
    submitting,
    error,
    signInWithGoogle,
    signInWithEmail,
    signUpWithEmail,
    verifyEmail,
    resendVerificationEmail,
    resetPassword,
    confirmPasswordReset,
    signOut,
    isCreator
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}
