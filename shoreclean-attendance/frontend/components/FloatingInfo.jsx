import { createPopper } from '@popperjs/core';
import { useEffect, useRef, useState } from 'react';

export default function FloatingInfo({ title, message, placement = 'top' }) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef(null);
  const popperRef = useRef(null);
  const arrowRef = useRef(null);

  useEffect(() => {
    if (!open || !triggerRef.current || !popperRef.current) {
      return undefined;
    }

    const instance = createPopper(triggerRef.current, popperRef.current, {
      placement,
      modifiers: [
        {
          name: 'offset',
          options: { offset: [0, 10] },
        },
        {
          name: 'arrow',
          options: { element: arrowRef.current },
        },
        {
          name: 'preventOverflow',
          options: { padding: 8 },
        },
        {
          name: 'flip',
          options: { fallbackPlacements: ['bottom', 'right', 'left'] },
        },
      ],
    });

    return () => {
      instance.destroy();
    };
  }, [open, placement]);

  return (
    <span
      className="floating-info"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        className="floating-info-trigger"
        ref={triggerRef}
        aria-label={title || 'Info'}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
      >
        ?
      </button>

      {open ? (
        <div className="floating-info-popper" ref={popperRef} role="tooltip">
          {title ? <div className="floating-info-title">{title}</div> : null}
          <div className="floating-info-message">{message}</div>
          <div className="floating-info-arrow" ref={arrowRef} />
        </div>
      ) : null}
    </span>
  );
}
