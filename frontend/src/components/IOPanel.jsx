import React, { useState, useEffect } from 'react';
import { FaTerminal, FaKeyboard, FaSpinner } from 'react-icons/fa';
import { useSelector, useDispatch } from 'react-redux';
import { setInput } from '../redux/slices/codeExecutionSlice';

const IOPanel = ({ type = 'output', socket, roomId }) => {
  const dispatch = useDispatch();
  const { input, output, isExecuting, executionError } = useSelector(
    (state) => state.codeExecution
  );
  
  const isOutput = type === 'output';
  const [localInput, setLocalInput] = useState('');
  
  // Update local input when Redux state changes
  useEffect(() => {
    if (!isOutput) {
      setLocalInput(input);
    }
  }, [input, isOutput]);
  
  // Handle input change and update global state
  const handleInputChange = (e) => {
    const newInput = e.target.value;
    setLocalInput(newInput);
    dispatch(setInput(newInput));
    
    // Emit input changes to collaborators
    if (socket && roomId && !isOutput) {
      socket.emit('input-change', {
        roomId,
        input: newInput,
        userId: localStorage.getItem('userUID') || 'anonymous'
      });
    }
  };
  
  // Listen for input changes from collaborators
  useEffect(() => {
    if (!socket || isOutput) return;
    
    socket.on('input-update', (data) => {
      setLocalInput(data.input);
      dispatch(setInput(data.input));
    });
    
    return () => {
      socket.off('input-update');
    };
  }, [socket, isOutput, dispatch]);
  
  // Determine what to show in the output panel
  const getOutputContent = () => {
    if (isExecuting) {
      return 'Running your code...';
    }
    
    if (executionError) {
      return `Error: ${executionError}`;
    }
    
    return output || 'Program output will appear here...';
  };
  
  return (
    <div className="h-full w-full flex flex-col bg-[#031d38]">
      {/* Header - made slightly smaller */}
      <div className="flex items-center justify-between px-4 py-1 border-b border-[#1E4976] bg-[#031d38]">
        <div className="flex items-center gap-2 text-sm text-white">
          {isOutput ? (
            <>
              <FaTerminal className="text-gray-400" />
              <span>Output</span>
              {isExecuting && (
                <FaSpinner className="animate-spin text-blue-400 ml-2" />
              )}
            </>
          ) : (
            <>
              <FaKeyboard className="text-gray-400" />
              <span>Input</span>
            </>
          )}
        </div>
      </div>

      {/* Content - improved padding and styling */}
      <div className="flex-1 p-2">
        <textarea
          value={isOutput ? getOutputContent() : localInput}
          onChange={isOutput ? undefined : handleInputChange}
          readOnly={isOutput}
          className={`w-full h-full bg-[#132F4C] text-white p-3 rounded-md 
            border border-[#1E4976] focus:outline-none focus:border-blue-500
            font-mono text-lg resize-none ${executionError ? 'text-red-500' : ''}`}
          placeholder={isOutput ? "Program output will appear here..." : "Enter program input here..."}
        />
      </div>
    </div>
  );
};

export default IOPanel;