import { hapticTrigger } from "ios-haptics";

/** React 19 callback ref; attach inputRef for a Base UI checkbox. */
export function hapticRef(element: HTMLElement | null) {
  if (!element) {
    return;
  }
  const { position } = element.style;
  const nativeInput = element instanceof HTMLInputElement;
  const hadSwitch = element.hasAttribute("switch");
  if (nativeInput) {
    // The existing field label supplies Safari's trusted native click.
    element.setAttribute("switch", "");
  } else if (element.tagName !== "A") {
    // A label overlay takes over link activation and prevents navigation.
    hapticTrigger(element);
  }
  const overlay = element.querySelector(":scope > [data-haptic-trigger]");
  const switchInput = overlay?.querySelector("input");
  if (switchInput) {
    switchInput.tabIndex = -1;
  }
  function vibrate() {
    if (!element?.matches(":disabled, [aria-disabled=true]")) {
      navigator.vibrate?.(12);
    }
  }
  element.addEventListener("click", vibrate);
  return () => {
    element.removeEventListener("click", vibrate);
    overlay?.remove();
    element.style.position = position;
    if (nativeInput && !hadSwitch) {
      element.removeAttribute("switch");
    }
  };
}
