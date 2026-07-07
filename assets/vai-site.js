(function () {
  const accountPath = "/login/";
  const downloadPath = "/vai-studio/download/";
  const supportPath = "/vai-studio/support/";
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
      createLink("Manage Account", accountPath),
      createLink("Link VAI Studio", `${accountPath}#link-vai-studio`),
      createLink("Download VAI Studio", downloadPath),
      createLink("Support", supportPath),
    );
    const signOut = createLink("Sign Out", signOutPath);
    signOut.className = "account-signout";
    dropdown.append(signOut);

    menu.append(summary, dropdown);
    signIn.replaceWith(menu);
    wireAccountMenu(menu);
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
  }

  function wireAccountMenu(menu) {
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
  });

  onReady(async () => {
    const data = await loadAccount();
    if (!data) {
      window.dispatchEvent(new CustomEvent("vychan-account-unavailable"));
      return;
    }
    window.VychanAccount = data;
    replaceHeaderSignIn(data);
    updateAccountLinks(data);
    window.dispatchEvent(new CustomEvent("vychan-account-loaded", { detail: data }));
  });
}());
