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
  type: 'loading' | 'error' | 'info';
  message: string;
}

/**
 * Resolves a model path to an absolute, public URL with open CORS (access-control-allow-origin: *).
 * 
 * Google Scene Viewer runs in an external Android system process (com.google.android.googlequicksearchbox).
 * In Cloud Run preview environments (*.run.app), external requests without browser authentication cookies
 * are redirected with HTTP 302 to /__cookie_check.html, causing Scene Viewer to fail with "Couldn't load object".
 * Routing via the public GitHub raw asset URL provides an open, unauthenticated binary payload that Scene Viewer
 * and Apple Quick Look can download cleanly.
 */
export function getPublicModelUrl(path?: string): string | undefined {
  if (!path) return undefined;
  if (path.startsWith('http://') || path.startsWith('https://')) return path;

  const clean = path.replace(/^\//, '');

  // For Cloud Run environments (*.run.app), unauthenticated external fetchers like Google Scene Viewer
  // are blocked by Cloud Run authentication cookies (HTTP 302 redirect to /__cookie_check.html).
  // Routing through jsDelivr edge CDN serves the binary with open CORS (access-control-allow-origin: *)
  // and the standard 'model/gltf-binary' content-type that Scene Viewer and Quick Look strictly require.
  if (typeof window !== 'undefined' && window.location.hostname.includes('.run.app')) {
    return `https://cdn.jsdelivr.net/gh/vedantchougule9666/DineView@main/public/${clean}`;
  }

  if (typeof window !== 'undefined' && window.location.origin) {
    return `${window.location.origin}/${clean}`;
  }

  return path;
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
  const [showModal, setShowModal] = useState(false);
  const [canAR, setCanAR] = useState(false);
  const [isLaunchingAr, setIsLaunchingAr] = useState(false);
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [loadProgress, setLoadProgress] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  
  const visibleViewerRef = useRef<any>(null);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Local model URL relative to current host (clean direct mapping)
  const localModelUrl = modelUrlAr || modelUrl;

  // Fully-qualified public URL with open CORS and no cookie restrictions for Scene Viewer / Quick Look
  const publicModelUrl = getPublicModelUrl(localModelUrl) || localModelUrl;
  
  // Only use explicit iosSrc if provided as a prop; otherwise let model-viewer convert the full GLB dynamically
  const publicIosSrc = iosSrc ? getPublicModelUrl(iosSrc) : undefined;

  // Active model URL (defaults to public CORS URL, falls back to local if needed)
  const [activeModelUrl, setActiveModelUrl] = useState(() => publicModelUrl);

  useEffect(() => {
    setActiveModelUrl(publicModelUrl);
    setIsModelLoaded(false);
    setLoadProgress(0);
    setLoadError(null);
  }, [publicModelUrl]);

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
    if (showModal) {
      document.body.style.overflow = 'hidden';
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          setShowModal(false);
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
  }, [showModal]);

  // Clean up toast timer on unmount
  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current);
      }
    };
  }, []);

  const showToast = useCallback((type: 'loading' | 'error' | 'info', message: string, duration = 4000) => {
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    setToast({ type, message });
    toastTimeoutRef.current = setTimeout(() => {
      setToast(null);
    }, duration);
  }, []);

  // Attach event listeners to visible viewer when modal is opened
  useEffect(() => {
    if (!showModal) {
      setCanAR(false);
      setIsLaunchingAr(false);
      setIsModelLoaded(false);
      setLoadProgress(0);
      setLoadError(null);
      return;
    }

    const viewer = visibleViewerRef.current;
    if (!viewer) return;

    const handleProgress = (e: any) => {
      const p = Math.round((e.detail?.totalProgress || 0) * 100);
      setLoadProgress(p);
    };

    const handleLoad = () => {
      setIsModelLoaded(true);
      setLoadProgress(100);
      setLoadError(null);
      // Check device AR capability once model element is loaded
      if (typeof viewer.canActivateAR === 'boolean') {
        setCanAR(viewer.canActivateAR);
      }
    };

    const handleArStatus = (e: any) => {
      const status = e.detail?.status;
      console.log('[DineView AR] Status:', status);
      if (status === 'session-started' || status === 'object-placed') {
        setIsLaunchingAr(false);
        setToast(null);
      } else if (status === 'failed') {
        setIsLaunchingAr(false);
        showToast('error', t.ar_failed || 'AR session could not be started on this device.');
      } else if (status === 'not-presenting') {
        setIsLaunchingAr(false);
      }
    };

    const handleError = (e: any) => {
      console.warn('[DineView 3D] Model viewer error:', e);
      setIsLaunchingAr(false);
      // If the CDN URL fails, seamlessly fall back to local path
      if (activeModelUrl !== localModelUrl) {
        console.log('[DineView 3D] Switching to local model fallback:', localModelUrl);
        setActiveModelUrl(localModelUrl);
      } else {
        setLoadError('Unable to load 3D model. Please check network connection.');
      }
    };

    viewer.addEventListener('progress', handleProgress);
    viewer.addEventListener('load', handleLoad);
    viewer.addEventListener('ar-status', handleArStatus);
    viewer.addEventListener('error', handleError);

    // Initial check in case it's already cached/loaded
    if (viewer.loaded) {
      setIsModelLoaded(true);
      setLoadProgress(100);
      if (typeof viewer.canActivateAR === 'boolean') {
        setCanAR(viewer.canActivateAR);
      }
    }

    return () => {
      viewer.removeEventListener('progress', handleProgress);
      viewer.removeEventListener('load', handleLoad);
      viewer.removeEventListener('ar-status', handleArStatus);
      viewer.removeEventListener('error', handleError);
    };
  }, [showModal, showToast, activeModelUrl, localModelUrl, t]);

  // Explicit AR launch triggered by user clicking the AR button inside the 3D viewer
  const handleLaunchAR = async (e: React.MouseEvent) => {
    e.stopPropagation();

    const viewer = visibleViewerRef.current;
    if (!viewer) return;

    if (viewer.canActivateAR === false) {
      showToast('info', t.ar_not_supported || 'AR is not supported on this device/browser.');
      return;
    }

    if (!isModelLoaded) {
      showToast('info', '3D model is still preparing, please wait a moment…');
      return;
    }

    try {
      setIsLaunchingAr(true);
      showToast('loading', t.preparing_ar || 'Preparing AR…', 10000);
      await viewer.activateAR();
    } catch (err: any) {
      console.warn('[DineView AR] activateAR error:', err);
      setIsLaunchingAr(false);
      const errStr = String(err?.message || err || '').toLowerCase();
      if (!errStr.includes('cancel') && !errStr.includes('abort')) {
        showToast('error', t.ar_failed || 'Unable to start AR session.');
      } else {
        setToast(null);
      }
    }
  };

  return (
    <>
      {/* Trigger Button on dish cards and details page: opens 3D view directly with no errors */}
      <button 
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setToast(null);
          setShowModal(true);
        }}
        className={buttonClassName || "flex items-center gap-1.5 h-8 px-3 rounded-full border border-border text-text-secondary hover:text-text-primary hover:border-text-secondary transition-colors tracking-widest font-bold text-[9px] uppercase"}
        title="View dish in 3D and Augmented Reality"
      >
        <Box className={iconClassName || "w-3 h-3"} />
        {t.view_3d || 'VIEW IN 3D'}
      </button>

      {/* 
        3D & AR Interactive Modal Dialog:
        - Shows interactive 3D model with 360-degree rotation and zoom
        - Includes native AR button for mobile devices with ARCore / iOS Quick Look
        - Zero unprompted error toasts
      */}
      {showModal && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center bg-bg-primary/95 backdrop-blur-sm p-4 animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowModal(false);
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-3d-title"
        >
          <div className="relative w-full max-w-4xl h-[80vh] md:h-[85vh] bg-bg-secondary border border-border shadow-2xl rounded-sm flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-4 md:p-6 border-b border-border/50 bg-bg-primary/40">
              <h3 id="modal-3d-title" className="font-serif text-xl md:text-2xl text-text-primary flex items-center">
                {itemName} <span className="text-text-secondary text-sm md:text-base font-sans font-normal ml-2">{t.in_3d || 'in 3D'}</span>
              </h3>
              
              <div className="flex items-center gap-2 md:gap-3">
                {/* Header AR button on devices that support AR */}
                {canAR && (
                  <button
                    type="button"
                    onClick={handleLaunchAR}
                    disabled={isLaunchingAr || !isModelLoaded}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-accent text-white text-[11px] font-bold tracking-wider uppercase hover:opacity-90 transition-all active:scale-95 shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
                    title={isModelLoaded ? "View in your space with Augmented Reality" : "Model loading…"}
                  >
                    {isLaunchingAr ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Box className="w-3.5 h-3.5" />
                    )}
                    <span>{isLaunchingAr ? (t.preparing_ar || 'Preparing…') : (t.view_ar || 'View in AR')}</span>
                  </button>
                )}

                <button 
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="p-2 text-text-secondary hover:text-text-primary hover:bg-border/50 rounded-full transition-colors"
                  aria-label={t.close_3d || 'Close 3D viewer'}
                >
                  <X className="w-5 h-5 md:w-6 md:h-6" />
                </button>
              </div>
            </div>
            
            {/* 3D Scene Container */}
            <div className="flex-1 w-full bg-[#f8f6f0] relative flex items-center justify-center overflow-hidden">
              {modelViewerReady ? (
                <>
                  <model-viewer
                    ref={visibleViewerRef}
                    src={activeModelUrl}
                    ios-src={publicIosSrc || undefined}
                    alt={itemName}
                    poster={poster || undefined}
                    ar
                    ar-modes="webxr scene-viewer quick-look"
                    ar-scale="fixed"
                    ar-placement="floor"
                    camera-controls
                    touch-action="pan-y"
                    exposure="1"
                    shadow-intensity="1"
                    shadow-softness="0.5"
                    environment-image="neutral"
                    auto-rotate
                    camera-orbit="0deg 75deg 105%"
                    min-camera-orbit="auto 20deg auto"
                    max-camera-orbit="auto 88deg auto"
                    interaction-prompt="auto"
                    reveal="auto"
                    style={{ width: '100%', height: '100%', backgroundColor: 'transparent' }}
                  >
                    {/* Floating slot AR button: model-viewer automatically displays this on supported mobile devices */}
                    <button
                      slot="ar-button"
                      onClick={handleLaunchAR}
                      disabled={isLaunchingAr || !isModelLoaded}
                      className="absolute bottom-5 right-5 z-10 flex items-center gap-2 bg-neutral-900/95 text-white backdrop-blur-md px-4 py-2.5 rounded-full text-xs font-bold uppercase tracking-wider shadow-xl hover:bg-black transition-all hover:scale-105 active:scale-95 cursor-pointer border border-neutral-700/60 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isLaunchingAr ? (
                        <Loader2 className="w-4 h-4 text-amber-400 animate-spin" />
                      ) : (
                        <Box className="w-4 h-4 text-amber-400" />
                      )}
                      <span>{isLaunchingAr ? (t.preparing_ar || 'Preparing…') : (t.view_ar || 'View in AR')}</span>
                    </button>
                  </model-viewer>

                  {/* Loading progress overlay */}
                  {!isModelLoaded && !loadError && (
                    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/5 pointer-events-none transition-opacity duration-300">
                      <div className="bg-neutral-900/90 text-white backdrop-blur-md px-5 py-4 rounded-2xl shadow-xl flex flex-col items-center gap-2.5 max-w-[220px] border border-neutral-700/60">
                        <Loader2 className="w-6 h-6 text-amber-400 animate-spin" />
                        <span className="text-[11px] font-medium text-neutral-200 tracking-wide text-center">
                          {loadProgress > 0 ? `Loading 3D (${loadProgress}%)` : 'Preparing 3D model…'}
                        </span>
                        {loadProgress > 0 && (
                          <div className="w-full h-1 bg-neutral-700/80 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-amber-400 transition-all duration-200" 
                              style={{ width: `${loadProgress}%` }} 
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Load error & retry state */}
                  {loadError && (
                    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-bg-secondary/95 backdrop-blur-sm p-6 text-center">
                      <Box className="w-10 h-10 text-text-muted mb-3 opacity-60" />
                      <p className="text-sm text-text-primary font-medium mb-1">{loadError}</p>
                      <p className="text-xs text-text-secondary mb-4">The 3D model could not be displayed.</p>
                      <button
                        type="button"
                        onClick={() => {
                          setLoadError(null);
                          setIsModelLoaded(false);
                          setLoadProgress(0);
                          const viewer = visibleViewerRef.current;
                          if (viewer) {
                            const cur = viewer.src;
                            viewer.src = '';
                            setTimeout(() => {
                              viewer.src = cur || localModelUrl;
                            }, 50);
                          }
                        }}
                        className="px-4 py-2 bg-text-primary text-white text-xs font-bold uppercase tracking-wider rounded-full hover:bg-text-secondary transition-colors"
                      >
                        Retry Loading
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex flex-col items-center justify-center gap-3">
                  <Loader2 className="w-8 h-8 text-accent animate-spin" />
                  <span className="text-xs text-text-secondary font-medium tracking-wide uppercase">
                    Loading 3D Engine…
                  </span>
                </div>
              )}
            </div>
            
            {/* Footer helper info */}
            <div className="p-4 bg-bg-secondary border-t border-border/50 flex flex-col sm:flex-row items-center justify-between text-xs md:text-sm text-text-muted gap-2">
              <span>{t.instructions_3d || 'Drag to rotate • Pinch or scroll to zoom'}</span>
              <span className="text-[11px] font-sans text-text-muted/80">3D Interactive Viewer</span>
            </div>

            {/* In-Modal Toast Notification: only shown if user clicks AR and there is an active status */}
            {toast && (
              <div 
                className="absolute bottom-16 left-1/2 -translate-x-1/2 z-[120] max-w-[90%] sm:max-w-md w-full px-4 animate-in fade-in slide-in-from-bottom-2 duration-200 pointer-events-auto"
                role="status"
                aria-live="polite"
              >
                <div className="bg-neutral-900/95 text-white backdrop-blur-md border border-neutral-700/80 rounded-xl px-4 py-2.5 shadow-2xl flex items-center justify-between gap-3 text-xs md:text-sm">
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
                  <button
                    type="button"
                    onClick={() => setToast(null)}
                    className="p-1 text-neutral-400 hover:text-white rounded-md transition-colors shrink-0"
                    aria-label="Dismiss message"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};
