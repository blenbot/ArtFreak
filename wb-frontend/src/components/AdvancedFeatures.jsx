import { useState, useRef, useEffect, useContext } from 'react';
import useUIStore from '../stores/uiStore';

const AdvancedFeatures = ({ canvasRef, bgCanvasRef, ydoc, awareness }) => {
  const { darkMode } = useUIStore();

  return (
    <>
      <div className='flex justify-around items-center'>
        {/* Future features can be added here */}
      </div>
    </>
  );
};

export default AdvancedFeatures;
