/* eslint-env jest */

import React, { act } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

import Tooltip from './tooltip';

describe('<Tooltip /> verification', () => {
  it('renders into document.body, not next to the trigger', () => {
    const { container } = render(
      <Tooltip label="Square root">
        <button type="button">trigger</button>
      </Tooltip>
    );
    fireEvent.mouseEnter(screen.getByRole('button'));
    const tooltip = screen.getByRole('tooltip');
    expect(tooltip).toBeInTheDocument();
    expect(container.contains(tooltip)).toBe(false);
    expect(tooltip.parentElement).toBe(document.body);
  });

  it('links the trigger to the tooltip only while visible, preserving an existing description', () => {
    render(
      <Tooltip label="Square root">
        <button type="button" aria-describedby="existing">
          trigger
        </button>
      </Tooltip>
    );
    const trigger = screen.getByRole('button');
    expect(trigger.getAttribute('aria-describedby')).toBe('existing');

    fireEvent.focus(trigger);
    const ids = trigger.getAttribute('aria-describedby').split(' ');
    expect(ids).toContain('existing');
    expect(ids).toContain(screen.getByRole('tooltip').id);
  });

  it('dismisses on Escape and stays dismissed until focus leaves and returns', () => {
    render(
      <Tooltip label="Square root">
        <button type="button">trigger</button>
      </Tooltip>
    );
    const trigger = screen.getByRole('button');

    fireEvent.focus(trigger);
    expect(screen.getByRole('tooltip')).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

    // Still focused, so re-triggering must not bring it back.
    fireEvent.mouseEnter(trigger);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

    fireEvent.blur(trigger);
    fireEvent.focus(trigger);
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
  });

  it('stays open long enough for the pointer to reach it, then closes on leaving it', () => {
    jest.useFakeTimers();
    render(
      <Tooltip label="Square root">
        <button type="button">trigger</button>
      </Tooltip>
    );
    const trigger = screen.getByRole('button');

    fireEvent.mouseEnter(trigger);
    fireEvent.mouseLeave(trigger);
    // Mid-flight across the gap: not gone yet.
    act(() => jest.advanceTimersByTime(50));
    const tooltip = screen.getByRole('tooltip');

    fireEvent.mouseEnter(tooltip);
    act(() => jest.advanceTimersByTime(5000));
    expect(screen.getByRole('tooltip')).toBeInTheDocument();

    fireEvent.mouseLeave(tooltip);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    jest.useRealTimers();
  });

  it('hides after the delay when the pointer does not reach it', () => {
    jest.useFakeTimers();
    render(
      <Tooltip label="Square root">
        <button type="button">trigger</button>
      </Tooltip>
    );
    const trigger = screen.getByRole('button');

    fireEvent.mouseEnter(trigger);
    fireEvent.mouseLeave(trigger);
    act(() => jest.advanceTimersByTime(500));
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    jest.useRealTimers();
  });

  it("runs the trigger's own handlers as well as its own", () => {
    const onMouseEnter = jest.fn();
    const onFocus = jest.fn();
    render(
      <Tooltip label="Square root">
        <button type="button" onMouseEnter={onMouseEnter} onFocus={onFocus}>
          trigger
        </button>
      </Tooltip>
    );
    const trigger = screen.getByRole('button');

    fireEvent.mouseEnter(trigger);
    expect(onMouseEnter).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('tooltip')).toBeInTheDocument();

    fireEvent.focus(trigger);
    expect(onFocus).toHaveBeenCalledTimes(1);
  });

  it('forwards the trigger ref to the caller as well as itself', () => {
    const ref = React.createRef();
    render(
      <Tooltip label="Square root">
        <button type="button" ref={ref}>
          trigger
        </button>
      </Tooltip>
    );
    expect(ref.current).toBe(screen.getByRole('button'));
  });

  describe('geometry', () => {
    // jsdom reports every rect as zero, so the flip/clamp math needs rects supplied by hand.
    const mockRects = (trigger, tooltip) =>
      jest.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function () {
        return this.getAttribute('role') === 'tooltip' ? tooltip : trigger;
      });

    afterEach(() => jest.restoreAllMocks());

    it('flips to the opposite side when the preferred side has no room', () => {
      // Trigger pinned near the top of a 1024x768 jsdom viewport: "top" cannot fit above it.
      mockRects(
        { top: 4, bottom: 40, left: 500, right: 540, width: 40, height: 36 },
        { top: 0, bottom: 30, left: 0, right: 100, width: 100, height: 30 }
      );
      render(
        <Tooltip label="Square root" position="top">
          <button type="button">trigger</button>
        </Tooltip>
      );
      fireEvent.mouseEnter(screen.getByRole('button'));

      const tooltip = screen.getByRole('tooltip');
      expect(tooltip.style.top).toBe('48px'); // trigger.bottom + OFFSET
      expect(tooltip.lastChild.className).toContain('border-b-'); // arrow now points up
    });

    it('clamps into the viewport and keeps the arrow on the trigger', () => {
      // Wide tooltip on a trigger hugging the right edge: centring would overflow.
      mockRects(
        { top: 400, bottom: 440, left: 1000, right: 1024, width: 24, height: 40 },
        { top: 0, bottom: 30, left: 0, right: 300, width: 300, height: 30 }
      );
      render(
        <Tooltip label="A considerably longer label" position="top">
          <button type="button">trigger</button>
        </Tooltip>
      );
      fireEvent.mouseEnter(screen.getByRole('button'));

      const tooltip = screen.getByRole('tooltip');
      // window.innerWidth - tooltip.width - VIEWPORT_PADDING, rather than the centred 862px.
      expect(tooltip.style.left).toBe('716px');
      expect(tooltip.style.top).toBe('362px');
      // Trigger centre is 296px from the clamped left edge, pulled in to the arrow inset.
      expect(tooltip.lastChild.style.left).toBe('289px');
    });
  });

  it('repositions when a scroll happens in a nested container', () => {
    render(
      <div data-testid="scroller" style={{ overflowY: 'auto' }}>
        <Tooltip label="Square root" position="right">
          <button type="button">trigger</button>
        </Tooltip>
      </div>
    );
    fireEvent.mouseEnter(screen.getByRole('button'));
    const tooltip = screen.getByRole('tooltip');
    expect(tooltip).toBeVisible();

    // Capture-phase listener: a scroll that does not bubble must still be observed.
    fireEvent.scroll(screen.getByTestId('scroller'));
    expect(screen.getByRole('tooltip')).toBe(tooltip);
  });
});
