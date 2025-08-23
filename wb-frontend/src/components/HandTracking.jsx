import { useEffect, useRef, useState } from 'react';
import useWhiteboardStore from '../stores/whiteboardStore';

const HandTracking = ({ onHandUpdate }) => {
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Hand tracking functionality has been removed
    console.log('Hand tracking is disabled in this version');
  }, []);

  return (
    <div className="absolute top-0 left-0 opacity-0 pointer-events-none">
      {isLoading && (
        <div className="fixed top-4 left-4 bg-black/70 text-white p-3 rounded-md z-50">
          Hand tracking is not available in this version
        </div>
      )}
    </div>
  );
};

export default HandTracking;