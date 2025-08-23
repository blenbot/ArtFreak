import { useParams, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import Canvas from '../components/Canvas';
import TopMenu from '../components/TopMenu';
import useWhiteboardStore from '../stores/whiteboardStore';
import { Settings, Wifi, WifiOff } from 'lucide-react';
import { Tooltip } from '../components/uiElements';
import useUIStore from '../stores/uiStore';

const API = (import.meta.env.MODE === 'development') 
  ? 'http://localhost:1234' 
  : 'https://artfreak-production.up.railway.app';

// Enhanced fetch with retry logic
const enhancedFetch = async (url, options = {}) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

  const defaultOptions = {
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Cache-Control': 'no-cache',
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
      throw new Error('Request timeout');
    }
    throw error;
  }
};

export default function Room() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const activeUsers = useWhiteboardStore((state) => state.activeUsers);
  const settingsOpen = useUIStore((state) => state.settingsOpen);
  const toggleSettings = useUIStore((state) => state.toggleSettings);
  
  const [roomStatus, setRoomStatus] = useState('validating'); // 'validating', 'valid', 'invalid', 'error'
  const [connectionError, setConnectionError] = useState(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // Monitor online/offline status
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setConnectionError(null);
      // Retry room validation when coming back online
      if (roomStatus === 'error') {
        validateRoom();
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
      setConnectionError('You are currently offline');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [roomStatus]);

  // Validate room with retry logic
  const validateRoom = async (retries = 3) => {
    if (!isOnline) {
      setRoomStatus('error');
      setConnectionError('No internet connection');
      return;
    }

    setRoomStatus('validating');
    setConnectionError(null);

    for (let i = 0; i < retries; i++) {
      try {
        console.log(`Validating room ${roomId}, attempt ${i + 1}`);
        const response = await enhancedFetch(`${API}/check-room?roomCode=${encodeURIComponent(roomId)}`);
        
        if (response.ok) {
          const { exists } = await response.json();
          if (exists) {
            setRoomStatus('valid');
            return;
          } else {
            setRoomStatus('invalid');
            setConnectionError('Room not found');
            setTimeout(() => navigate('/', { replace: true }), 3000);
            return;
          }
        } else if (response.status === 429) {
          throw new Error('Rate limited - too many requests');
        } else {
          throw new Error(`Server responded with status ${response.status}`);
        }
      } catch (error) {
        console.error(`Room validation attempt ${i + 1} failed:`, error);
        
        if (i === retries - 1) {
          // Last attempt failed
          setRoomStatus('error');
          if (error.message.includes('timeout')) {
            setConnectionError('Connection timeout - please check your internet connection');
          } else if (error.message.includes('Rate limited')) {
            setConnectionError('Too many requests - please wait a moment');
          } else if (error.message.includes('Failed to fetch')) {
            setConnectionError('Network error - please check your connection');
          } else {
            setConnectionError(`Connection failed: ${error.message}`);
          }
        } else {
          // Wait before retrying (exponential backoff)
          const delay = Math.pow(2, i) * 1000 + Math.random() * 1000;
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
  };

  useEffect(() => {
    if (roomId) {
      validateRoom();
    }

    // Cleanup when leaving room
    return () => {
      const cleanup = useWhiteboardStore.getState().cleanupYjs;
      if (cleanup) cleanup();
    };
  }, [roomId]);

  // Retry connection
  const retryConnection = () => {
    validateRoom();
  };

  // Show loading state while validating
  if (roomStatus === 'validating') {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-white dark:bg-neutral-900">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-lg dark:text-white">Connecting to room {roomId}...</p>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            Please wait while we validate the room
          </p>
        </div>
      </div>
    );
  }

  // Show error state
  if (roomStatus === 'error' || roomStatus === 'invalid') {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-white dark:bg-neutral-900 text-black dark:text-white">
        <div className="text-center space-y-6 max-w-md px-4">
          <div className="text-6xl">⚠️</div>
          <h1 className="text-2xl font-bold">
            {roomStatus === 'invalid' ? 'Room Not Found' : 'Connection Error'}
          </h1>
          <p className="text-neutral-600 dark:text-neutral-400">
            {connectionError || 'Unable to connect to the room'}
          </p>
          
          {roomStatus === 'error' && (
            <div className="space-y-4">
              <button 
                onClick={retryConnection}
                className="px-6 py-3 bg-blue-600 dark:bg-blue-300 text-white dark:text-black rounded-lg hover:bg-blue-700 dark:hover:bg-blue-400 transition-colors"
              >
                Retry Connection
              </button>
              
              <div className="text-sm text-neutral-500 dark:text-neutral-400 space-y-2">
                <p>Troubleshooting tips:</p>
                <ul className="text-xs space-y-1">
                  <li>• Check your internet connection</li>
                  <li>• Try switching between WiFi and mobile data</li>
                  <li>• Disable VPN if you're using one</li>
                  <li>• Clear browser cache and cookies</li>
                </ul>
              </div>
            </div>
          )}
          
          <button 
            onClick={() => navigate('/')}
            className="px-4 py-2 border border-neutral-300 dark:border-neutral-700 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          >
            Go Back Home
          </button>
        </div>
      </div>
    );
  }

  // Show main room interface
  return (
    <div className="bg-white dark:bg-neutral-900 dark:text-white sm:p-0 p-2 fade-in h-screen w-full flex flex-col">
      <header className="flex items-center justify-between gap-2 bg-white dark:bg-neutral-900 dark:text-white">
        {/* Connection status indicator */}
        <div className="flex items-center gap-2">
          <h1 className="flex p-2 gap-2 items-center text-2xl font-bold">
            <span>ArtFreak<span className="text-neutral-400">.app/{roomId}</span></span>
          </h1>
          {!isOnline && (
            <div className="flex items-center gap-1 text-red-500 text-sm">
              <WifiOff size={16} />
              <span>Offline</span>
            </div>
          )}
          {isOnline && connectionError && (
            <div className="flex items-center gap-1 text-yellow-500 text-sm">
              <Wifi size={16} />
              <span>Poor Connection</span>
            </div>
          )}
        </div>
        
        <div className='flex items-center gap-4 mr-1'>
          <div className="hidden sm:flex gap-1 items-center">
            {activeUsers.map((user) => (
              <Tooltip key={user.clientID} direction="bottom" content={user.userName}>
                <p className="text-white text-sm flex justify-center items-center p-1 w-8 h-8 text-center rounded-full shadow-sm"
                   style={{ backgroundColor: user.color }}>
                  {user.userName?.[0] || '?'}
                </p>
              </Tooltip>
            ))}
          </div>
          <Tooltip direction="bottom" content="Settings">
            <button onClick={toggleSettings}
                    className="cursor-pointer p-2 rounded hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors">
              <Settings />
            </button>
          </Tooltip>
          {settingsOpen && <TopMenu />}
        </div>
      </header>
      
      <main className="grow flex h-[calc(100vh-3rem)]">
        <div className="w-full h-full">
          <Canvas roomCode={roomId} />
        </div>
      </main>

      {/* Connection status banner */}
      {!isOnline && (
        <div className="absolute bottom-0 left-0 right-0 bg-red-500 text-white text-center py-2 text-sm">
          You are offline. Some features may not work until connection is restored.
        </div>
      )}
    </div>
  );
}