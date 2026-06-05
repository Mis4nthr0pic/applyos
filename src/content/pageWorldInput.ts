/** Run controlled-input commits in the page JS world (React _valueTracker lives there). */

export async function setControlledInputValueInPageWorld(
  element: HTMLInputElement | HTMLTextAreaElement,
  value: string
): Promise<void> {
  const token = crypto.randomUUID();
  element.dataset.applyosInsertToken = token;

  await new Promise<void>((resolve, reject) => {
    // The injected inline script runs synchronously on append and fires its done
    // event immediately, so a success resolves in milliseconds. This timeout only
    // elapses when a strict Content-Security-Policy blocks the inline script — keep
    // it short so the isolated-world fallback isn't stalled for seconds per field.
    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error("Timed out writing into the page form."));
    }, 1500);

    const cleanup = () => {
      window.clearTimeout(timeout);
      window.removeEventListener("applyos-controlled-insert-done", onDone);
      delete element.dataset.applyosInsertToken;
    };

    const onDone = (event: Event) => {
      const detail = (event as CustomEvent<{ token: string; ok: boolean }>).detail;
      if (detail?.token !== token) return;
      cleanup();
      if (detail.ok) resolve();
      else reject(new Error("The page form did not accept the inserted value."));
    };

    window.addEventListener("applyos-controlled-insert-done", onDone);

    const script = document.createElement("script");
    script.textContent = `(() => {
      const token = ${JSON.stringify(token)};
      const text = ${JSON.stringify(value)};
      try {
        const el = document.querySelector('[data-applyos-insert-token="' + token + '"]');
        if (!el) {
          window.dispatchEvent(new CustomEvent("applyos-controlled-insert-done", { detail: { token, ok: false } }));
          return;
        }
        const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
        const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
        if (!setter) {
          window.dispatchEvent(new CustomEvent("applyos-controlled-insert-done", { detail: { token, ok: false } }));
          return;
        }
        el.focus();
        const previous = el.value;
        setter.call(el, text);
        if (el._valueTracker) el._valueTracker.setValue(previous);
        el.dispatchEvent(new InputEvent("input", { bubbles: true, cancelable: true, composed: true, inputType: "insertFromPaste", data: text }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
        el.dispatchEvent(new FocusEvent("blur", { bubbles: true }));
        window.dispatchEvent(new CustomEvent("applyos-controlled-insert-done", { detail: { token, ok: Boolean(el.value.trim()) } }));
      } catch {
        window.dispatchEvent(new CustomEvent("applyos-controlled-insert-done", { detail: { token, ok: false } }));
      }
    })();`;
    (document.documentElement || document.head).appendChild(script);
    script.remove();
  });
}
