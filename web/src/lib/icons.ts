// Phosphor icons used by the app. Only these are bundled; add an import to use another.

import arrowClockwise from '@phosphor-icons/core/regular/arrow-clockwise.svg?raw';
import arrowDown from '@phosphor-icons/core/regular/arrow-down.svg?raw';
import arrowRight from '@phosphor-icons/core/regular/arrow-right.svg?raw';
import arrowsClockwise from '@phosphor-icons/core/regular/arrows-clockwise.svg?raw';
import arrowsCounterClockwise from '@phosphor-icons/core/regular/arrows-counter-clockwise.svg?raw';
import calendarBlank from '@phosphor-icons/core/regular/calendar-blank.svg?raw';
import caretDown from '@phosphor-icons/core/regular/caret-down.svg?raw';
import caretLeft from '@phosphor-icons/core/regular/caret-left.svg?raw';
import caretRight from '@phosphor-icons/core/regular/caret-right.svg?raw';
import chartLineUp from '@phosphor-icons/core/regular/chart-line-up.svg?raw';
import check from '@phosphor-icons/core/regular/check.svg?raw';
import clockCounterClockwise from '@phosphor-icons/core/regular/clock-counter-clockwise.svg?raw';
import dotsThreeOutline from '@phosphor-icons/core/regular/dots-three-outline.svg?raw';
import downloadSimple from '@phosphor-icons/core/regular/download-simple.svg?raw';
import drop from '@phosphor-icons/core/regular/drop.svg?raw';
import funnelSimple from '@phosphor-icons/core/regular/funnel-simple.svg?raw';
import globe from '@phosphor-icons/core/regular/globe.svg?raw';
import image from '@phosphor-icons/core/regular/image.svg?raw';
import lamp from '@phosphor-icons/core/regular/lamp.svg?raw';
import magnifyingGlass from '@phosphor-icons/core/regular/magnifying-glass.svg?raw';
import magnifyingGlassMinus from '@phosphor-icons/core/regular/magnifying-glass-minus.svg?raw';
import magnifyingGlassPlus from '@phosphor-icons/core/regular/magnifying-glass-plus.svg?raw';
import moon from '@phosphor-icons/core/regular/moon.svg?raw';
import palette from '@phosphor-icons/core/regular/palette.svg?raw';
import penNib from '@phosphor-icons/core/regular/pen-nib.svg?raw';
import pencilSimple from '@phosphor-icons/core/regular/pencil-simple.svg?raw';
import plus from '@phosphor-icons/core/regular/plus.svg?raw';
import signOut from '@phosphor-icons/core/regular/sign-out.svg?raw';
import slidersHorizontal from '@phosphor-icons/core/regular/sliders-horizontal.svg?raw';
import sortAscending from '@phosphor-icons/core/regular/sort-ascending.svg?raw';
import squaresFour from '@phosphor-icons/core/regular/squares-four.svg?raw';
import star from '@phosphor-icons/core/regular/star.svg?raw';
import trash from '@phosphor-icons/core/regular/trash.svg?raw';
import uploadSimple from '@phosphor-icons/core/regular/upload-simple.svg?raw';
import warning from '@phosphor-icons/core/regular/warning.svg?raw';
import x from '@phosphor-icons/core/regular/x.svg?raw';

export const icons = {
  'arrow-clockwise': arrowClockwise,
  'arrow-down': arrowDown,
  'arrow-right': arrowRight,
  'arrows-clockwise': arrowsClockwise,
  'arrows-counter-clockwise': arrowsCounterClockwise,
  'calendar-blank': calendarBlank,
  'caret-down': caretDown,
  'caret-left': caretLeft,
  'caret-right': caretRight,
  'chart-line-up': chartLineUp,
  'check': check,
  'clock-counter-clockwise': clockCounterClockwise,
  'dots-three-outline': dotsThreeOutline,
  'download-simple': downloadSimple,
  'drop': drop,
  'funnel-simple': funnelSimple,
  'globe': globe,
  'image': image,
  'lamp': lamp,
  'magnifying-glass': magnifyingGlass,
  'magnifying-glass-minus': magnifyingGlassMinus,
  'magnifying-glass-plus': magnifyingGlassPlus,
  'moon': moon,
  'palette': palette,
  'pen-nib': penNib,
  'pencil-simple': pencilSimple,
  'plus': plus,
  'sign-out': signOut,
  'sliders-horizontal': slidersHorizontal,
  'sort-ascending': sortAscending,
  'squares-four': squaresFour,
  'star': star,
  'trash': trash,
  'upload-simple': uploadSimple,
  'warning': warning,
  'x': x,
} as const;

export type IconName = keyof typeof icons;
