interface SubscribeFormConfig {
  formId: string;
  emailId: string;
  successLabel: string;
  defaultButtonLabel: string;
  source?: string;
}

export function bindSubscribeForm(config: SubscribeFormConfig): void {
  const form = document.getElementById(config.formId) as HTMLFormElement | null;
  const feedback = form?.querySelector<HTMLElement>("[aria-live]") ?? null;
  const input = document.getElementById(
    config.emailId,
  ) as HTMLInputElement | null;

  if (!form || !feedback || !input) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = input.value.trim();
    if (!email) return;

    const btn = form.querySelector<HTMLButtonElement>("button[type=submit]");
    if (!btn) return;

    btn.disabled = true;
    btn.textContent = "Subscribing…";
    feedback.hidden = true;
    feedback.removeAttribute("data-status");

    try {
      const res = await fetch("/.netlify/functions/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          website:
            (form.elements.namedItem("website") as HTMLInputElement | null)
              ?.value ?? "",
          ...(config.source ? { source: config.source } : {}),
        }),
      });

      const data = await res.json();

      if (res.ok) {
        feedback.textContent = config.successLabel;
        feedback.dataset.status = "success";
        form.reset();
        btn.textContent = "You're in";
        btn.disabled = true;
      } else {
        feedback.textContent =
          (data as { error?: string }).error ??
          "Something went wrong. Please try again.";
        feedback.dataset.status = "error";
        btn.disabled = false;
        btn.textContent = config.defaultButtonLabel;
      }
    } catch {
      feedback.textContent = "Something went wrong. Please try again.";
      feedback.dataset.status = "error";
      btn.disabled = false;
      btn.textContent = config.defaultButtonLabel;
    } finally {
      feedback.hidden = false;
    }
  });
}
