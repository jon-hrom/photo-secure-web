interface TourOverlayProps {
  targetRect: DOMRect | null;
  onSkip: () => void;
}

const TourOverlay = ({ targetRect, onSkip }: TourOverlayProps) => {
  return (
    <>
      <svg className="fixed inset-0 pointer-events-none" style={{ zIndex: 9999, width: '100%', height: '100%' }}>
        <defs>
          <mask id="spotlight-mask">
            <rect width="100%" height="100%" fill="white" />
            {targetRect && (
              <rect
                x={targetRect.left - 8}
                y={targetRect.top - 8}
                width={targetRect.width + 16}
                height={targetRect.height + 16}
                rx="12"
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect 
          width="100%" 
          height="100%" 
          fill="rgba(0, 0, 0, 0.6)" 
          mask="url(#spotlight-mask)"
        />
      </svg>
      
      <div 
        className="fixed inset-0"
        style={{ zIndex: 9999 }}
        onClick={onSkip}
      />
      
      {targetRect && (
        <div
          className="fixed border-4 border-primary rounded-xl pointer-events-none animate-pulse"
          style={{
            top: `${targetRect.top - 8}px`,
            left: `${targetRect.left - 8}px`,
            width: `${targetRect.width + 16}px`,
            height: `${targetRect.height + 16}px`,
            zIndex: 10000
          }}
        />
      )}
    </>
  );
};

export default TourOverlay;
