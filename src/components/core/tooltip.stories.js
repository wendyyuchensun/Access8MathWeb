import React from 'react';

import Tooltip from './tooltip';

export default {
  title: 'Core/Tooltip',
  component: Tooltip,
  parameters: {
    layout: 'centered',
  },
  args: {
    label: 'Square root',
    position: 'top',
  },
  argTypes: {
    position: {
      control: 'radio',
      options: ['top', 'bottom', 'left', 'right'],
    },
  },
};

const TRIGGER_CLASS =
  'rounded border border-gray-200 bg-white px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';

export const Default = {
  render: (args) => (
    <Tooltip {...args}>
      <button type="button" className={TRIGGER_CLASS}>
        Hover or focus me
      </button>
    </Tooltip>
  ),
};

export const AllPositions = {
  render: ({ label }) => (
    <div className="grid grid-cols-2 gap-8 p-16">
      {['top', 'bottom', 'left', 'right'].map((position) => (
        <Tooltip key={position} label={`${label} (${position})`} position={position}>
          <button type="button" className={TRIGGER_CLASS}>
            {position}
          </button>
        </Tooltip>
      ))}
    </div>
  ),
};

/**
 * Labels come from `public/locales/*` and can be considerably longer than the trigger. The tooltip
 * does not wrap, so this is the case to watch when judging whether `whitespace-nowrap` should stay.
 */
export const LongLabel = {
  args: {
    label: 'Insert a definite integral with upper and lower bounds',
  },
  render: (args) => (
    <Tooltip {...args}>
      <button type="button" className={TRIGGER_CLASS}>
        Short trigger
      </button>
    </Tooltip>
  ),
};

/**
 * Each trigger asks for the placement that points off-screen, so every tooltip here has to flip to
 * its opposite side. The arrow should still point at its trigger after the body is clamped inwards.
 */
export const ViewportEdges = {
  parameters: {
    layout: 'fullscreen',
  },
  render: ({ label }) => (
    <div className="relative h-screen w-screen">
      {[
        { position: 'top', className: 'top-0 left-1/2 -translate-x-1/2' },
        { position: 'bottom', className: 'bottom-0 left-1/2 -translate-x-1/2' },
        { position: 'left', className: 'left-0 top-1/2 -translate-y-1/2' },
        { position: 'right', className: 'right-0 top-1/2 -translate-y-1/2' },
      ].map(({ position, className }) => (
        <div key={position} className={`absolute ${className}`}>
          <Tooltip label={`${label} — asked for ${position}`} position={position}>
            <button type="button" className={TRIGGER_CLASS}>
              {position} edge
            </button>
          </Tooltip>
        </div>
      ))}
    </div>
  ),
};

/**
 * Mirrors the category rail in `edit-icons-tab.js`: a nested `overflow-y: auto` scroller whose
 * tooltips point outwards. Open a tooltip and scroll the rail — it should follow its trigger rather
 * than being left behind, and it should not be clipped by the scroller.
 */
export const InsideScrollContainer = {
  render: ({ label }) => (
    <div className="flex h-48 w-24 flex-col gap-2 overflow-y-auto border border-border-main p-2">
      {['sum', 'fraction', 'root', 'matrix', 'integral', 'limit', 'vector'].map((id) => (
        <Tooltip key={id} label={`${label}: ${id}`} position="right">
          <button type="button" className={`${TRIGGER_CLASS} shrink-0`}>
            {id}
          </button>
        </Tooltip>
      ))}
    </div>
  ),
};

/**
 * WCAG 1.4.13 checks, which have no automated coverage. Tab to the trigger and the tooltip should
 * appear; press Escape and it should go away without focus moving, and stay away until focus leaves
 * and comes back. With the pointer, move from the trigger onto the tooltip itself — it should
 * survive the gap rather than vanishing en route.
 */
export const DismissibleAndHoverable = {
  args: {
    label: 'Press Escape to dismiss, or hover me',
  },
  render: (args) => (
    <div className="flex gap-4">
      <Tooltip {...args}>
        <button type="button" className={TRIGGER_CLASS}>
          Trigger
        </button>
      </Tooltip>
      <button type="button" className={TRIGGER_CLASS}>
        Somewhere else to focus
      </button>
    </div>
  ),
};

/**
 * The trigger's own handlers must survive being cloned. Both the tooltip and the button's own
 * counter should react to hover and focus.
 */
export const ComposesTriggerHandlers = {
  render: (args) => (
    <Tooltip {...args}>
      <button
        type="button"
        className={TRIGGER_CLASS}
        onMouseEnter={() => console.log('trigger onMouseEnter still runs')}
        onFocus={() => console.log('trigger onFocus still runs')}
      >
        Check the browser console
      </button>
    </Tooltip>
  ),
};
