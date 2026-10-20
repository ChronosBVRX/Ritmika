// ═══════════════════════════════════════════════════════════
//  RÍTMika · Navegación D-pad unificada
//  Teclado, control remoto Android y gamepad comparten estas reglas.
//  Cubre menú, modales, lobby, juego y podio.
// ═══════════════════════════════════════════════════════════

(function () {
  const MODAL_ID = 'mm-modal';

  function styleVisible(el) {
    if (!el) return false;
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden') return false;
    return true;
  }

  function visible(el) {
    if (!el || el.disabled) return false;
    if (el.closest('[hidden]')) return false;
    if (el.closest('[aria-hidden="true"]')) return false;
    if (!styleVisible(el)) return false;
    if (el.getClientRects().length === 0) return false;
    return true;
  }

  function isDebug(el) {
    return !!(el && (
      el.id && el.id.indexOf('btn-debug-') === 0 ||
      el.closest('#secret-debug-panel') ||
      el.closest('#ritmika-debug')
    ));
  }

  function focusable(root) {
    if (!root) return [];
    return Array.from(root.querySelectorAll(
      'button, [role="button"], a[href], input, select, textarea, [tabindex="0"]'
    )).filter(el => el.tabIndex >= 0 && !isDebug(el) && visible(el));
  }

  function activeScreen() {
    const active = document.querySelector('.tv-screen.active');
    if (active && visible(active)) return active;
    const podium = document.getElementById('podium-screen');
    if (podium && visible(podium)) return podium;
    return null;
  }

  function modalOpen() {
    const modal = document.getElementById(MODAL_ID);
    return !!(modal && modal.classList.contains('is-open'));
  }

  function focusEl(el) {
    if (!el) return false;
    try {
      el.focus({ preventScroll: true });
      if (document.activeElement !== el) el.focus();
      if (typeof el.scrollIntoView === 'function') {
        el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      }
      return document.activeElement === el;
    } catch (_) {
      return false;
    }
  }

  function selectedModeCard(screen) {
    const mode = typeof selectedMode !== 'undefined' ? selectedMode : 'clasico';
    return screen.querySelector(`.mode-card[data-mode="${mode}"]`) ||
      screen.querySelector('.mode-card.is-selected') ||
      screen.querySelector('.mode-card');
  }

  function selectCard(card) {
    const id = card && card.dataset ? card.dataset.mode : null;
    if (!id) return;
    if (typeof selectedMode !== 'undefined' && selectedMode === id) return;
    if (typeof MainMenu !== 'undefined' && typeof MainMenu.selectMode === 'function') {
      MainMenu.selectMode(id, { instant: true });
    }
  }

  function focusCard(card) {
    const ok = focusEl(card);
    if (ok) selectCard(card);
    return ok;
  }

  function defaultFocus(screen) {
    if (!screen) return false;
    let target = null;
    if (screen.id === 'mode-selection-screen') {
      const cta = document.getElementById('btn-crear-sala-modo');
      target = (cta && !cta.disabled) ? cta : selectedModeCard(screen);
    } else if (screen.id === 'lobby-screen') {
      target = ['#start-btn', '#btn-back-to-modes', '#btn-lobby-settings']
        .map(sel => screen.querySelector(sel))
        .find(el => visible(el) && !el.disabled);
      if (!target) target = focusable(screen)[0];
    } else if (screen.id === 'roulette-screen') {
      target = screen.querySelector('#spin-btn');
      if (!visible(target)) target = focusable(screen)[0];
    } else if (screen.id === 'karaoke-screen') {
      target = ['#go-karaoke-btn', '#continue-btn']
        .map(sel => screen.querySelector(sel))
        .find(el => visible(el) && !el.disabled);
      if (!target) target = focusable(screen)[0];
    } else if (screen.id === 'podium-screen') {
      target = ['#restart-btn-final', '#restart-btn']
        .map(sel => screen.querySelector(sel))
        .find(el => visible(el) && !el.disabled);
      if (!target) target = focusable(screen)[0];
    } else {
      target = focusable(screen)[0];
    }
    return focusEl(target);
  }

  function moveInList(items, current, key, shift) {
    if (!items.length) return false;
    let idx = items.indexOf(current);
    const forward = key === 'ArrowDown' || key === 'ArrowRight' ||
      (key === 'Tab' && !shift);
    const backward = key === 'ArrowUp' || key === 'ArrowLeft' ||
      (key === 'Tab' && shift);
    if (idx < 0) idx = forward ? 0 : items.length - 1;
    else if (forward) idx = (idx + 1) % items.length;
    else if (backward) idx = (idx <= 0) ? items.length - 1 : idx - 1;
    else return false;
    return focusEl(items[idx]);
  }

  function handleMenu(screen, key) {
    const cards = Array.from(screen.querySelectorAll('.mode-card'));
    const utilities = Array.from(screen.querySelectorAll('.mm-utility button')).filter(visible);
    const cta = document.getElementById('btn-crear-sala-modo');
    const el = document.activeElement;
    const cardIndex = cards.indexOf(el);
    const isCard = cardIndex >= 0;
    const isCta = el === cta;
    const isUtility = utilities.indexOf(el) >= 0;
    const selected = () => focusCard(selectedModeCard(screen));
    const utilityAt = (i) => utilities.length ? focusEl(utilities[(i + utilities.length) % utilities.length]) : false;

    if (!isCard && !isCta && !isUtility) return defaultFocus(screen);

    if (isCard) {
      if (key === 'ArrowDown') {
        if (cardIndex === cards.length - 1) return utilityAt(0) || (cta && focusEl(cta));
        return focusCard(cards[cardIndex + 1]);
      }
      if (key === 'ArrowUp') {
        return focusCard(cards[(cardIndex - 1 + cards.length) % cards.length]);
      }
      if (key === 'ArrowRight') {
        return (cta && !cta.disabled && focusEl(cta)) || selected();
      }
      if (key === 'ArrowLeft') return selected();
      return false;
    }

    if (isCta) {
      if (key === 'ArrowLeft' || key === 'ArrowUp') return selected();
      if (key === 'ArrowDown') return utilityAt(0) || selected();
      return false;
    }

    if (isUtility) {
      if (key === 'ArrowLeft' || key === 'ArrowRight') {
        return utilityAt(utilities.indexOf(el) + (key === 'ArrowRight' ? 1 : -1));
      }
      if (key === 'ArrowUp') return selected();
      if (key === 'ArrowDown') return (cta && !cta.disabled && focusEl(cta)) || selected();
      return false;
    }
    return false;
  }

  function handleLobby(screen, key) {
    const back = screen.querySelector('#btn-back-to-modes');
    const settings = screen.querySelector('#btn-lobby-settings');
    const start = screen.querySelector('#start-btn');
    const top = [back, settings].filter(visible);
    const rest = focusable(screen).filter(el => !top.includes(el) && el !== start);
    const el = document.activeElement;

    if (top.indexOf(el) >= 0) {
      if (key === 'ArrowLeft' || key === 'ArrowRight') {
        if (top.length < 2) return focusEl(top[0]);
        const idx = top.indexOf(el);
        return focusEl(top[(idx + (key === 'ArrowRight' ? 1 : -1) + top.length) % top.length]);
      }
      if (key === 'ArrowDown') {
        if (visible(start) && !start.disabled) return focusEl(start);
        if (rest.length) return focusEl(rest[0]);
        return focusEl(settings && visible(settings) ? settings : back);
      }
      if (key === 'ArrowUp') {
        return focusEl(top[0]);
      }
      return false;
    }

    if (el === start) {
      if (key === 'ArrowUp') return focusEl(settings && visible(settings) ? settings : back);
      if (key === 'ArrowDown' && rest.length) return focusEl(rest[0]);
      return false;
    }

    return moveInList(focusable(screen), el, key, false);
  }

  function handleGeneric(screen, key, shift) {
    return moveInList(focusable(screen), document.activeElement, key, shift);
  }

  function handleModal(key, shift) {
    const modal = document.getElementById(MODAL_ID);
    if (!modal) return false;
    if (key === 'Escape') {
      const close = document.getElementById('mm-modal-close');
      if (close) close.click();
      return true;
    }
    const items = focusable(modal);
    if (!items.length) return false;
    return moveInList(items, document.activeElement, key, shift);
  }

  function clickFocused(el) {
    if (!el || el === document.body || el.disabled) return false;
    if (el.tagName === 'BUTTON' || el.getAttribute('role') === 'button' || el.tagName === 'A') {
      el.click();
      return true;
    }
    return false;
  }

  function onKeyDown(event) {
    if (event.defaultPrevented) return;
    if (event.altKey || event.ctrlKey || event.metaKey) return;

    const key = event.key;
    const isAction = key === 'Enter' || key === ' ';
    const isArrow = key.indexOf('Arrow') === 0;
    const isNav = isArrow || key === 'Tab';
    if (!isAction && !isNav && key !== 'Escape') return;

    const modal = modalOpen();
    if (modal) {
      if (isAction) {
        if (clickFocused(document.activeElement)) event.preventDefault();
        else {
          const first = focusable(document.getElementById(MODAL_ID))[0];
          if (first) focusEl(first);
          event.preventDefault();
        }
        return;
      }
      if (isNav || key === 'Escape') {
        if (handleModal(key, event.shiftKey)) event.preventDefault();
      }
      return;
    }

    const screen = activeScreen();
    if (!screen) return;

    const current = document.activeElement;
    if (current && current !== document.body && !visible(current)) {
      event.preventDefault();
      defaultFocus(screen);
      return;
    }

    if (isAction) {
      const el = document.activeElement;
      if (el && el !== document.body && screen.contains(el) && clickFocused(el)) {
        event.preventDefault();
      } else {
        defaultFocus(screen);
        event.preventDefault();
      }
      return;
    }

    if (key === 'Escape') {
      if (screen.id === 'lobby-screen') {
        if (typeof socket !== 'undefined' && !socket.connected) return;
        const back = document.getElementById('btn-back-to-modes');
        if (back) {
          event.preventDefault();
          back.click();
        }
      }
      return;
    }

    if (!isNav) return;
    event.preventDefault();
    if (screen.id === 'mode-selection-screen') {
      handleMenu(screen, key);
    } else if (screen.id === 'lobby-screen') {
      handleLobby(screen, key);
    } else {
      handleGeneric(screen, key, event.shiftKey);
    }
  }

  let focusTimer = null;
  function scheduleFocus(delay) {
    clearTimeout(focusTimer);
    focusTimer = setTimeout(() => {
      if (modalOpen()) return;
      const screen = activeScreen();
      if (!screen) {
        const pre = document.getElementById('pre-boot-screen');
        if (pre && visible(pre)) {
          const enter = document.getElementById('enter-ritmika-btn');
          if (enter && document.activeElement === document.body) focusEl(enter);
          return;
        }
        const retry = document.getElementById('boot-retry');
        if (retry && visible(retry)) focusEl(retry);
        return;
      }
      const current = document.activeElement;
      if (current && current !== document.body && screen.contains(current) && visible(current)) return;
      defaultFocus(screen);
    }, delay || 120);
  }

  const observedScreens = new WeakSet();
  function observeScreens() {
    document.querySelectorAll('.tv-screen').forEach(screen => {
      if (observedScreens.has(screen)) return;
      observedScreens.add(screen);
      new MutationObserver(() => scheduleFocus(140)).observe(screen, {
        attributes: true,
        attributeFilter: ['class']
      });
    });
    const start = document.getElementById('start-btn');
    if (start && !observedScreens.has(start)) {
      observedScreens.add(start);
      new MutationObserver(() => scheduleFocus(120)).observe(start, {
        attributes: true,
        attributeFilter: ['class', 'disabled']
      });
    }
  }

  window.__ritmikaHandleBack = () => {
    const modal = document.getElementById(MODAL_ID);
    if (modal && modal.classList.contains('is-open')) {
      const close = document.getElementById('mm-modal-close');
      if (close) {
        close.click();
        return true;
      }
    }
    const screen = activeScreen();
    if (screen && screen.id === 'lobby-screen') {
      if (typeof socket !== 'undefined' && !socket.connected) return false;
      const back = document.getElementById('btn-back-to-modes');
      if (back) {
        back.click();
        return true;
      }
    }
    return false;
  };

  window.__ritmikaFocusActive = () => defaultFocus(activeScreen());

  document.addEventListener('keydown', onKeyDown);
  window.addEventListener('focus', () => {
    if (document.activeElement === document.body) scheduleFocus(120);
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      observeScreens();
      scheduleFocus(350);
    }, { once: true });
  } else {
    observeScreens();
    scheduleFocus(350);
  }

  new MutationObserver(() => {
    observeScreens();
    scheduleFocus(180);
  }).observe(document.body, { childList: true, subtree: true });
})();
