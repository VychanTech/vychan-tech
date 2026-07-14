(function () {
  const accountPath = "/signin/";
  const downloadPath = "/download/";
  const supportPath = "/support/";
  const signOutPath = "/api/auth/logout?redirect=/";

  function onReady(callback) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", callback, { once: true });
      return;
    }
    callback();
  }

  function titleCase(value) {
    return String(value || "")
      .replace(/[_-]/g, " ")
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  function initials(email) {
    const name = String(email || "VT").trim();
    const localPart = name.includes("@") ? name.split("@")[0] : name;
    const pieces = localPart.split(/[._\-\s]+/).filter(Boolean);
    const text = (pieces[0] || "V").slice(0, 1) + (pieces[1] || "T").slice(0, 1);
    return text.toUpperCase();
  }

  function createLink(label, href) {
    const link = document.createElement("a");
    link.href = href;
    link.textContent = label;
    return link;
  }

  function normalizedTier(tier) {
    return String(tier || "free").toLowerCase();
  }

  function campaignContext() {
    const params = new URLSearchParams(window.location.search);
    const campaignId = String(
      params.get("campaign") || document.body.dataset.campaignId || "",
    ).toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 64);
    const pagePath = document.body.dataset.campaignPage || window.location.pathname;
    if (!campaignId || ![
      "/products/vai-studio/", "/products/vai-studio/founder/", "/signin/",
    ].includes(pagePath)) {
      return null;
    }
    return { campaignId, pagePath };
  }

  function emitCampaignEvent(context, eventType) {
    if (!context) {
      return;
    }
    fetch("/api/campaign/event", {
      method: "POST",
      credentials: "omit",
      cache: "no-store",
      keepalive: true,
      referrerPolicy: "no-referrer",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        campaign_id: context.campaignId,
        event_type: eventType,
        page_path: context.pagePath,
      }),
    }).catch(() => {});
  }

  function wireCampaignEvents() {
    const context = campaignContext();
    if (!context) {
      return;
    }
    emitCampaignEvent(context, "view");
    document.querySelectorAll("[data-campaign-event]").forEach((element) => {
      if (element.matches("a[data-plan-action]") && element.getAttribute("href")) {
        const destination = new URL(element.getAttribute("href"), window.location.origin);
        if (destination.origin === window.location.origin) {
          destination.searchParams.set("campaign", context.campaignId);
          element.setAttribute("href", destination.pathname + destination.search + destination.hash);
        }
      }
      element.addEventListener("click", () => {
        if (element.getAttribute("aria-disabled") === "true" || !element.getAttribute("href")) {
          return;
        }
        emitCampaignEvent(context, element.dataset.campaignEvent);
      });
    });
  }

  function isFounderTier(tier) {
    const normalized = normalizedTier(tier);
    return normalized === "founder" || normalized === "early_founder";
  }

  function planCoveredByTier(plan, tier) {
    const normalizedPlan = String(plan || "").toLowerCase();
    const normalized = normalizedTier(tier);
    if (normalized === "premium") {
      return normalizedPlan === "founder" || normalizedPlan === "premium";
    }
    if (isFounderTier(normalized)) {
      return normalizedPlan === "founder";
    }
    return false;
  }

  function disablePlanAction(link, label) {
    if (!link.dataset.originalHref) {
      link.dataset.originalHref = link.getAttribute("href") || "";
    }
    link.textContent = label;
    link.classList.add("disabled");
    link.setAttribute("aria-disabled", "true");
    link.removeAttribute("href");
  }

  function enablePlanAction(link, label) {
    const originalHref = link.dataset.originalHref || link.getAttribute("href") || accountPath;
    link.textContent = label;
    link.classList.remove("disabled");
    link.removeAttribute("aria-disabled");
    link.setAttribute("href", originalHref);
  }

  async function loadAccount() {
    try {
      const response = await fetch("/api/auth/me", {
        credentials: "include",
        redirect: "manual",
        headers: { Accept: "application/json" },
      });
      const contentType = (response.headers.get("content-type") || "").toLowerCase();
      if (!response.ok || !contentType.includes("application/json")) {
        return null;
      }
      const data = await response.json();
      return data && data.account ? data : null;
    } catch {
      return null;
    }
  }

  function replaceHeaderSignIn(data) {
    const account = data.account || {};
    const email = account.email || "VychanTech account";
    const tier = titleCase(account.tier || "free");
    const signIn = document.querySelector('.header-actions > .header-link[data-account-action="signin"]');
    if (!signIn || document.querySelector(".header-actions > .account-menu")) {
      return;
    }

    const menu = document.createElement("details");
    menu.className = "account-menu";

    const summary = document.createElement("summary");
    summary.setAttribute("aria-label", "Open account menu");

    const avatar = document.createElement("span");
    avatar.className = "account-avatar";
    avatar.textContent = initials(email);

    const label = document.createElement("span");
    label.className = "account-menu-label";
    label.textContent = "Account";

    const chip = document.createElement("span");
    chip.className = "account-menu-tier";
    chip.textContent = tier;

    summary.append(avatar, label, chip);

    const dropdown = document.createElement("div");
    dropdown.className = "account-dropdown";

    const meta = document.createElement("div");
    meta.className = "account-dropdown-meta";
    const metaLabel = document.createElement("span");
    metaLabel.textContent = "Signed in as";
    const metaEmail = document.createElement("strong");
    metaEmail.textContent = email;
    meta.append(metaLabel, metaEmail);

    dropdown.append(
      meta,
      createLink("Account overview", accountPath),
      createLink("Download VAI Studio", downloadPath),
      createLink("Support", supportPath),
    );
    const signOut = createLink("Sign Out", signOutPath);
    signOut.className = "account-signout";
    dropdown.append(signOut);

    menu.append(summary, dropdown);
    signIn.replaceWith(menu);
    wireHeaderMenu(menu);
  }

  function updateAccountLinks(data) {
    const account = data.account || {};
    const email = account.email || "";
    document.querySelectorAll(`a[data-account-action="signin"], a[href="${accountPath}"]`).forEach((link) => {
      if (link.closest(".account-dropdown")) {
        return;
      }
      const text = link.textContent.trim().toLowerCase();
      if (text === "sign in" || text === "open account") {
        link.textContent = "Account";
      }
    });

    const mobileNav = document.querySelector(".mobile-nav");
    if (mobileNav && email && !mobileNav.querySelector(".mobile-account-summary")) {
      const summary = document.createElement("div");
      summary.className = "mobile-account-summary";
      const small = document.createElement("span");
      small.textContent = "Signed in";
      const strong = document.createElement("strong");
      strong.textContent = email;
      summary.append(small, strong);
      mobileNav.prepend(summary);
    }
    if (mobileNav && email && !mobileNav.querySelector(".mobile-signout")) {
      const signOut = createLink("Sign out", signOutPath);
      signOut.className = "mobile-signout";
      mobileNav.append(signOut);
    }
  }

  function updatePlanActions(data) {
    const tier = data && data.account ? data.account.tier : "free";
    document.querySelectorAll("[data-plan-action]").forEach((link) => {
      const plan = String(link.dataset.planAction || "").toLowerCase();
      if (!plan) {
        return;
      }
      if (plan === "founder" && normalizedTier(tier) === "premium") {
        disablePlanAction(link, "Included with Premium");
        return;
      }
      if (planCoveredByTier(plan, tier)) {
        disablePlanAction(link, "Current plan");
        return;
      }
      enablePlanAction(link, plan === "premium" ? "Get Premium" : "Get Founder");
    });
  }

  function wireHeaderMenu(menu) {
    if (!menu || menu.dataset.menuWired === "true") {
      return;
    }
    menu.dataset.menuWired = "true";
    const summary = menu.querySelector(":scope > summary");

    menu.addEventListener("toggle", () => {
      if (summary) {
        const kind = menu.classList.contains("account-menu") ? "account menu" : "navigation menu";
        summary.setAttribute("aria-label", `${menu.open ? "Close" : "Open"} ${kind}`);
      }
      if (!menu.open) {
        return;
      }
      document.querySelectorAll(".header-actions > details[open]").forEach((otherMenu) => {
        if (otherMenu !== menu) {
          otherMenu.removeAttribute("open");
        }
      });
    });

    menu.addEventListener("click", (event) => {
      if (event.target.closest("a")) {
        menu.removeAttribute("open");
      }
    });

    document.addEventListener("click", (event) => {
      if (!menu.open || menu.contains(event.target)) {
        return;
      }
      menu.removeAttribute("open");
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        menu.removeAttribute("open");
      }
    });
  }

  window.addEventListener("vychan-account-loaded", (event) => {
    const data = event.detail;
    if (!data || !data.account) {
      return;
    }
    window.VychanAccount = data;
    replaceHeaderSignIn(data);
    updateAccountLinks(data);
    updatePlanActions(data);
  });

  onReady(async () => {
    wireHeaderMenu(document.querySelector(".mobile-menu"));
    wireCampaignEvents();
    const data = await loadAccount();
    if (!data) {
      window.dispatchEvent(new CustomEvent("vychan-account-unavailable"));
      return;
    }
    window.VychanAccount = data;
    replaceHeaderSignIn(data);
    updateAccountLinks(data);
    updatePlanActions(data);
    window.dispatchEvent(new CustomEvent("vychan-account-loaded", { detail: data }));
  });
}());
