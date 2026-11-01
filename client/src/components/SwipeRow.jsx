import { useRef, useState } from 'react';

/**
 * A row that reveals action buttons when swiped to the left.
 *
 * Used on the admin dashboard for phones, where the tables become cards and
 * a swipe is the quickest way to act on a row. On a desktop the cards are
 * hidden, so this component is never rendered there.
 */
export default function SwipeRow({
  actions = [],
  onAction,
  onCommit,
  children,
  height,
  radius = 12,
  actionWidth = 76,
  style,
}) {
  const totalActionWidth = actions.length * actionWidth;

  const [offset, setOffset] = useState(0);
  const dragging = useRef(false);
  const startX = useRef(0);
  const startOffset = useRef(0);

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

  const onPointerDown = (event) => {
    dragging.current = true;
    startX.current = event.clientX;
    startOffset.current = offset;
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event) => {
    if (!dragging.current) return;
    const delta = startX.current - event.clientX;
    setOffset(clamp(startOffset.current + delta, 0, totalActionWidth));
  };

  const onPointerUp = () => {
    if (!dragging.current) return;
    dragging.current = false;
    setOffset((current) => {
      if (current > totalActionWidth * 0.4) return totalActionWidth;
      return 0;
    });
  };

  const close = () => setOffset(0);

  const handleAction = (action) => {
    if (onAction) onAction(action);
    if (onCommit) onCommit(action);
    close();
  };

  return (
    <div
      style={{
        position: 'relative',
        overflow: 'hidden',
        borderRadius: radius,
        height,
        marginBottom: 8,
        ...style,
      }}
    >
      <div
        style={{
          position: 'absolute',
          right: 0,
          top: 0,
          bottom: 0,
          width: totalActionWidth,
          display: 'flex',
        }}
      >
        {actions.map((action) => (
          <button
            key={action.id}
            type="button"
            onClick={() => handleAction(action)}
            style={{
              width: actionWidth,
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4,
              color: '#ffffff',
              background: action.color || '#e5484d',
              fontSize: 12,
              fontWeight: 700,
              padding: 0,
            }}
          >
            {action.icon}
            <span>{action.label}</span>
          </button>
        ))}
      </div>

      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        style={{
          transform: `translateX(-${offset}px)`,
          transition: dragging.current ? 'none' : 'transform 200ms ease',
          touchAction: 'pan-y',
          background: '#ffffff',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          position: 'relative',
          zIndex: 1,
        }}
      >
        {children}
      </div>
    </div>
  );
}
