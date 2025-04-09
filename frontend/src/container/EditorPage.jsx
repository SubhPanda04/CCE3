import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase.config';
import { Code2 } from 'lucide-react'; 
import { setCurrentFile, setFileContent, closeFile } from '../redux/slices/editorSlice';
import { setCurrentFolder } from '../redux/slices/fileSystemSlice';
import { setError } from '../redux/slices/uiSlice';
import { resetExecution } from '../redux/slices/codeExecutionSlice';
import { Header, Sidebar, Editor, IOPanel } from '../components';
import '../config/editorConfig'; 
import { FaTimes } from 'react-icons/fa';
import { io } from 'socket.io-client';

const EditorPage = () => {
  const { folderId, fileId } = useParams();
  const location = useLocation();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [roomId, setRoomId] = useState(null);
  const [socket, setSocket] = useState(null);
  const [collaborators, setCollaborators] = useState([]);
  
  useEffect(() => {
    const socketInstance = io('https://cce2.onrender.com');
    setSocket(socketInstance);
    
    return () => {
      if (socketInstance) socketInstance.disconnect();
    };
  }, []);
  
  // Handle room joining and collaboration
  useEffect(() => {
    if (!socket) return;
    
    const urlParams = new URLSearchParams(location.search);
    const roomParam = urlParams.get('room');
    
    if (roomParam) {
      setRoomId(roomParam);
      console.log("Joining collaborative room:", roomParam);
      
      const userId = localStorage.getItem('userUID') || 'anonymous-' + Math.random().toString(36).substring(2, 9);
      const userName = localStorage.getItem('userName') || 'Anonymous';
      
      // Join the room
      socket.emit('join-room', {
        roomId: roomParam,
        userId,
        userName
      });
      
      // Listen for user joined events
      socket.on('user-joined', (data) => {
        console.log(`User joined: ${data.userName}`);
        // You can show a toast notification here
      });
      
      // Listen for user left events
      socket.on('user-left', (data) => {
        console.log(`User left: ${data.userName}`);
        // You can show a toast notification here
      });
      
      // Listen for room users list updates
      socket.on('room-users', (data) => {
        console.log('Current users:', data.users);
        setCollaborators(data.users);
      });
      
      // Listen for code updates from other users
      socket.on('code-update', (data) => {
        if (currentFile) {
          dispatch(setFileContent({
            fileId: currentFile.id,
            content: data.code
          }));
        }
      });
    }
    
    return () => {
      if (socket && roomParam) {
        // Clean up event listeners
        socket.off('user-joined');
        socket.off('user-left');
        socket.off('room-users');
        socket.off('code-update');
      }
    };
  }, [socket, location.search, dispatch]);

  useEffect(() => {
    const handleBackButton = (e) => {
      // Prevent default behavior
      e.preventDefault();
      // Navigate to projects page
      navigate('/home/projects');
    };

    // Add event listener for popstate (back button)
    window.addEventListener('popstate', handleBackButton);

    // Create a history entry to ensure popstate works correctly
    window.history.pushState(null, '', window.location.href);

    return () => {
      window.removeEventListener('popstate', handleBackButton);
    };
  }, [navigate]);

  const { isInputVisible, isOutputVisible } = useSelector((state) => state.ui);
  const { openFiles, currentFile, unsavedChanges } = useSelector((state) => state.editor);

  const findFileInFolder = (items, targetFileId) => {
    for (const item of items) {
      if (item.id === targetFileId) {
        return item;
      }
      if (item.type === 'folder' && item.items) {
        const found = findFileInFolder(item.items, targetFileId);
        if (found) return found;
      }
    }
    return null;
  };
  
  useEffect(() => {
    const urlParams = new URLSearchParams(location.search);
    const roomParam = urlParams.get('room');
    
    if (roomParam) {
      const isNewRoom = !localStorage.getItem('currentRoomId') || 
                        localStorage.getItem('currentRoomId') !== roomParam;
      
      if (isNewRoom) {
        const urlOrigin = new URL(document.referrer).origin;
        const isFromSameOrigin = urlOrigin === window.location.origin;
      
        localStorage.setItem('isRoomOwner', (!isFromSameOrigin).toString());
        localStorage.setItem('currentRoomId', roomParam);
      }
    } else {
      localStorage.removeItem('isRoomOwner');
      localStorage.removeItem('currentRoomId');
    }
  }, [location.search]);
  
  useEffect(() => {
    const loadFolderData = async () => {
      if (!folderId) return;
      
      setLoading(true);
      try {
        const folderRef = doc(db, "playgrounds", folderId);
        const folderSnap = await getDoc(folderRef);
        
        if (folderSnap.exists()) {
          const folderData = folderSnap.data();
          const transformedData = {
            ...folderData,
            id: folderId,
            createdAt: folderData.createdAt?.toMillis() || Date.now()
          };
        
          dispatch(setCurrentFolder(transformedData));
          
          if (fileId) {
            const findFileInFolder = (items) => {
              for (const item of items) {
                if (item.id === fileId) {
                  return item;
                }
                if (item.type === 'folder' && item.items) {
                  const found = findFileInFolder(item.items);
                  if (found) return found;
                }
              }
              return null;
            };
            
            const file = findFileInFolder(transformedData.items || []);
            
            if (file) {
              dispatch(resetExecution());
              dispatch(setCurrentFile(file));
              dispatch(setFileContent({ 
                fileId: file.id, 
                content: file.content || '' 
              }));
            } else {
              console.warn(`File with ID ${fileId} not found in folder`);
            }
          }
        } else {
          dispatch(setError('Folder not found'));
          navigate('/home/projects');
        }
      } catch (error) {
        console.error('Error loading folder:', error);
        dispatch(setError('Error loading folder'));
      } finally {
        setLoading(false);
      }
    };
    
    loadFolderData();
  }, [folderId, fileId, dispatch, navigate]);

  if (loading) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-[#1e1e1e] text-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
          Loading...
        </div>
      </div>
    );
  }

  const handleFileTabClick = (file) => {
    dispatch(setCurrentFile(file));
    dispatch(resetExecution());
    navigate(`/editor/${folderId}/${file.id}`);
  };

  const handleCloseFile = async (e, fileId) => {
    e.preventDefault();
    e.stopPropagation();

    const remainingFiles = openFiles.filter(f => f.id !== fileId);
    await dispatch(closeFile(fileId));
    dispatch(resetExecution());
    
    if (remainingFiles.length > 0) {
      const nextFile = remainingFiles[remainingFiles.length - 1];
      await dispatch(setCurrentFile(nextFile));
      navigate(`/editor/${folderId}/${nextFile.id}`, { replace: true });
    } else {
      await dispatch(setCurrentFile(null));
      navigate(`/editor/${folderId}`, { replace: true });
    }
  };

  if (!folderId) {
    navigate('/home/projects', { replace: true });
    return null;
  }

  // Function to handle code changes and emit to collaborators
  const handleCodeChange = (fileId, newContent) => {
    // Update local state
    dispatch(setFileContent({
      fileId,
      content: newContent
    }));
    
    // Emit to other collaborators if in a room
    if (socket && roomId) {
      socket.emit('code-change', {
        roomId,
        code: newContent,
        userId: localStorage.getItem('userUID') || 'anonymous'
      });
    }
  };

  return (
    <div className="w-screen h-screen overflow-hidden bg-[#1e1e1e]">
      <Header collaborators={collaborators} socket={socket} roomId={roomId} />
      <div className="w-full h-[calc(100vh-48px)] flex">
        <div className="w-80 flex-shrink-0">
          <Sidebar folderId={folderId} socket={socket} roomId={roomId} />
        </div>
        <div className="flex-1 flex flex-col relative overflow-hidden">
          {/* File tabs section */}
          {openFiles.length > 0 && (
            <div className="w-full flex items-center overflow-x-auto bg-[#0a2744] px-2 py-1">
              {openFiles.map((file) => (
                <div 
                  key={file.id}
                  onClick={() => handleFileTabClick(file)}
                  className={`flex items-center gap-2 px-3 py-2 mr-1 rounded-md cursor-pointer
                    ${currentFile?.id === file.id ? 'bg-[#132F4C] text-white' : 'text-gray-400 hover:bg-[#0d2f49]'}`}
                >
                  <Code2 className="w-4 h-4" />
                  <span className="text-sm">{file.name}</span>
                  {unsavedChanges[file.id] && <span className="text-blue-400 text-xs ml-1">*</span>}
                  <button 
                    onClick={(e) => handleCloseFile(e, file.id)} 
                    className="ml-1 text-xs text-gray-500 hover:text-white"
                  >
                    <FaTimes />
                  </button>
                </div>
              ))}
            </div>
          )}
         
          {/* Editor content */}
          <div className={`h-3/5 ${!currentFile ? 'flex items-center justify-center' : ''}`}>
            {currentFile ? (
              <Editor 
                fileId={currentFile.id} 
                onCodeChange={handleCodeChange} 
                socket={socket} 
                roomId={roomId} 
              />
            ) : (
              <div className="text-gray-400 text-center flex flex-col items-center">
                <Code2 className="w-12 h-12 mb-4 opacity-40" />
                <p>Select a file from the sidebar to start coding</p>
                <p className="mt-2 text-sm text-gray-500">or create a new file</p>
              </div>
            )}
          </div>
          
          {/* IO Panel */}
          {currentFile && (
            <div className="h-2/5 border-t border-[#132F4C]">
              <div className="flex h-full">
                {isInputVisible && (
                  <div className="w-1/2 h-full border-r border-[#132F4C]">
                    <IOPanel type="input" socket={socket} roomId={roomId} />
                  </div>
                )}
                {isOutputVisible && (
                  <div className={`${isInputVisible ? 'w-1/2' : 'w-full'} h-full`}>
                    <IOPanel type="output" socket={socket} roomId={roomId} />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EditorPage;