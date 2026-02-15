import { Mouse, Eraser, X, Triangle } from 'lucide-react';
import { useRef, useState } from 'react';
import useWhiteboardStore from '../stores/whiteboardStore';
import useUIStore from '../stores/uiStore';
import { Tooltip } from './uiElements';

const Toolbar = () => {
    const CLEAR_DELAY = 1000; // 1 second
  const store = useWhiteboardStore();
  const { darkMode } = useUIStore();
  const colors = ['black', 'red', 'blue', 'green'];
  const clearTimeoutRef = useRef(null);
  const clearStartTimeRef = useRef(0);

  const handleClearMouseDown = () => {
    clearStartTimeRef.current = Date.now();
    clearTimeoutRef.current = setInterval(() => {
      const progress = Math.min((Date.now() - clearStartTimeRef.current) / CLEAR_DELAY, 1);
      store.setClearProgress(progress);
      if (progress >= 1) {
        store.clearCanvas();
        handleClearMouseUp();
      }
    }, 10);
  };

  const handleClearMouseUp = () => {
    if (clearTimeoutRef.current) {
      clearInterval(clearTimeoutRef.current);
      clearTimeoutRef.current = null;
    }
    store.setClearProgress(0);
  };



  return (
    <div className='z-50 sm:left-auto sm:right-auto right-2 left-2 fade-in absolute bottom-3 sm:px-3 sm:py-2 px-2 py-1 flex gap-[2px] sm:gap-1 justify-between items-center shadow-md rounded-2xl shadow-neutral-400 border
    bg-white text-black border-stone-300
    dark:bg-neutral-900 dark:text-white dark:border-stone-700 dark:shadow-neutral-600'>
      <div className='relative'>
      <Tooltip content='Hand tracking is not available in this version'>
        <button
          className='cursor-pointer p-1 sm:p-2 rounded transition-colors
          hover:bg-neutral-100 dark:hover:bg-neutral-700 opacity-50 cursor-not-allowed'
          disabled
        >
          <Mouse />
        </button>
      </Tooltip>
      </div>
      

      <Tooltip content="Select Pen Color">
        <div className="sm:p-2 p-1 flex items-center gap-1 sm:gap-2">
          {colors.map((color) => (
            <button
              key={color}
              className={`cursor-pointer w-4 h-4 sm:w-6 sm:h-6 rounded-full transition-all ${
                color === store.penColor && store.selectedTool === 'pen'
                  ? 'ring-2 ring-offset-1 sm:ring-offset-2 ring-blue-500'
                  : 'opacity-100 hover:opacity-80'
              } ring-offset-white dark:ring-offset-neutral-800`}
              style={{ backgroundColor: darkMode && color === 'black' ? 'white' : color }}  
              onClick={() => {
                store.setColor(color);
                store.selectedTool === 'eraser' && store.setTool('pen');
              }}
              aria-label={color}
            />
          ))}
        </div>
      </Tooltip>
      
      <Tooltip content="Eraser">
        <button
          className={`cursor-pointer p-1 sm:p-2 rounded transition-all flex items-center justify-center
          ring-offset-white dark:ring-offset-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-700
          ${store.selectedTool === 'eraser' ? 'ring-2 ring-blue-500 ring-offset-1 sm:ring-offset-2' : ''}`}
          onClick={() => store.setTool('eraser')}
          aria-label="Eraser"
        >
          <Eraser className='w-5 h-5 sm:h-auto sm:w-auto'/>
        </button>
      </Tooltip>
      <Tooltip content="Shape Recognition">
        <button
          className={`cursor-pointer p-1 sm:p-2 rounded transition-all flex items-center justify-center text-lg
            ring-offset-white dark:ring-offset-neutral-800  ${store.shapeRecognition ? 'bg-neutral-200 dark:bg-neutral-700' : 'hover:bg-neutral-100 dark:hover:bg-neutral-700'}`}
          onClick={() => store.setShapeRecognition(!store.shapeRecognition)}
          aria-label="Shape Recognition"
        >
          <Triangle className='w-5 h-5 sm:h-auto sm:w-auto'/>
        </button>
      </Tooltip>
      
      <Tooltip content="Line Thickness (2-32px)">
        <div className="slider-container flex flex-col items-center gap-1 w-20 sm:w-full px-1 sm:px-2 py-4">
          <input
            type="range"
            min="1"
            max="16"
            value={store.penSize / 2}
            onChange={(e) => store.setPenSize(parseInt(e.target.value) * 2)}
            className={`w-full h-2 rounded-lg appearance-none cursor-pointer
              [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-4
              [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:rounded-full
              [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:cursor-pointer
              [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4
              [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border
              [&::-moz-range-thumb]:cursor-pointer
              ${darkMode
                ? '[&::-webkit-slider-thumb]:bg-neutral-900 [&::-webkit-slider-thumb]:border-white [&::-moz-range-thumb]:bg-neutral-300 bg-neutral-700'
                : '[&::-webkit-slider-thumb]:bg-neutral-100 [&::-webkit-slider-thumb]:border-black [&::-moz-range-thumb]:bg-black bg-neutral-200'
              }`}
            style={{
              background: darkMode
                ? `linear-gradient(to right, #ffffff 0%, #ffffff ${(store.penSize / 32) * 100}%, #4B5563 ${(store.penSize / 32) * 100}%, #4B5563 100%)`
                : `linear-gradient(to right, #000000 0%, #000000 ${(store.penSize / 32) * 100}%, #ccc ${(store.penSize / 32) * 100}%, #ccc 100%)`
            }}
          />
        </div>
      </Tooltip>
      <Tooltip content="Hold for 1s to Clear Canvas">
        <button
          className='cursor-pointer p-1 sm:p-2 rounded text-red-500 transition-colors relative
          hover:bg-neutral-100 dark:hover:bg-neutral-700'
          onMouseDown={handleClearMouseDown}
          onMouseUp={handleClearMouseUp}
          onMouseLeave={handleClearMouseUp}
          onTouchStart={handleClearMouseDown}
          onTouchEnd={handleClearMouseUp}
        >
          <X />
        </button>
      </Tooltip>
    </div>
  );
};

export default Toolbar;
