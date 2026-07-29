import React, {
  Children,
  cloneElement,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import PropTypes from 'prop-types';

const OFFSET = 8;
const VIEWPORT_PADDING = 8;
// Grace period between leaving the trigger and hiding, long enough to reach the tooltip.
const HIDE_DELAY = 200;
// Stops the arrow from sliding out past the tooltip's rounded corners once the body is clamped.
const ARROW_INSET = 11;

// Used on the very first render of a tooltip, before it has been measured: it has to be in the
// document to have a size, but must not be painted at a position we already know is wrong.
const MEASURING_STYLES = { left: 0, top: 0, visibility: 'hidden' };

const OPPOSITE = { top: 'bottom', bottom: 'top', left: 'right', right: 'left' };

const ARROW_CLASS = {
  top: 'absolute -translate-x-1/2 -bottom-[14px] border-[7px] border-transparent border-t-[#1A1A1A99]',
  bottom:
    'absolute -translate-x-1/2 -top-[14px] border-[7px] border-transparent border-b-[#1A1A1A99]',
  left: 'absolute -translate-y-1/2 -right-[14px] border-[7px] border-transparent border-l-[#1A1A1A99]',
  right:
    'absolute -translate-y-1/2 -left-[14px] border-[7px] border-transparent border-r-[#1A1A1A99]',
};

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const hasRoomFor = (position, triggerRect, tooltipRect) => {
  switch (position) {
    case 'top':
      return triggerRect.top - tooltipRect.height - OFFSET >= VIEWPORT_PADDING;
    case 'bottom':
      return (
        triggerRect.bottom + tooltipRect.height + OFFSET <= window.innerHeight - VIEWPORT_PADDING
      );
    case 'left':
      return triggerRect.left - tooltipRect.width - OFFSET >= VIEWPORT_PADDING;
    default:
      return triggerRect.right + tooltipRect.width + OFFSET <= window.innerWidth - VIEWPORT_PADDING;
  }
};

// The trigger is cloned, so anything we put on it would otherwise replace a prop of the same name
// that the caller (or a wrapper like Headless UI's `Tab`, which has its own focus handling) already
// set. Run theirs first, then ours.
const composeHandlers =
  (theirs, ours) =>
  (...eventArgs) => {
    theirs?.(...eventArgs);
    ours(...eventArgs);
  };

// Coordinates are viewport-relative because the tooltip is rendered `fixed` into a portal.
const getPlacement = (triggerRect, tooltipRect, preferred) => {
  // Flip to the opposite side when the preferred one has no room. If neither side fits, stay on
  // the preferred one and let the clamping below salvage what it can.
  const placement =
    hasRoomFor(preferred, triggerRect, tooltipRect) ||
    !hasRoomFor(OPPOSITE[preferred], triggerRect, tooltipRect)
      ? preferred
      : OPPOSITE[preferred];

  // Resolved rather than centred with a translate, so that the clamping below can reason about
  // where the tooltip's edges actually land.
  const centeredX = triggerRect.left + triggerRect.width / 2 - tooltipRect.width / 2;
  const centeredY = triggerRect.top + triggerRect.height / 2 - tooltipRect.height / 2;

  const unclamped = {
    top: { left: centeredX, top: triggerRect.top - tooltipRect.height - OFFSET },
    bottom: { left: centeredX, top: triggerRect.bottom + OFFSET },
    left: { left: triggerRect.left - tooltipRect.width - OFFSET, top: centeredY },
    right: { left: triggerRect.right + OFFSET, top: centeredY },
  }[placement];

  // `Math.max` on the upper bound matters for a tooltip larger than the viewport: without it the
  // bound falls below VIEWPORT_PADDING and the clamp would shove the tooltip back off the near
  // edge instead of pinning it there.
  const left = clamp(
    unclamped.left,
    VIEWPORT_PADDING,
    Math.max(VIEWPORT_PADDING, window.innerWidth - tooltipRect.width - VIEWPORT_PADDING)
  );
  const top = clamp(
    unclamped.top,
    VIEWPORT_PADDING,
    Math.max(VIEWPORT_PADDING, window.innerHeight - tooltipRect.height - VIEWPORT_PADDING)
  );

  // Clamping slides the body sideways relative to the trigger, so the arrow has to track the
  // trigger's centre rather than sit at a fixed 50% and point at nothing.
  const arrowStyles =
    placement === 'top' || placement === 'bottom'
      ? {
          left: `${clamp(
            triggerRect.left + triggerRect.width / 2 - left,
            ARROW_INSET,
            tooltipRect.width - ARROW_INSET
          )}px`,
        }
      : {
          top: `${clamp(
            triggerRect.top + triggerRect.height / 2 - top,
            ARROW_INSET,
            tooltipRect.height - ARROW_INSET
          )}px`,
        };

  return { placement, styles: { left: `${left}px`, top: `${top}px` }, arrowStyles };
};

const Tooltip = ({ children, label, position = 'top' }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [placement, setPlacement] = useState(null);
  const triggerRef = useRef(null);
  const tooltipRef = useRef(null);
  const tooltipId = useId();
  const hideTimerRef = useRef(null);
  // Set by Escape, so the tooltip does not spring straight back while the trigger is still
  // hovered or focused. Cleared once the pointer or focus actually leaves.
  const isDismissedRef = useRef(false);

  const cancelScheduledHide = useCallback(() => {
    if (hideTimerRef.current === null) return;
    clearTimeout(hideTimerRef.current);
    hideTimerRef.current = null;
  }, []);

  const hideTooltip = useCallback(() => {
    cancelScheduledHide();
    setIsVisible(false);
    setPlacement(null);
  }, [cancelScheduledHide]);

  // WCAG 1.4.13 "Hoverable": hiding on mouseleave the instant the pointer left the trigger made
  // the tooltip impossible to hover, because reaching it means crossing the OFFSET gap. Delay the
  // hide so the pointer can get there; entering the tooltip cancels it.
  const scheduleHide = useCallback(() => {
    cancelScheduledHide();
    hideTimerRef.current = setTimeout(hideTooltip, HIDE_DELAY);
  }, [cancelScheduledHide, hideTooltip]);

  const showTooltip = useCallback(() => {
    if (isDismissedRef.current) return;
    cancelScheduledHide();
    setIsVisible(true);
  }, [cancelScheduledHide]);

  const handleTriggerMouseLeave = useCallback(() => {
    isDismissedRef.current = false;
    scheduleHide();
  }, [scheduleHide]);

  const handleTriggerBlur = useCallback(() => {
    isDismissedRef.current = false;
    hideTooltip();
  }, [hideTooltip]);

  const reposition = useCallback(() => {
    if (!triggerRef.current || !tooltipRef.current) return;
    setPlacement(
      getPlacement(
        triggerRef.current.getBoundingClientRect(),
        tooltipRef.current.getBoundingClientRect(),
        position
      )
    );
  }, [position]);

  // Layout effect rather than useEffect: measuring and positioning has to happen before the
  // browser paints, otherwise the tooltip is visible for a frame at the wrong place.
  useLayoutEffect(() => {
    if (isVisible) reposition();
  }, [isVisible, label, reposition]);

  useEffect(() => {
    if (!isVisible) return;
    // Capture phase, because scroll does not bubble and the trigger may live inside a nested
    // scroller rather than the document — the category rail is one (`edit-icons-tab.js:112`).
    window.addEventListener('scroll', reposition, true);
    window.addEventListener('resize', reposition);
    return () => {
      window.removeEventListener('scroll', reposition, true);
      window.removeEventListener('resize', reposition);
    };
  }, [isVisible, reposition]);

  // WCAG 1.4.13 "Dismissible": a tooltip covering the content underneath has to be clearable
  // without moving the pointer or focus away.
  useEffect(() => {
    if (!isVisible) return;
    const handleKeyDown = (event) => {
      if (event.key !== 'Escape') return;
      isDismissedRef.current = true;
      hideTooltip();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isVisible, hideTooltip]);

  useEffect(() => cancelScheduledHide, [cancelScheduledHide]);

  const triggerElement = Children.only(children);
  const { props: triggerProps } = triggerElement;

  const trigger = cloneElement(triggerElement, {
    ref: (node) => {
      triggerRef.current = node;
      const { ref } = triggerElement;
      if (typeof ref === 'function') {
        ref(node);
      } else if (ref !== null && typeof ref === 'object') {
        ref.current = node;
      }
    },
    'aria-describedby':
      [triggerProps['aria-describedby'], isVisible ? tooltipId : null].filter(Boolean).join(' ') ||
      null,
    onMouseEnter: composeHandlers(triggerProps.onMouseEnter, showTooltip),
    onMouseLeave: composeHandlers(triggerProps.onMouseLeave, handleTriggerMouseLeave),
    onFocus: composeHandlers(triggerProps.onFocus, showTooltip),
    onBlur: composeHandlers(triggerProps.onBlur, handleTriggerBlur),
  });

  return (
    <>
      {trigger}
      {isVisible &&
        label &&
        createPortal(
          <div
            ref={tooltipRef}
            id={tooltipId}
            role="tooltip"
            className="fixed z-50 bg-[#1A1A1A99] text-white text-sm leading-[1.4] px-3 py-1 rounded whitespace-nowrap"
            style={placement?.styles ?? MEASURING_STYLES}
            onMouseEnter={cancelScheduledHide}
            onMouseLeave={hideTooltip}
          >
            {label}
            <div
              className={ARROW_CLASS[placement?.placement ?? position]}
              style={placement?.arrowStyles}
            />
          </div>,
          document.body
        )}
    </>
  );
};

Tooltip.propTypes = {
  children: PropTypes.element.isRequired,
  label: PropTypes.string.isRequired,
  position: PropTypes.oneOf(['top', 'bottom', 'left', 'right']),
};

export default Tooltip;
