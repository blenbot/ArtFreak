import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { DarkModeToggle } from '../components/uiElements';

const API = (import.meta.env.MODE === 'development')  
  ? 'http://localhost:1234' 
  : 'https://artfreak-production.up.railway.app';

// Mobile network detection
const isMobileNetwork = () => {
  return navigator.connection && 
         (navigator.connection.type === 'cellular' || 
          navigator.connection.effectiveType === '2g' || 
          navigator.connection.effectiveType === '3g' || 
          navigator.connection.effectiveType === '4g');
};

// Enhanced fetch with mobile network optimizations
const enhancedFetch = async (url, options = {}) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout for mobile

  const defaultOptions = {
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
      ...(options.headers || {})
    },
    mode: 'cors',
    credentials: 'include',
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
    throw error;
  }
};

// Retry mechanism for mobile networks
const retryRequest = async (requestFn, maxRetries = 3, delay = 1000) => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await requestFn();
    } catch (error) {
      console.log(`Attempt ${i + 1} failed:`, error.message);
      
      if (i === maxRetries - 1) {
        throw error;
      }
      
      // Exponential backoff with jitter for mobile networks
      const backoffDelay = delay * Math.pow(2, i) + Math.random() * 1000;
      await new Promise(resolve => setTimeout(resolve, backoffDelay));
    }
  }
};

export default function Home() {
  const [createMode, setCreateMode] = useState(true);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('checking');
  const navigate = useNavigate();

  // Check server connectivity on mount
  useEffect(() => {
    checkServerHealth();
  }, []);

  const checkServerHealth = async () => {
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

    setError(null);
    setLoading(true);

    try {
      await retryRequest(async () => {
        const response = await enhancedFetch(`${API}/check-room?roomCode=${encodeURIComponent(code.trim().toUpperCase())}`);
        
        if (!response.ok) {
          if (response.status === 429) {
            throw new Error('Too many requests. Please wait a moment and try again.');
          }
          throw new Error(`Server error: ${response.status}`);
        }

        const data = await response.json();
        
        if (data.exists) {
          navigate(`/${code.trim().toUpperCase()}`);
        } else {
          setError('Room not found. Please check the room code and try again.');
        }
      });
    } catch (error) {
      console.error('Error finding room:', error);
      let errorMessage = 'Unable to find room. ';
      
      if (error.message.includes('timeout')) {
        errorMessage += 'Connection timeout - please check your internet connection.';
      } else if (error.message.includes('429')) {
        errorMessage += 'Too many requests. Please wait and try again.';
      } else if (error.message.includes('Failed to fetch')) {
        errorMessage += 'Network error. Please check your connection and try again.';
      } else {
        errorMessage += error.message;
      }
      
      setError(errorMessage);
      
      // Suggest reconnection for mobile users
      if (isMobileNetwork()) {
        setError(errorMessage + ' (Try toggling airplane mode or switching to WiFi)');
      }
    } finally {
      setLoading(false);
    }
  };
  
  const createRoom = async () => {
    setError(null);
    setLoading(true);

    try {
      await retryRequest(async () => {
        console.log('Attempting to create room...');
        const response = await enhancedFetch(`${API}/create-room`);
        
        if (!response.ok) {
          if (response.status === 429) {
            throw new Error('Too many requests. Please wait a moment and try again.');
          }
          if (response.status === 500) {
            throw new Error('Server error. Please try again in a moment.');
          }
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        console.log('Room created:', data);
        
        if (data.roomCode) {
          navigate(`/${data.roomCode}`);
        } else {
          throw new Error('Invalid response from server');
        }
      }, 3, 2000); // 3 retries with 2 second base delay
    } catch (error) {
      console.error('Error creating room:', error);
      let errorMessage = 'Unable to create room. ';
      
      if (error.message.includes('timeout')) {
        errorMessage += 'Connection timeout - please check your internet connection.';
      } else if (error.message.includes('429')) {
        errorMessage += 'Too many requests. Please wait and try again.';
      } else if (error.message.includes('Failed to fetch') || error.message.includes('Network')) {
        errorMessage += 'Network error. Please check your connection and try again.';
      } else if (error.message.includes('500')) {
        errorMessage += 'Server temporarily unavailable. Please try again.';
      } else {
        errorMessage += error.message;
      }
      
      setError(errorMessage);
      
      // Mobile-specific suggestions
      if (isMobileNetwork()) {
        setError(errorMessage + ' (Mobile network detected - try WiFi if available)');
      }
    } finally {
      setLoading(false);
    }
  };

  const getConnectionStatusColor = () => {
    switch (connectionStatus) {
      case 'connected': return 'text-green-500';
      case 'poor': return 'text-yellow-500';
      case 'offline': return 'text-red-500';
      default: return 'text-gray-500';
    }
  };

  const getConnectionStatusText = () => {
    switch (connectionStatus) {
      case 'connected': return 'Connected';
      case 'poor': return 'Poor Connection';
      case 'offline': return 'Offline';
      case 'checking': return 'Connecting...';
      default: return 'Unknown';
    }
  };

  return (
    <div className="h-screen w-full flex flex-col bg-white text-black dark:bg-neutral-900 dark:text-white">
      <main className="fade-in grow flex flex-col items-center justify-center gap-2 mb-28">
        <div className="absolute top-1 right-1">
          <DarkModeToggle />
        </div>

        {/* Connection status indicator */}
        <div className={`absolute top-1 left-1 text-xs ${getConnectionStatusColor()}`}>
          {getConnectionStatusText()}
        </div>

        <h1 className="sm:text-9xl text-8xl font-bold text-center">ArtFreak</h1>
        <h2 className="text-lg sm:text-xl font-semibold text-center flex items-center gap-2">
        unleash your creativity
        </h2>
        
        <div className="mt-8 relative px-4 py-6 rounded-2xl shadow-md border shadow-neutral-500 flex flex-col gap-4
          bg-white text-black border-stone-300
          dark:bg-neutral-900 dark:text-white dark:border-stone-700 dark:shadow-neutral-600">

          <div className="relative w-full min-w-[200px] shadow-xl max-w-xs h-14 bg-neutral-100 dark:bg-neutral-800 rounded-full cursor-pointer border border-stone-300 dark:border-stone-700"
            onClick={() => setCreateMode(!createMode)}>
            <div className={`absolute top-[3px] h-12 w-1/2 bg-white dark:bg-neutral-900 rounded-full shadow-md transition-all duration-300 ease-in-out ${
              !createMode ? "left-[calc(50%-4px)]" : "left-1"
            }`} />

            <div className="relative flex h-full">
              <div className={`flex-1 flex items-center justify-center text-lg z-10 transition-colors duration-300 ${
                createMode ? "text-black dark:text-white" : "text-neutral-400"
              }`}>
                Create
              </div>
              <div className={`flex-1 flex items-center justify-center text-lg z-10 transition-colors duration-300 ${
                !createMode ? "text-black dark:text-white" : "text-neutral-400"
              }`}>
                Join
              </div>
            </div>
          </div>
          

          {createMode ? (
            <button
              className={`p-3 w-full rounded-full transition-all !duration-200 ease-in-out hover:shadow-lg dark:shadow-white/15 cursor-pointer ${
                loading || connectionStatus === 'offline'
                  ? 'bg-gray-400 text-gray-600 cursor-not-allowed' 
                  : 'bg-blue-600 dark:bg-blue-300 text-white dark:text-black hover:-translate-y-0.5'
              }`}
              onClick={createRoom}
              disabled={loading || connectionStatus === 'offline'}>
              {loading ? 'Creating...' : 'Create Room'}
            </button>
          ) : (
            <div className="relative">
              <input
                type="text"
                placeholder="Enter room code"
                className={`bg-zinc-100 placeholder:text-stone-500 dark:bg-zinc-700 dark:placeholder:text-stone-300 p-3 rounded-xl text-center focus:outline-blue-600 dark:focus:outline-blue-300 focus:outline-2 focus:ring-0 focus:shadow-none appearance-none w-full uppercase ${
                  loading ? 'cursor-not-allowed opacity-50' : ''
                }`}
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && !loading && connectionStatus !== 'offline') {
                    checkAndJoinRoom(e.target.value);
                  }
                }}
                disabled={loading || connectionStatus === 'offline'}
                maxLength={6}
                onInput={(e) => {
                  e.target.value = e.target.value.toUpperCase();
                }}
              />
              {loading && (
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600 dark:border-blue-300"></div>
                </div>
              )}
            </div>
          )}

          {/* Enhanced error display */}
          {error && (
            <div className="absolute text-red-500 text-xs mt-2 -bottom-12 left-1/2 transform -translate-x-1/2 w-full text-center px-2">
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-2">
                {error}
              </div>
            </div>
          )}

          {/* Network info for mobile users */}
          {isMobileNetwork() && (
            <div className="text-xs text-neutral-500 dark:text-neutral-400 text-center mt-2">
              Mobile network detected. For best performance, try WiFi if available.
            </div>
          )}
        </div>

        {/* Retry connection button */}
        {connectionStatus === 'offline' && (
          <button 
            onClick={checkServerHealth}
            className="mt-4 px-4 py-2 bg-blue-600 dark:bg-blue-300 text-white dark:text-black rounded-lg hover:bg-blue-700 dark:hover:bg-blue-400 transition-colors"
          >
            Retry Connection
          </button>
        )}

        {/* Network troubleshooting tips */}
        {(connectionStatus === 'offline' || connectionStatus === 'poor') && (
          <div className="mt-4 max-w-md text-sm text-neutral-600 dark:text-neutral-400 text-center space-y-2">
            <p className="font-semibold">Connection Issues?</p>
            <div className="text-xs space-y-1">
              <p>• Try switching to WiFi if available</p>
              <p>• Toggle airplane mode on/off</p>
              <p>• Check if other websites load properly</p>
              <p>• Try again in a few seconds</p>
            </div>
          </div>
        )}

      </main>
      <footer className="absolute bottom-0 left-1/2 transform -translate-x-1/2 flex gap-2 items-center p-2">
        {/* Footer content removed */}
      </footer>
    </div>
  );
}