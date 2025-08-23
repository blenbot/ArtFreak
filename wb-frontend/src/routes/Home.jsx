import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Wifi, WifiOff, Palette, Sparkles, Users, Zap } from 'lucide-react';

const API = (import.meta.env.MODE === 'development')  
  ? 'http://localhost:1234' 
  : 'https://artfreak-production.up.railway.app';

// Dark mode toggle component
const DarkModeToggle = () => {
  const [isDark, setIsDark] = useState(
    localStorage.getItem('theme') === 'dark' || 
    (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches)
  );

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDark]);

  return (
    <button
      onClick={() => setIsDark(!isDark)}
      className="p-2 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 hover:bg-white/20 transition-all duration-300 group"
    >
      <div className="w-6 h-6 relative">
        {isDark ? (
          <div className="text-yellow-300 group-hover:rotate-180 transition-transform duration-500">🌙</div>
        ) : (
          <div className="text-orange-400 group-hover:rotate-180 transition-transform duration-500">☀️</div>
        )}
      </div>
    </button>
  );
};

// Connection status component
const ConnectionStatus = ({ status, isMobile }) => {
  const getStatusConfig = () => {
    switch (status) {
      case 'connected': 
        return { 
          icon: Wifi, 
          text: 'Connected', 
          color: 'text-emerald-400',
          bg: 'bg-emerald-500/10 border-emerald-500/20'
        };
      case 'poor': 
        return { 
          icon: Wifi, 
          text: 'Poor Connection', 
          color: 'text-amber-400',
          bg: 'bg-amber-500/10 border-amber-500/20'
        };
      case 'offline': 
        return { 
          icon: WifiOff, 
          text: isMobile ? 'Disconnected' : 'Server Offline', 
          color: 'text-red-400',
          bg: 'bg-red-500/10 border-red-500/20'
        };
      default: 
        return { 
          icon: Wifi, 
          text: 'Connecting...', 
          color: 'text-slate-400',
          bg: 'bg-slate-500/10 border-slate-500/20'
        };
    }
  };

  const { icon: Icon, text, color, bg } = getStatusConfig();

  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full backdrop-blur-sm border ${bg} ${color} text-xs font-medium`}>
      <Icon size={12} />
      <span>{text}</span>
      {isMobile && <span className="opacity-60 text-[10px]">📱</span>}
    </div>
  );
};

// Animated toggle switch component
const ModeToggle = ({ createMode, setCreateMode, disabled }) => {
  return (
    <div className="relative">
      <div 
        className={`relative w-72 h-16 rounded-2xl cursor-pointer transition-all duration-300 ${
          disabled ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105'
        }`}
        onClick={() => !disabled && setCreateMode(!createMode)}
        style={{
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          boxShadow: '0 8px 32px rgba(102, 126, 234, 0.3)'
        }}
      >
        {/* Sliding background */}
        <div 
          className={`absolute top-1 h-14 w-[calc(50%-4px)] bg-white rounded-xl shadow-lg transition-all duration-500 ease-out ${
            !createMode ? "left-[calc(50%+2px)]" : "left-1"
          }`}
          style={{
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)'
          }}
        />
        
        {/* Text labels */}
        <div className="relative flex h-full">
          <div className={`flex-1 flex items-center justify-center text-lg font-semibold z-10 transition-all duration-300 ${
            createMode ? "text-slate-700" : "text-white/90"
          }`}>
            <Sparkles className="mr-2" size={18} />
            Create
          </div>
          <div className={`flex-1 flex items-center justify-center text-lg font-semibold z-10 transition-all duration-300 ${
            !createMode ? "text-slate-700" : "text-white/90"
          }`}>
            <Users className="mr-2" size={18} />
            Join
          </div>
        </div>
      </div>
    </div>
  );
};

// Beautiful action button component
const ActionButton = ({ onClick, loading, disabled, children, variant = 'primary' }) => {
  const baseClasses = "relative w-72 h-16 rounded-2xl font-semibold text-lg transition-all duration-300 overflow-hidden group";
  
  const variants = {
    primary: `bg-gradient-to-r from-violet-600 to-purple-600 text-white shadow-lg hover:shadow-violet-500/25 hover:shadow-xl ${
      !disabled && !loading ? 'hover:-translate-y-1 hover:scale-105' : ''
    }`,
    secondary: "bg-gradient-to-r from-slate-200 to-slate-300 dark:from-slate-700 dark:to-slate-800 text-slate-700 dark:text-slate-200"
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className={`${baseClasses} ${variants[variant]} ${
        disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
      }`}
    >
      {/* Animated background gradient */}
      <div className="absolute inset-0 bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      
      {/* Content */}
      <div className="relative z-10 flex items-center justify-center h-full">
        {loading ? (
          <div className="flex items-center gap-3">
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            <span>Creating...</span>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Zap size={20} />
            {children}
          </div>
        )}
      </div>
    </button>
  );
};

// Beautiful input component
const RoomCodeInput = ({ onSubmit, loading, disabled }) => {
  const [value, setValue] = useState('');

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !loading && !disabled && value.trim()) {
      onSubmit(value);
    }
  };

  const handleChange = (e) => {
    const newValue = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
    setValue(newValue);
  };

  return (
    <div className="relative w-72">
      <input
        type="text"
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder="ENTER ROOM CODE"
        className={`w-full h-16 px-6 text-center text-lg font-semibold tracking-wider rounded-2xl border-2 transition-all duration-300 bg-white/10 backdrop-blur-sm placeholder:text-slate-400 dark:placeholder:text-slate-500 ${
          disabled 
            ? 'opacity-50 cursor-not-allowed border-slate-300 dark:border-slate-600' 
            : 'border-white/30 dark:border-white/20 focus:border-violet-500 dark:focus:border-violet-400 focus:ring-4 focus:ring-violet-500/20 hover:border-violet-400'
        } text-slate-800 dark:text-white outline-none`}
        disabled={disabled}
        maxLength={6}
      />
      {loading && (
        <div className="absolute right-4 top-1/2 transform -translate-y-1/2">
          <div className="w-5 h-5 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
};

// Error message component
const ErrorMessage = ({ error }) => {
  if (!error) return null;

  return (
    <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-50 max-w-md mx-4">
      <div className="bg-red-500/10 backdrop-blur-sm border border-red-500/20 rounded-2xl p-4 text-center">
        <div className="text-red-400 font-semibold mb-2 flex items-center justify-center gap-2">
          <span className="text-xl">⚠️</span>
          Connection Error
        </div>
        <div className="text-red-300 text-sm leading-relaxed">{error}</div>
      </div>
    </div>
  );
};

// Mobile network detection
const isMobileNetwork = () => {
  return navigator.connection && 
         (navigator.connection.type === 'cellular' || 
          navigator.connection.effectiveType === '2g' || 
          navigator.connection.effectiveType === '3g' || 
          navigator.connection.effectiveType === '4g');
};

// Enhanced fetch function
const enhancedFetch = async (url, options = {}) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 20000);

  const defaultOptions = {
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
      'X-Requested-With': 'XMLHttpRequest',
      'Origin': window.location.origin,
      ...(options.headers || {})
    },
    mode: 'cors',
    credentials: 'omit',
    signal: controller.signal,
    ...options
  };

  try {
    const response = await fetch(url, defaultOptions);
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('Request timeout - please check your connection');
    }
    if (error.message.includes('Failed to fetch')) {
      throw new Error('Network error - unable to reach server');
    }
    throw error;
  }
};

// Retry mechanism
const retryRequest = async (requestFn, maxRetries = 4, delay = 1500) => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await requestFn();
    } catch (error) {
      console.log(`Attempt ${i + 1}/${maxRetries} failed:`, error.message);
      
      if (i === maxRetries - 1) {
        throw error;
      }
      
      const jitter = Math.random() * 1000;
      const backoffDelay = delay * Math.pow(2, i) + jitter;
      await new Promise(resolve => setTimeout(resolve, backoffDelay));
    }
  }
};

export default function Home() {
  const [createMode, setCreateMode] = useState(true);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('checking');
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const navigate = useNavigate();

  const isMobile = isMobileNetwork();

  // Monitor online/offline status
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setConnectionStatus('checking');
      checkServerHealth();
    };

    const handleOffline = () => {
      setIsOnline(false);
      setConnectionStatus('offline');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    if (isOnline) {
      checkServerHealth();
    }
  }, [isOnline]);

  // Auto-clear errors after 5 seconds
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  const checkServerHealth = async () => {
    if (!isOnline) {
      setConnectionStatus('offline');
      return;
    }

    try {
      setConnectionStatus('checking');
      const response = await enhancedFetch(`${API}/health`);
      
      if (response.ok) {
        setConnectionStatus('connected');
      } else {
        setConnectionStatus('poor');
      }
    } catch (error) {
      console.error('Server health check failed:', error);
      setConnectionStatus('offline');
    }
  };

  const checkAndJoinRoom = async (code) => {
    if (!code || code.trim().length === 0) {
      setError('Please enter a valid room code');
      return;
    }

    if (!isOnline) {
      setError('You are currently offline. Please check your internet connection.');
      return;
    }

    setError(null);
    setLoading(true);

    try {
      await retryRequest(async () => {
        const response = await enhancedFetch(`${API}/check-room?roomCode=${encodeURIComponent(code.trim().toUpperCase())}`);
        
        if (!response.ok) {
          if (response.status === 429) {
            throw new Error('Too many requests. Please wait a moment and try again.');
          }
          if (response.status >= 500) {
            throw new Error('Server error. Please try again in a moment.');
          }
          throw new Error(`Server error: ${response.status}`);
        }

        const data = await response.json();
        
        if (data.exists) {
          navigate(`/${code.trim().toUpperCase()}`);
        } else {
          setError('Room not found. Please check the room code and try again.');
        }
      }, 4, 2000);
    } catch (error) {
      console.error('Error finding room:', error);
      let errorMessage = 'Unable to find room. ';
      
      if (error.message.includes('timeout')) {
        errorMessage += 'Connection timeout - please check your internet connection.';
      } else if (error.message.includes('429')) {
        errorMessage += 'Too many requests. Please wait and try again.';
      } else if (error.message.includes('Network error')) {
        errorMessage += 'Network error. Please check your connection and try again.';
      } else {
        errorMessage += error.message;
      }
      
      if (isMobile) {
        errorMessage += ' (Try switching to WiFi if available)';
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };
  
  const createRoom = async () => {
    if (!isOnline) {
      setError('You are currently offline. Please check your internet connection.');
      return;
    }

    setError(null);
    setLoading(true);

    try {
      await retryRequest(async () => {
        const response = await enhancedFetch(`${API}/create-room`);
        
        if (!response.ok) {
          if (response.status === 429) {
            throw new Error('Too many requests. Please wait a moment and try again.');
          }
          if (response.status >= 500) {
            throw new Error('Server error. Please try again in a moment.');
          }
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        
        if (data.roomCode) {
          navigate(`/${data.roomCode}`);
        } else {
          throw new Error('Invalid response from server - no room code received');
        }
      }, 4, 2000);
    } catch (error) {
      console.error('Error creating room:', error);
      let errorMessage = 'Unable to create room. ';
      
      if (error.message.includes('timeout')) {
        errorMessage += 'Connection timeout - please check your internet connection.';
      } else if (error.message.includes('Network error')) {
        errorMessage += 'Network error. Please check your connection and try again.';
      } else if (error.message.includes('500')) {
        errorMessage += 'Server temporarily unavailable. Please try again.';
      } else {
        errorMessage += error.message;
      }
      
      if (isMobile) {
        errorMessage += ' (Try switching to WiFi or toggle airplane mode)';
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const isDisabled = loading || !isOnline || connectionStatus === 'offline';

  return (
    <div className="min-h-screen w-full relative overflow-hidden">
      {/* Animated background */}
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900" />
      <div className="absolute inset-0 bg-gradient-to-tl from-blue-900/50 via-transparent to-emerald-900/50" />
      
      {/* Animated background shapes */}
      <div className="absolute top-20 left-10 w-72 h-72 bg-violet-500/20 rounded-full blur-3xl animate-pulse" />
      <div className="absolute bottom-20 right-10 w-96 h-96 bg-pink-500/20 rounded-full blur-3xl animate-pulse" style={{animationDelay: '2s'}} />
      <div className="absolute top-1/3 right-1/4 w-80 h-80 bg-blue-500/20 rounded-full blur-3xl animate-pulse" style={{animationDelay: '4s'}} />

      {/* Header */}
      <header className="absolute top-4 left-0 right-0 flex justify-between items-center px-6 z-10">
        <ConnectionStatus status={connectionStatus} isMobile={isMobile} />
        <DarkModeToggle />
      </header>

      {/* Main content */}
      <main className="relative z-10 flex flex-col items-center justify-center min-h-screen px-4">
        {/* Logo */}
        <div className="text-center mb-12">
          <h1 className="text-7xl md:text-8xl lg:text-9xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-white via-purple-200 to-pink-200 mb-4 tracking-tight">
            ArtFreak
          </h1>
          <p className="text-xl md:text-2xl text-white/80 font-medium flex items-center justify-center gap-3">
            <Palette className="text-pink-300" size={24} />
            unleash your creativity
            <Sparkles className="text-yellow-300" size={24} />
          </p>
        </div>

        {/* Main card */}
        <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-3xl p-8 shadow-2xl max-w-md w-full">
          <div className="space-y-6">
            {/* Mode toggle */}
            <div className="flex justify-center">
              <ModeToggle 
                createMode={createMode} 
                setCreateMode={setCreateMode}
                disabled={isDisabled}
              />
            </div>

            {/* Action area */}
            <div className="flex justify-center">
              {createMode ? (
                <ActionButton
                  onClick={createRoom}
                  loading={loading}
                  disabled={isDisabled}
                >
                  Create Room
                </ActionButton>
              ) : (
                <RoomCodeInput
                  onSubmit={checkAndJoinRoom}
                  loading={loading}
                  disabled={isDisabled}
                />
              )}
            </div>

            {/* Mobile network info */}
            {isMobile && connectionStatus === 'connected' && (
              <div className="text-center text-sm text-white/60 bg-white/5 rounded-xl p-3 border border-white/10">
                <span className="inline-block mr-2">📱</span>
                Mobile network detected. WiFi recommended for optimal performance.
              </div>
            )}
          </div>
        </div>

        {/* Retry button */}
        {(!isOnline || connectionStatus === 'offline') && (
          <button 
            onClick={() => {
              if (!isOnline) {
                window.location.reload();
              } else {
                checkServerHealth();
              }
            }}
            className="mt-8 px-6 py-3 bg-white/20 backdrop-blur-sm border border-white/30 text-white rounded-2xl hover:bg-white/30 transition-all duration-300"
          >
            {!isOnline ? '🔄 Refresh Page' : '🔄 Retry Connection'}
          </button>
        )}

        {/* Troubleshooting tips */}
        {(!isOnline || connectionStatus === 'offline' || connectionStatus === 'poor') && (
          <div className="mt-6 max-w-sm text-center space-y-3 bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10">
            <p className="font-semibold text-white/90 flex items-center justify-center gap-2">
              <span className="text-lg">🔧</span>
              {!isOnline ? 'You are offline' : 'Connection Issues?'}
            </p>
            <div className="text-sm text-white/70 space-y-1">
              {!isOnline ? (
                <>
                  <p>• Check your internet connection</p>
                  <p>• Make sure WiFi or mobile data is on</p>
                  <p>• Try refreshing the page</p>
                </>
              ) : (
                <>
                  <p>• Switch to WiFi if on mobile data</p>
                  <p>• Toggle airplane mode on/off</p>
                  <p>• Clear browser cache</p>
                  <p>• Disable VPN temporarily</p>
                </>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Error message */}
      <ErrorMessage error={error} />
    </div>
  );
}