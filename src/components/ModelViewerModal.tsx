import React, { useEffect, useState, useRef } from 'react';
import { X, Box } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

interface ModelViewerModalProps {
  modelUrl: string;
  itemName: string;
  buttonClassName?: string;
  iconClassName?: string;
}

export const ModelViewerModal: React.FC<ModelViewerModalProps> = ({ modelUrl, itemName, buttonClassName, iconClassName }) => {
  const { t } = useLanguage();
  const [modelViewerReady, setModelViewerReady] = useState(false);
  const viewerRef = useRef<any>(null);
  
  const [showFallback, setShowFallback] = useState(false);
  const [arError, setArError] = useState('');

  // Dynamically load @google/model-viewer in background
  useEffect(() => {
    if (customElements.get('model-viewer')) {
      setModelViewerReady(true);
    } else {
      import('@google/model-viewer')
        .then(() => setModelViewerReady(true))
        .catch((err) => console.error('Failed to load 3D viewer library:', err));
    }
  }, []);

  // Prevent scrolling on the body when modal/fallback is open
  useEffect(() => {
    if (showFallback || arError) {
      document.body.style.overflow = 'hidden';
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          if (showFallback) setShowFallback(false);
          if (arError) setArError('');
        }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => {
        document.body.style.overflow = '';
        window.removeEventListener('keydown', handleKeyDown);
      };
    } else {
      document.body.style.overflow = '';
    }
  }, [showFallback, arError]);

  const isLaunchingRef = useRef(false);

  const handleLaunchAR = async (e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (isLaunchingRef.current) return;
    if (!modelViewerReady || !viewerRef.current) return;
    
    isLaunchingRef.current = true;
    try {
      // Ensure model-viewer has completed its internal Lit reactive lifecycle
      // and attribute/intent configuration before triggering AR.
      await viewerRef.current.updateComplete;
      await viewerRef.current.activateAR();
    } catch (error: any) {
      console.error("AR Launch failed", error);
      if (error?.name === 'NotAllowedError') {
        setArError('Camera permission is required to use AR.');
      } else {
        setArError('AR is not supported on this device.');
      }
    } finally {
      // Allow re-trigger after the native OS Scene Viewer intent handover
      setTimeout(() => {
        isLaunchingRef.current = false;
      }, 2500);
    }
  };

  return (
    <>
      {/* 
        Hidden model-viewer just for AR native launch capabilities.
        reveal="manual" prevents downloading the 6.47MB GLB until needed! 
      */}
      {modelViewerReady && (
        <model-viewer
          ref={viewerRef}
          src={modelUrl}
          ar="true"
          ar-modes="scene-viewer quick-look"
          ar-scale="auto"
          reveal="manual"
          style={{ 
            position: 'absolute', 
            width: '1px', 
            height: '1px', 
            opacity: 0, 
            pointerEvents: 'none',
            zIndex: -1 
          }}
        />
      )}

      <button 
        onClick={handleLaunchAR}
        className={buttonClassName || "flex items-center gap-1.5 h-8 px-3 rounded-full border border-border text-text-secondary hover:text-text-primary hover:border-text-secondary transition-colors tracking-widest font-bold text-[9px] uppercase"}
      >
        <Box className={iconClassName || "w-3 h-3"} />
        {t.view_ar || 'VIEW IN AR'}
      </button>

      {/* AR Not Supported Error Modal */}
      {arError && !showFallback && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center bg-bg-primary/95 backdrop-blur-sm p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setArError('');
          }}
        >
          <div className="relative w-full max-w-sm bg-bg-secondary border border-border shadow-2xl rounded-sm flex flex-col p-6 text-center gap-4">
            <h3 className="font-serif text-xl text-text-primary">Unsupported Device</h3>
            <p className="text-sm text-text-secondary">{arError}</p>
            
            <div className="flex flex-col gap-3 mt-4">
              <button 
                onClick={() => {
                  setArError('');
                  setShowFallback(true);
                }}
                className="bg-text-primary text-bg-primary px-6 py-2.5 rounded-sm font-bold text-xs tracking-widest uppercase shadow-lg hover:opacity-90 transition-all"
              >
                {t.view_3d || 'View in 3D Instead'}
              </button>
              <button 
                onClick={() => setArError('')}
                className="text-text-secondary text-xs uppercase tracking-widest font-bold py-2 hover:text-text-primary transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3D Viewer Fallback */}
      {showFallback && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center bg-bg-primary/95 backdrop-blur-sm p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowFallback(false);
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-3d-title"
        >
          <div className="relative w-full max-w-4xl h-[80vh] md:h-[85vh] bg-bg-secondary border border-border shadow-2xl rounded-sm flex flex-col overflow-hidden">
            <div className="flex items-center justify-between p-4 md:p-6 border-b border-border/50">
              <h3 id="modal-3d-title" className="font-serif text-xl md:text-2xl text-text-primary">
                {itemName} <span className="text-text-secondary text-sm md:text-base font-sans font-normal ml-2">{t.in_3d || 'in 3D'}</span>
              </h3>
              <button 
                onClick={() => setShowFallback(false)}
                className="p-2 text-text-secondary hover:text-text-primary hover:bg-border/50 rounded-full transition-colors"
                aria-label={t.close_3d || 'Close 3D viewer'}
              >
                <X className="w-5 h-5 md:w-6 md:h-6" />
              </button>
            </div>
            
            <div className="flex-1 w-full bg-[#f8f6f0] relative flex items-center justify-center">
              {/* @ts-ignore */}
              <model-viewer
                src={modelUrl}
                alt={`3D model of ${itemName}`}
                auto-rotate="true"
                camera-controls="true"
                shadow-intensity="1"
                interaction-prompt="auto"
                style={{ width: '100%', height: '100%', backgroundColor: 'transparent' }}
              >
              {/* @ts-ignore */}
              </model-viewer>
            </div>
            
            <div className="p-4 bg-bg-secondary border-t border-border/50 text-center text-xs md:text-sm text-text-muted">
              {t.instructions_3d || 'Drag to rotate • Pinch or scroll to zoom'}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
