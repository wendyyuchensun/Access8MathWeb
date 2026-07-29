import React, {
  Children,
  cloneElement,
  useCallback,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import PropTypes from 'prop-types';

const OFFSET = 8;

// Used on the very first render of a tooltip, before it has been measured: it has to be in the
// document to have a size, but must not be painted at a position we already know is wrong.
const MEASURING_STYLES = { left: 0, top: 0, visibility: 'hidden' };

const ARROW_CLASS = {
  top: 'absolute left-1/2 -translate-x-1/2 -bottom-[14px] border-[7px] border-transparent border-t-[#1A1A1A99]',
  bottom:
    'absolute left-1/2 -translate-x-1/2 -top-[14px] border-[7px] border-transparent border-b-[#1A1A1A99]',
  left: 'absolute top-1/2 -translate-y-1/2 -right-[14px] border-[7px] border-transparent border-l-[#1A1A1A99]',
  right:
    'absolute top-1/2 -translate-y-1/2 -left-[14px] border-[7px] border-transparent border-r-[#1A1A1A99]',
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
const getPositionStyles = (triggerRect, tooltipRect, position) => {
  const centerX = triggerRect.left + triggerRect.width / 2;
  const centerY = triggerRect.top + triggerRect.height / 2;

  const { left, top, transform } = {
    top: {
      left: centerX,
      top: triggerRect.top - tooltipRect.height - OFFSET,
      transform: 'translateX(-50%)',
    },
    bottom: {
      left: centerX,
      top: triggerRect.bottom + OFFSET,
      transform: 'translateX(-50%)',
    },
    left: {
      left: triggerRect.left - tooltipRect.width - OFFSET,
      top: centerY,
      transform: 'translateY(-50%)',
    },
    right: {
      left: triggerRect.right + OFFSET,
      top: centerY,
      transform: 'translateY(-50%)',
    },
  }[position];

  return { left: `${left}px`, top: `${top}px`, transform };
};

const Tooltip = ({ children, label, position = 'top' }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [styles, setStyles] = useState(null);
  const triggerRef = useRef(null);
  const tooltipRef = useRef(null);
  const tooltipId = useId();

  const showTooltip = useCallback(() => setIsVisible(true), []);

  const hideTooltip = useCallback(() => {
    setIsVisible(false);
    setStyles(null);
  }, []);

  // Layout effect rather than useEffect: measuring and positioning has to happen before the
  // browser paints, otherwise the tooltip is visible for a frame at the wrong place.
  useLayoutEffect(() => {
    if (!isVisible || !triggerRef.current || !tooltipRef.current) return;
    setStyles(
      getPositionStyles(
        triggerRef.current.getBoundingClientRect(),
        tooltipRef.current.getBoundingClientRect(),
        position
      )
    );
  }, [isVisible, label, position]);

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
    onMouseLeave: composeHandlers(triggerProps.onMouseLeave, hideTooltip),
    onFocus: composeHandlers(triggerProps.onFocus, showTooltip),
    onBlur: composeHandlers(triggerProps.onBlur, hideTooltip),
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
            style={styles ?? MEASURING_STYLES}
          >
            {label}
            <div className={ARROW_CLASS[position]} />
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
