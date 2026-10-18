/// <reference types="vite/client" />

declare global {
  namespace JSX {
    interface IntrinsicElements {
      'model-viewer': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        src?: string;
        'ios-src'?: string;
        alt?: string;
        ar?: boolean | string;
        'ar-modes'?: string;
        'ar-scale'?: string;
        'ar-placement'?: string;
        'camera-controls'?: boolean | string;
        'camera-orbit'?: string;
        'touch-action'?: string;
        exposure?: string | number;
        'shadow-intensity'?: string | number;
        'environment-image'?: string;
        'auto-rotate'?: boolean | string;
        poster?: string;
        reveal?: string;
        'interaction-prompt'?: string;
        slot?: string;
      };
    }
  }
}
