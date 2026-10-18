import React, { useEffect, useState, useRef, useCallback } from 'react';
import { X, Box, Loader2 } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

export interface ModelViewerModalProps {
  modelUrl: string;
  modelUrlAr?: string;
  iosSrc?: string;
  poster?: string;
  itemName: string;
  buttonClassName?: string;
  iconClassName?: string;
}

interface ToastState {
  type: 'loading' | 'error';
  message: string;
}

export const ModelViewerModal: React.FC<ModelViewerModalProps> = ({ 
  modelUrl,
  modelUrlAr,
  iosSrc,
  poster,
  itemName, 
  buttonClassName, 
  iconClassName 
}) => {
  const { t } = useLanguage();
  const [modelViewerReady, setModelViewerReady] = useState(false);
  const hiddenViewerRef = useRef<any>(null);
  const visibleViewerRef = useRef<any>(null);
  
  // AR lightweight model source - only loaded on user gesture click
  const [arViewerSrc, setArViewerSrc] = useState<string | undefined>(undefined);
  const [showFallback, setShowFallback] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Determine effective AR URL: prefer modelUrlAr, then optimized burger, then modelUrl
  const effectiveArUrl = modelUrlAr || (itemName.toLowerCase().includes('burger') ? '/models/burger-optimized.glb' : modelUrl);

  // Compute USDZ fallback for iOS Quick Look
  const effectiveIosSrc = iosSrc || (effectiveArUrl.endsWith('.glb') ? effectiveArUrl.replace(/\.glb$/, '.usdz') : undefined);

  // Dynamically load @google/model-viewer in background
  useEffect(() => {
    if (customElements.get('model-viewer')) {
      setModelViewerReady(true);
    } else {
      import('@google/model-viewer')
        .then(() => setModelViewerReady(true))
        .catch((err) => console.error('Failed to load @google/model-viewer:', err));
    }
  }, []);

  // Prevent scrolling on the body when modal is open
  useEffect(() => {
    if (showFallback) {
      document.body.style.overflow = 'hidden';
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          setShowFallback(false);
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
  }, [showFallback]);

  // Clean up toast timer on unmount
  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current);
      }
    };
  }, []);

  const sessionStartedRef = useRef(false);
  const modelVisibleRef = useRef(false);
  const isLaunchingArRef = useRef(false);

  const triggerToastAndFallback = useCallback((message?: string) => {
    isLaunchingArRef.current = false;
    const text = message || 'AR not supported, showing 3D';
    setToast({ type: 'error', message: text });
    setShowFallback(true);

    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    toastTimeoutRef.current = setTimeout(() => {
      setToast(null);
    }, 4500);
  }, []);

  // Listen to AR events on hidden viewer: ar-status, load, progress, model-visibility, error
  useEffect(() => {
    const viewer = hiddenViewerRef.current;
    if (!viewer) return;

    const checkReadyAndDismissToast = () => {
      if (sessionStartedRef.current && modelVisibleRef.current) {
        setToast(null);
        isLaunchingArRef.current = false;
      }
    };

    const handleArStatus = (e: any) => {
      const status = e.detail?.status;
      if (status === 'session-started') {
        sessionStartedRef.current = true;
        // Check if model is already visible or object placed
        if (modelVisibleRef.current || viewer.modelIsVisible) {
          modelVisibleRef.current = true;
          checkReadyAndDismissToast();
        }
        // Safety timeout for native AR sessions (Scene Viewer / Quick Look)
        setTimeout(() => {
          if (sessionStartedRef.current) {
            setToast(null);
            isLaunchingArRef.current = false;
          }
        }, 1500);
      } else if (status === 'object-placed') {
        modelVisibleRef.current = true;
        setToast(null);
        isLaunchingArRef.current = false;
      } else if (status === 'failed') {
        sessionStartedRef.current = false;
        isLaunchingArRef.current = false;
        triggerToastAndFallback('AR not supported, showing 3D');
      } else if (status === 'not-presenting') {
        sessionStartedRef.current = false;
        modelVisibleRef.current = false;
      }
    };

    const handleModelVisibility = (e: any) => {
      if (e.detail?.visible) {
        modelVisibleRef.current = true;
        checkReadyAndDismissToast();
      }
    };

    const handleLoad = () => {
      if (viewer.modelIsVisible) {
        modelVisibleRef.current = true;
        checkReadyAndDismissToast();
      }
    };

    const handleProgress = (_e: any) => {
      if (isLaunchingArRef.current && (!sessionStartedRef.current || !modelVisibleRef.current)) {
        setToast((prev) => (prev?.type === 'loading' ? prev : { type: 'loading', message: 'Preparing AR…' }));
      }
    };

    const handleError = (e: any) => {
      console.warn('model-viewer error:', e);
      if (isLaunchingArRef.current) {
        isLaunchingArRef.current = false;
        triggerToastAndFallback('AR not supported, showing 3D');
      }
    };

    viewer.addEventListener('ar-status', handleArStatus);
    viewer.addEventListener('model-visibility', handleModelVisibility);
    viewer.addEventListener('load', handleLoad);
    viewer.addEventListener('progress', handleProgress);
    viewer.addEventListener('error', handleError);

    return () => {
      viewer.removeEventListener('ar-status', handleArStatus);
      viewer.removeEventListener('model-visibility', handleModelVisibility);
      viewer.removeEventListener('load', handleLoad);
      viewer.removeEventListener('progress', handleProgress);
      viewer.removeEventListener('error', handleError);
    };
  }, [triggerToastAndFallback]);

  // 'View in AR' button is pure user gesture: onClick -> set AR viewer src if not set -> viewer.activateAR()
  // Do not pre-load model on modal open
  const handleLaunchAR = (e: React.MouseEvent) => {
    e.stopPropagation();

    const viewer = hiddenViewerRef.current;
    if (!viewer) {
      triggerToastAndFallback('AR not supported, showing 3D');
      return;
    }

    isLaunchingArRef.current = true;
    sessionStartedRef.current = false;
    modelVisibleRef.current = false;

    // Set AR viewer src synchronously to maintain user gesture
    if (viewer.getAttribute('src') !== effectiveArUrl) {
      viewer.setAttribute('src', effectiveArUrl);
    }
    setArViewerSrc(effectiveArUrl);
    setToast({ type: 'loading', message: 'Preparing AR…' });

    // Check device capability
    if (viewer.canActivateAR === false) {
      isLaunchingArRef.current = false;
      triggerToastAndFallback('AR not supported, showing 3D');
      return;
    }

    try {
      const arResult = viewer.activateAR();
      if (arResult && typeof arResult.then === 'function') {
        arResult.catch((error: any) => {
          console.warn('activateAR rejected:', error);
          isLaunchingArRef.current = false;
          triggerToastAndFallback('AR not supported, showing 3D');
        });
      }
    } catch (error: any) {
      console.warn('AR launch error:', error);
      isLaunchingArRef.current = false;
      triggerToastAndFallback('AR not supported, showing 3D');
    }
  };

  return (
    <>
      {/* 
        Hidden AR viewer: 
        - src set to modelUrlAr only on user click (do not pre-load model on modal open)
        - ar
        - ar-modes="webxr scene-viewer quick-look"
        - ar-scale="fixed" (stops auto-rescale jitter)
        - ar-placement="ground" (prefer ground plane)
        - camera-controls
        - touch-action="pan-y"
        - exposure="1"
        - shadow-intensity="0.5" (low shadow to reduce lighting estimation jitter)
        - environment-image="neutral"
        - interaction-prompt="none"
        - reveal="manual"
        - camera-orbit="0deg 75deg 1.0m" (small anchor)
        - NO auto-rotate in AR mode
      */}
      {modelViewerReady && (
        <model-viewer
          ref={hiddenViewerRef}
          src={arViewerSrc || undefined}
          ar
          ar-modes="webxr scene-viewer quick-look"
          ar-scale="fixed"
          ar-placement="ground"
          camera-controls
          camera-orbit="0deg 75deg 1.0m"
          touch-action="pan-y"
          exposure="1"
          shadow-intensity="0.5"
          environment-image="neutral"
          interaction-prompt="none"
          reveal="manual"
          ios-src={effectiveIosSrc || undefined}
          style={{ 
            position: 'fixed', 
            top: '-9999px',
            left: '-9999px',
            width: '1px', 
            height: '1px', 
            opacity: 0, 
            pointerEvents: 'none',
            zIndex: -1 
          }}
        />
      )}

      {/* Trigger Button - Pure user gesture calling activateAR() */}
      <button 
        type="button"
        onClick={handleLaunchAR}
        className={buttonClassName || "flex items-center gap-1.5 h-8 px-3 rounded-full border border-border text-text-secondary hover:text-text-primary hover:border-text-secondary transition-colors tracking-widest font-bold text-[9px] uppercase"}
        title="View dish in Augmented Reality or 3D"
      >
        <Box className={iconClassName || "w-3 h-3"} />
        {t.view_ar || 'VIEW IN AR'}
      </button>

      {/* Toast Notification: Spinner for 'Preparing AR…' / Toast for 'AR not supported, showing 3D' */}
      {toast && (
        <div 
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[120] max-w-[92vw] sm:max-w-md w-full px-4 animate-in fade-in slide-in-from-bottom-4 duration-200 pointer-events-auto"
          role="status"
          aria-live="polite"
        >
          <div className="bg-neutral-900/95 text-white backdrop-blur-md border border-neutral-700/80 rounded-xl px-4 py-3 shadow-2xl flex items-center justify-between gap-3 text-xs md:text-sm">
            <div className="flex items-center gap-2.5 min-w-0">
              {toast.type === 'loading' ? (
                <Loader2 className="w-4 h-4 text-amber-400 animate-spin shrink-0" />
              ) : (
                <span className="flex h-2 w-2 rounded-full bg-amber-400 shrink-0" />
              )}
              <p className="font-medium text-neutral-200 leading-snug">
                {toast.message}
              </p>
            </div>
            {toast.type === 'error' && (
              <button
                type="button"
                onClick={() => setToast(null)}
                className="p-1 text-neutral-400 hover:text-white rounded-md transition-colors shrink-0"
                aria-label="Dismiss message"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* 
        Visible 3D dialog viewer fallback: 
        - hero GLB (modelUrl)
        - reveal="interaction"
        - poster image
        - no ar
        - shadow-intensity="0.5"
        - environment-image="neutral"
      */}
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
            {/* Header */}
            <div className="flex items-center justify-between p-4 md:p-6 border-b border-border/50">
              <h3 id="modal-3d-title" className="font-serif text-xl md:text-2xl text-text-primary flex items-center">
                {itemName} <span className="text-text-secondary text-sm md:text-base font-sans font-normal ml-2">{t.in_3d || 'in 3D'}</span>
              </h3>
              <div className="flex items-center gap-3">
                <button 
                  type="button"
                  onClick={() => setShowFallback(false)}
                  className="p-2 text-text-secondary hover:text-text-primary hover:bg-border/50 rounded-full transition-colors"
                  aria-label={t.close_3d || 'Close 3D viewer'}
                >
                  <X className="w-5 h-5 md:w-6 md:h-6" />
                </button>
              </div>
            </div>
            
            {/* 3D Scene Container */}
            <div className="flex-1 w-full bg-[#f8f6f0] relative flex items-center justify-center">
              <model-viewer
                ref={visibleViewerRef}
                src={modelUrl}
                alt={`3D model of ${itemName}`}
                poster={poster || undefined}
                reveal="interaction"
                camera-controls
                touch-action="pan-y"
                exposure="1"
                shadow-intensity="0.5"
                environment-image="neutral"
                auto-rotate
                style={{ width: '100%', height: '100%', backgroundColor: 'transparent' }}
              />
            </div>
            
            {/* Footer helper info */}
            <div className="p-4 bg-bg-secondary border-t border-border/50 flex flex-col sm:flex-row items-center justify-between text-xs md:text-sm text-text-muted gap-2">
              <span>{t.instructions_3d || 'Drag to rotate • Pinch or scroll to zoom'}</span>
              <span className="text-[11px] font-sans text-text-muted/80">3D Interactive Viewer</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
