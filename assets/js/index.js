const navBar = document.querySelector(".nav-bar");
      const navList = document.querySelector(".nav-links");
      const navLinks = [...navList.querySelectorAll(".nav-link")];
      const indicator = document.querySelector(".nav-indicator");
      const burger = document.querySelector(".burger");
      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
      const subtitleRegion = document.querySelector(".hero-copy p");
      const subtitle = document.querySelector(".hero-subtitle-typing");
      const subtitleLines = [
        { text: "Hindi Sufi Bollywood Live Band", lang: "en" },
        { text: "हिंदी सूफ़ी बॉलीवुड लाइव बैंड", lang: "hi" },
      ];
      let subtitleLineIndex = 0;
      let subtitleText = subtitleLines[subtitleLineIndex].text;
      const segmenter = "Segmenter" in Intl ? new Intl.Segmenter(undefined, { granularity: "grapheme" }) : null;
      let subtitleCharacters = segmentSubtitle(subtitleText);
      let subtitleIndex = 0;
      let deletingSubtitle = false;
      let subtitleTimer;
      let activeLink = navList.querySelector('[aria-current="page"]') ?? navLinks[0];
      let hoveredLink = null;
      let indicatorFrame = 0;

      function segmentSubtitle(text) {
        return segmenter
          ? [...segmenter.segment(text)].map(({ segment }) => segment)
          : Array.from(text);
      }

      function typeSubtitle() {
        if (deletingSubtitle) {
          subtitleIndex -= 1;
          subtitle.textContent = subtitleCharacters.slice(0, subtitleIndex).join("");
          if (subtitleIndex === 0) {
            deletingSubtitle = false;
            subtitleLineIndex = (subtitleLineIndex + 1) % subtitleLines.length;
            subtitleText = subtitleLines[subtitleLineIndex].text;
            subtitleCharacters = segmentSubtitle(subtitleText);
            subtitleRegion.lang = subtitleLines[subtitleLineIndex].lang;
            subtitleRegion.setAttribute("aria-label", subtitleText);
            subtitleTimer = window.setTimeout(typeSubtitle, 500);
            return;
          }
          subtitleTimer = window.setTimeout(typeSubtitle, 35);
          return;
        }

        subtitleIndex += 1;
        subtitle.textContent = subtitleCharacters.slice(0, subtitleIndex).join("");
        if (subtitleIndex === subtitleCharacters.length) {
          deletingSubtitle = true;
          subtitleTimer = window.setTimeout(typeSubtitle, 1400);
          return;
        }
        subtitleTimer = window.setTimeout(typeSubtitle, 70);
      }

      if (reduceMotion.matches) {
        subtitle.textContent = subtitleText;
      } else {
        subtitle.textContent = "";
        subtitleTimer = window.setTimeout(typeSubtitle, 250);
      }

      reduceMotion.addEventListener("change", (event) => {
        window.clearTimeout(subtitleTimer);
        if (event.matches) {
          subtitle.textContent = subtitleText;
          return;
        }
        subtitleLineIndex = 0;
        subtitleText = subtitleLines[subtitleLineIndex].text;
        subtitleCharacters = segmentSubtitle(subtitleText);
        subtitleRegion.lang = subtitleLines[subtitleLineIndex].lang;
        subtitleRegion.setAttribute("aria-label", subtitleText);
        subtitleIndex = 0;
        deletingSubtitle = false;
        subtitle.textContent = "";
        subtitleTimer = window.setTimeout(typeSubtitle, 250);
      });

      function positionIndicator(link) {
        if (!link || window.matchMedia("(max-width: 880px)").matches) return;
        const listRect = navList.getBoundingClientRect();
        const linkRect = link.getBoundingClientRect();
        indicator.style.setProperty("--indicator-x", `${linkRect.left - listRect.left}px`);
        indicator.style.setProperty("--indicator-scale", `${linkRect.width / 150}`);
        if (!indicator.dataset.ready || indicator.dataset.ready === "false") {
          requestAnimationFrame(() => {
            indicator.dataset.ready = "true";
          });
        }
      }

      positionIndicator(activeLink);
      window.addEventListener("resize", () => positionIndicator(hoveredLink ?? activeLink));
      if ("ResizeObserver" in window) {
        const navObserver = new ResizeObserver(() => positionIndicator(hoveredLink ?? activeLink));
        navObserver.observe(navList);
      }
      document.fonts?.ready.then(() => positionIndicator(hoveredLink ?? activeLink));

      navLinks.forEach((link) => {
        link.addEventListener("pointerenter", (event) => {
          if (event.pointerType === "mouse" || event.pointerType === "pen") {
            hoveredLink = link;
            positionIndicator(link);
          }
        });

        link.addEventListener("focus", () => {
          hoveredLink = link;
          positionIndicator(link);
        });

        link.addEventListener("click", () => {
          navLinks.forEach((item) => item.removeAttribute("aria-current"));
          link.setAttribute("aria-current", "page");
          activeLink = link;
          hoveredLink = null;
          positionIndicator(activeLink);
          setMenuOpen(false);
        });
      });

      navList.addEventListener("pointerleave", () => {
        hoveredLink = null;
        positionIndicator(activeLink);
      });

      navList.addEventListener("focusout", (event) => {
        if (!navList.contains(event.relatedTarget)) {
          hoveredLink = null;
          positionIndicator(activeLink);
        }
      });

      function setMenuOpen(isOpen) {
        navList.classList.toggle("open", isOpen);
        burger.setAttribute("aria-expanded", String(isOpen));
        burger.setAttribute("aria-label", isOpen ? "Close menu" : "Open menu");
        burger.querySelector(".burger-open-icon").style.opacity = isOpen ? "0" : "1";
        burger.querySelector(".burger-close-icon").style.opacity = isOpen ? "1" : "0";
      }

      burger.addEventListener("click", () => {
        setMenuOpen(burger.getAttribute("aria-expanded") !== "true");
      });

      document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && burger.getAttribute("aria-expanded") === "true") {
          setMenuOpen(false);
          burger.focus();
        }
      });

      const lightSpring = {
        stiffness: 100,
        damping: 10,
        mass: 1,
      };
      let lightX = 0;
      let lightY = 0;
      let targetX = 0;
      let targetY = 0;
      let velocityX = 0;
      let velocityY = 0;
      let lastFrameTime = 0;
      let lightFrame = 0;

      function animateLight(time) {
        const elapsed = Math.min((time - lastFrameTime) / 1000 || 1 / 60, 1 / 30);
        lastFrameTime = time;

        const accelerationX = (lightSpring.stiffness * (targetX - lightX) - lightSpring.damping * velocityX) / lightSpring.mass;
        const accelerationY = (lightSpring.stiffness * (targetY - lightY) - lightSpring.damping * velocityY) / lightSpring.mass;
        velocityX += accelerationX * elapsed;
        velocityY += accelerationY * elapsed;
        lightX += velocityX * elapsed;
        lightY += velocityY * elapsed;

        navBar.style.setProperty("--mx", `${lightX}px`);
        navBar.style.setProperty("--my", `${lightY}px`);

        const unsettled = Math.hypot(targetX - lightX, targetY - lightY) > 0.5 || Math.hypot(velocityX, velocityY) > 0.5;
        if (unsettled) {
          lightFrame = requestAnimationFrame(animateLight);
        } else {
          lightX = targetX;
          lightY = targetY;
          navBar.style.setProperty("--mx", `${lightX}px`);
          navBar.style.setProperty("--my", `${lightY}px`);
          lightFrame = 0;
        }
      }

      navBar.addEventListener("pointermove", (event) => {
        if (reduceMotion.matches || (event.pointerType !== "mouse" && event.pointerType !== "pen")) return;
        const rect = navBar.getBoundingClientRect();
        targetX = event.clientX - rect.left;
        targetY = event.clientY - rect.top;
        navBar.style.setProperty("--light-opacity", "1");
        if (!lightFrame) {
          lastFrameTime = 0;
          lightFrame = requestAnimationFrame(animateLight);
        }
      });

      navBar.addEventListener("pointerleave", () => {
        navBar.style.setProperty("--light-opacity", "0");
      });
