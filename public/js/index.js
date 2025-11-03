/*
 * =============================================================
 * Eco Literario - Conectado a la API
 * =============================================================
 */

//const e = require("cors");

// --- Variables Globales y Constantes ---
const API_BASE_URL = "http://localhost:3000/api";
let currentBookId = null; // ID del libro que está en el modal
let carouselManager; // Instancia del gestor de carruseles

/**
 * -----------------------------------------------------------------
 * INICIALIZACIÓN (Punto de entrada)
 * -----------------------------------------------------------------
 * Se ejecuta cuando el HTML está completamente cargado.
 */
document.addEventListener("DOMContentLoaded", () => {
  // 1. Revisa si el usuario ya tiene un token guardado
  checkAuthenticationStatus();

  // 2. Inicializa los carruseles (pedirán datos a la API)
  carouselManager = new CarouselManager();
  carouselManager.initialize();

  // 3. Configura las estrellas interactivas del modal
  setupInteractiveStars();

  // 4. Configura la barra de búsqueda
  setupSearchEvents();

  // 5. Carga las estadísticas del Hero (libros, usuarios, reseñas)
  loadHeroStats();

  // 6. Configura listeners globales (ej. cerrar modal con 'Esc')
  setupGlobalListeners();

  // 7. Limpia cualquier script de la plantilla de Canva
  cleanupCanvaScripts();
});

/**
 * -----------------------------------------------------------------
 * LÓGICA DE AUTENTICACIÓN
 * -----------------------------------------------------------------
 */

/**
 * Revisa si hay un token en localStorage y actualiza la UI.
 * Muestra el Login Overlay o la App principal.
 */
function checkAuthenticationStatus() {
  const user = getUser();
  const token = getToken();
  const authOverlay = document.getElementById("auth-overlay");
  const mainApp = document.getElementById("main-app");

  if (user && token) {
    // Usuario está logueado
    authOverlay.classList.add("hidden"); // Oculta el login
    mainApp.classList.remove("hidden"); // Muestra la app
    updateProfileHeader(user); // Pone el nombre de usuario en el header
  } else {
    // Usuario no está logueado
    authOverlay.classList.remove("hidden"); // Muestra el login
    mainApp.classList.add("hidden"); // Oculta la app
    updateProfileHeader(null); // Pone "Iniciar Sesión" en el header
  }
}

/**
 * Maneja el envío del formulario de LOGIN.
 * Llamado por: onsubmit="handleLogin(event)" en tu HTML.
 */
async function handleLogin(event) {
  event.preventDefault(); // Evita que la página se recargue
  const email = document.getElementById("login-email").value;
  const password = document.getElementById("login-password").value;
  const button = event.target.querySelector('button[type="submit"]');

  setButtonLoading(button, true); // Muestra el spinner de carga

  try {
    // Llama al endpoint de login de tu API
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();

    if (data.success) {
      saveAuthData(data.data); // Guarda el token y usuario en localStorage
      checkAuthenticationStatus(); // Actualiza la UI (oculta login, muestra app)

      // Recarga los carruseles y estadísticas con los datos del usuario
      carouselManager.initialize();
      loadHeroStats();
      showNotification(
        `¡Bienvenido de vuelta, ${data.data.user.username}!`,
        "success"
      );
    } else {
      showAuthMessage(
        "login-message",
        data.message || "Error: Credenciales inválidas",
        "error"
      );
    }
  } catch (error) {
    showAuthMessage(
      "login-message",
      "Error de conexión con el servidor.",
      "error"
    );
  }

  setButtonLoading(button, false); // Oculta el spinner
}

/**
 * Maneja el envío del formulario de REGISTRO.
 * Llamado por: onsubmit="handleRegister(event)" en tu HTML.
 */
async function handleRegister(event) {
  event.preventDefault();
  const username = document.getElementById("register-username").value;
  const email = document.getElementById("register-email").value;
  const password = document.getElementById("register-password").value;
  const button = event.target.querySelector('button[type="submit"]');

  setButtonLoading(button, true);

  try {
    // Llama al endpoint de registro de tu API
    const response = await fetch(`${API_BASE_URL}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, email, password }),
    });

    const data = await response.json();

    if (data.success) {
      showAuthMessage(
        "register-message",
        "¡Registro exitoso! Iniciando sesión...",
        "success"
      );

      // Inicia sesión automáticamente después del registro
      saveAuthData(data.data);

      // Espera 1 segundo para que el usuario lea el mensaje
      setTimeout(() => {
        checkAuthenticationStatus(); // Actualiza la UI
        carouselManager.initialize();
        loadHeroStats();
        showNotification(`¡Bienvenido, ${data.data.user.username}!`, "success");
      }, 1000);
    } else {
      showAuthMessage(
        "register-message",
        data.message || "No se pudo crear la cuenta",
        "error"
      );
    }
  } catch (error) {
    showAuthMessage(
      "register-message",
      "Error de conexión con el servidor.",
      "error"
    );
  }

  setButtonLoading(button, false);
}

/**
 * Cierra la sesión, borra los datos de localStorage y recarga la página.
 * Llamado por: onclick="logout()" en tu HTML.
 */
function logout() {
  localStorage.removeItem("apiToken");
  localStorage.removeItem("user");
  window.location.reload(); // Recarga la página para mostrar el login
}

// --- Helpers de Autenticación (Storage y Fetch) ---

function saveAuthData(data) {
  localStorage.setItem("apiToken", data.token);
  localStorage.setItem("user", JSON.stringify(data.user));
}

function getToken() {
  return localStorage.getItem("apiToken");
}

function getUser() {
  const user = localStorage.getItem("user");
  return user ? JSON.parse(user) : null;
}

/**
 * Función central para hacer llamadas a la API.
 * Añade el token de autenticación a todas las peticiones.
 */
async function fetchWithAuth(url, options = {}) {
  const token = getToken();

  const headers = {
    "Content-Type": "application/json",
    ...options.headers,
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${url}`, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    // Token inválido o expirado
    console.warn("Token inválido o expirado. Cerrando sesión.");
    logout(); // Cierra la sesión
    throw new Error("No autorizado");
  }

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.message || `Error de red: ${response.status}`);
  }

  return response.json();
}

/**
 * -----------------------------------------------------------------
 * LÓGICA DE UI (Header, Formularios, Stats)
 * -----------------------------------------------------------------
 */

/**
 * Actualiza el header con el nombre del usuario o "Iniciar Sesión".
 */
function updateProfileHeader(user) {
  const userNameEl = document.getElementById("user-name");
  const profileInitialsEl = document.getElementById("profile-initials");
  const profileDropdownEl = document.getElementById("profile-dropdown");
  const profileSection = document.querySelector(".profile-section");

  if (user) {
    // Usuario Logueado
    userNameEl.textContent = user.username;
    profileInitialsEl.textContent = generateInitials(user.username);
    profileDropdownEl.innerHTML = `
            <div class="profile-dropdown-item" style="cursor: not-allowed; opacity: 0.5;">
               <svg viewbox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" /></svg>
               Ver perfil (Próximamente)
            </div>
            <div class="profile-dropdown-item" id="logout-button">
               <svg viewbox="0 0 24 24"><path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.59L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z" /></svg>
               Cerrar sesión
            </div>`;
    document.getElementById("logout-button").addEventListener("click", logout);
    profileSection.onclick = () => toggleProfileDropdown(); // Habilita el dropdown
  } else {
    // Usuario No Logueado
    userNameEl.textContent = "Iniciar Sesión";
    profileInitialsEl.textContent = "?";
    profileDropdownEl.innerHTML = ``; // Dropdown vacío
    profileSection.onclick = () => showLogin(); // El clic abre el login
  }
}

/**
 * Carga las estadísticas (total de libros, usuarios, etc.) desde la API.
 */
async function loadHeroStats() {
  try {
    const data = await fetchWithAuth("/utility/stats");
    if (data.success) {
      document.getElementById("stats-books").textContent = data.data.books || 0;
      document.getElementById("stats-users").textContent = data.data.users || 0;
      document.getElementById("stats-reviews").textContent =
        data.data.interactions || 0;
    }
  } catch (error) {
    console.error("Error cargando estadísticas:", error);
  }
}

// --- Helpers para UI de formularios ---

function showLogin() {
  document.getElementById("login-form").style.display = "block";
  document.getElementById("register-form").style.display = "none";
  clearAuthMessages();
}

function showRegister() {
  document.getElementById("login-form").style.display = "none";
  document.getElementById("register-form").style.display = "block";
  clearAuthMessages();
}

function clearAuthMessages() {
  document.getElementById("login-message").style.display = "none";
  document.getElementById("register-message").style.display = "none";
}

function showAuthMessage(messageId, text, type = "error") {
  const messageElement = document.getElementById(messageId);
  messageElement.textContent = text;
  messageElement.className = `auth-message ${type}`;
  messageElement.style.display = "block";
}

function setButtonLoading(button, isLoading) {
  const buttonText = button.querySelector(".button-text");
  const buttonLoader = button.querySelector(".button-loader");
  if (isLoading) {
    buttonText.style.opacity = "0";
    buttonLoader.style.display = "flex";
    button.disabled = true;
  } else {
    buttonText.style.opacity = "1";
    buttonLoader.style.display = "none";
    button.disabled = false;
  }
}

function generateInitials(fullName) {
  if (!fullName || typeof fullName !== "string") return "?";
  const names = fullName.trim().split(" ").filter(Boolean);
  if (names.length === 0) return "?";
  if (names.length === 1) return names[0].charAt(0).toUpperCase();
  return (names[0].charAt(0) + names[names.length - 1].charAt(0)).toUpperCase();
}

let isProfileDropdownVisible = false;
function toggleProfileDropdown() {
  if (getToken()) {
    // Solo funciona si está logueado
    const dropdown = document.getElementById("profile-dropdown");
    isProfileDropdownVisible = !isProfileDropdownVisible;
    dropdown.classList.toggle("show", isProfileDropdownVisible);
  }
}
function hideProfileDropdown() {
  isProfileDropdownVisible = false;
  document.getElementById("profile-dropdown").classList.remove("show");
}

/**
 * -----------------------------------------------------------------
 * LÓGICA DE CARRUSELES (Clase)
 * -----------------------------------------------------------------
 */
class CarouselManager {
  constructor() {
    this.carousels = {
      popular: {
        position: 0,
        maxPosition: 0,
        cardsPerView: 0,
        cardWidth: 0,
        totalCards: 0,
      },
      recommended: {
        position: 0,
        maxPosition: 0,
        cardsPerView: 0,
        cardWidth: 0,
        totalCards: 0,
      },
    };
    this.isMobile = window.innerWidth <= 768;
    this.isTablet = window.innerWidth <= 1024 && window.innerWidth > 768;
  }

  // Crear tarjeta de libro (CONECTADO A API)
  createBookCard(book) {
    const rating = book.averageRating || 0;
    const stars = Array.from({ length: 5 }, (_, i) => {
      return `<span class="star ${
        i < Math.floor(rating) ? "" : "empty"
      }">★</span>`;
    }).join("");

    return `
            <div class="book-card" onclick="openModal('${
              book._id
            }')" data-book-id="${book._id}">
                <div class="book-cover"><img src="${
                  book.coverImage || "default-cover.png"
                }" alt="${book.title}"></div>
                <div class="book-info">
                    <h4 class="book-title">${book.title}</h4>
                    <p class="book-author">${book.author}</p>
                    <div class="book-rating">
                        <div class="stars">${stars}</div>
                        <span class="rating-number">${rating.toFixed(1)}</span>
                    </div>
                </div>
            </div>
        `;
  }

  // Inicializar carrusel específico (CONECTADO A API)
  async initializeCarousel(type) {
    const carouselElement = document.getElementById(`${type}-carousel`);
    if (!carouselElement) return;

    carouselElement.innerHTML = `<p style="padding: 1rem; color: var(--text-secondary);">Cargando...</p>`;
    let books = [];
    try {
      if (type === "popular") {
        const data = await fetchWithAuth("/books?limit=10");
        books = data.data.books;
      } else if (type === "recommended") {
        if (!getToken()) {
          carouselElement.innerHTML = `<p style="padding: 1rem; color: var(--text-secondary); text-align: center;">Inicia sesión para ver tus recomendaciones.</p>`;
          return;
        }
        const data = await fetchWithAuth("/recommendations/hybrid?limit=10");
        books = data.data.recommendations.map((rec) => rec.book);
      }
    } catch (error) {
      console.error(`Error cargando carrusel ${type}:`, error);
      if (error.message !== "No autorizado") {
        // No mostrar error si es solo por no estar logueado
        carouselElement.innerHTML = `<p style="padding: 1rem; color: red;">Error al cargar libros.</p>`;
      }
      return;
    }

    if (books.length === 0) {
      carouselElement.innerHTML = `<p style="padding: 1rem; color: var(--text-secondary); text-align: center;">${
        type === "recommended"
          ? "¡Bienvenido! Valora libros para recibir recomendaciones."
          : "No hay libros para mostrar."
      }</p>`;
      return;
    }

    carouselElement.innerHTML = books
      .map((book) => this.createBookCard(book))
      .join("");
    this.carousels[type].totalCards = books.length;

    this.calculateDimensions(type);
    this.createIndicators(type);
    if (this.isMobile) {
      const track = carouselElement.parentElement;
      track.style.overflowX = "auto";
      track.style.scrollSnapType = "x mandatory";
      carouselElement.style.transition = "none";
    }
    this.updateNavigationButtons(type);
  }

  calculateDimensions(type) {
    const carousel = this.carousels[type];
    if (this.isMobile) {
      carousel.cardWidth = 260 + 24;
      carousel.cardsPerView = 1.2;
    } else if (this.isTablet) {
      carousel.cardWidth = 280 + 32;
      carousel.cardsPerView = 2.5;
    } else {
      carousel.cardWidth = 320 + 32;
      const wrapper = document
        .querySelector(`#${type}-carousel`)
        .closest(".carousel-wrapper");
      const wrapperWidth = wrapper.offsetWidth - 160;
      carousel.cardsPerView = Math.max(
        3,
        Math.floor(wrapperWidth / carousel.cardWidth)
      );
      if (window.innerWidth >= 1920) {
        carousel.cardsPerView = Math.max(
          4,
          Math.floor(wrapperWidth / carousel.cardWidth)
        );
      }
    }
    carousel.maxPosition = Math.max(
      0,
      carousel.totalCards - Math.floor(carousel.cardsPerView)
    );
  }

  createIndicators(type) {
    if (this.isMobile) return;
    const indicatorsContainer = document.getElementById(`${type}-indicators`);
    if (!indicatorsContainer) return;
    const carousel = this.carousels[type];
    const totalPages = Math.ceil(
      carousel.totalCards / Math.floor(carousel.cardsPerView)
    );
    indicatorsContainer.innerHTML = "";
    for (let i = 0; i < totalPages; i++) {
      const dot = document.createElement("div");
      dot.className = `carousel-dot ${i === 0 ? "active" : ""}`;
      dot.onclick = () => this.goToPage(type, i);
      indicatorsContainer.appendChild(dot);
    }
  }

  goToPage(type, page) {
    const carousel = this.carousels[type];
    const cardsPerPage = Math.floor(carousel.cardsPerView);
    carousel.position = Math.min(page * cardsPerPage, carousel.maxPosition);
    this.updateCarousel(type);
    this.updateIndicators(type);
  }

  updateCarousel(type) {
    const carouselElement = document.getElementById(`${type}-carousel`);
    if (!carouselElement) return;
    const carousel = this.carousels[type];
    if (this.isMobile) {
      const track = carouselElement.parentElement;
      track.scrollTo({
        left: carousel.position * carousel.cardWidth,
        behavior: "smooth",
      });
    } else {
      const translateX = -carousel.position * carousel.cardWidth;
      carouselElement.style.transform = `translateX(${translateX}px)`;
    }
    this.updateNavigationButtons(type);
  }

  updateNavigationButtons(type) {
    if (this.isMobile) return;
    const prevBtn = document.getElementById(`${type}-prev`);
    const nextBtn = document.getElementById(`${type}-next`);
    const carousel = this.carousels[type];
    if (prevBtn) prevBtn.classList.toggle("disabled", carousel.position <= 0);
    if (nextBtn)
      nextBtn.classList.toggle(
        "disabled",
        carousel.position >= carousel.maxPosition
      );
  }

  updateIndicators(type) {
    if (this.isMobile) return;
    const indicatorsContainer = document.getElementById(`${type}-indicators`);
    if (!indicatorsContainer) return;
    const carousel = this.carousels[type];
    const cardsPerPage = Math.floor(carousel.cardsPerView);
    const currentPage = Math.floor(carousel.position / cardsPerPage);
    const dots = indicatorsContainer.querySelectorAll(".carousel-dot");
    dots.forEach((dot, index) =>
      dot.classList.toggle("active", index === currentPage)
    );
  }

  move(type, direction) {
    const carousel = this.carousels[type];
    if (this.isMobile) {
      carousel.position += direction;
    } else {
      const moveAmount = Math.floor(carousel.cardsPerView);
      carousel.position += direction * moveAmount;
    }
    carousel.position = Math.max(
      0,
      Math.min(carousel.position, carousel.maxPosition)
    );
    this.updateCarousel(type);
    this.updateIndicators(type);
  }

  initialize() {
    this.initializeCarousel("popular");
    this.initializeCarousel("recommended");
    window.addEventListener("resize", () => {
      const wasMobile = this.isMobile;
      this.isMobile = window.innerWidth <= 768;
      if (wasMobile !== this.isMobile) {
        setTimeout(() => this.initialize(), 100);
      }
    });
  }
}

// Función global llamada desde el HTML
function moveCarousel(type, direction) {
  if (carouselManager) {
    carouselManager.move(type, direction);
  }
}

/**
 * -----------------------------------------------------------------
 * LÓGICA DE BÚSQUEDA
 * -----------------------------------------------------------------
 */
let searchTimeout;
let isSearchDropdownVisible = false;

async function performSearch(searchTerm) {
  const dropdown = document.getElementById("search-dropdown");
  if (searchTerm.length < 2) {
    hideSearchDropdown();
    return;
  }
  try {
    const data = await fetchWithAuth(
      `/books/search?q=${encodeURIComponent(searchTerm)}&limit=10`
    );
    if (data.success) {
      displaySearchResults(data.data.books, searchTerm);
      showSearchDropdown();
    } else {
      hideSearchDropdown();
    }
  } catch (error) {
    console.error("Error en búsqueda:", error);
    hideSearchDropdown();
  }
}

function displaySearchResults(results, searchTerm) {
  const dropdown = document.getElementById("search-dropdown");
  if (results.length === 0) {
    dropdown.innerHTML = `
            <div class="search-no-results">
                <div class="search-no-results-icon">📚</div>
                <div class="search-no-results-text">
                    No hay resultados para "${searchTerm}".
                </div>
            </div>
        `;
    return;
  }
  dropdown.innerHTML = results
    .map((book) => createSearchResultItem(book, searchTerm))
    .join("");
}

function createSearchResultItem(book, searchTerm) {
  const rating = book.averageRating || 0;
  const stars = Array.from(
    { length: 5 },
    (_, i) =>
      `<span class="star ${i < Math.floor(rating) ? "" : "empty"}">★</span>`
  ).join("");
  const highlightedTitle = highlightSearchTerm(book.title, searchTerm);
  const highlightedAuthor = highlightSearchTerm(book.author, searchTerm);

  return `
        <div class="search-result-item" onclick='selectSearchResult("${
          book._id
        }")'>
            <div class="search-result-cover"><img src="${
              book.coverImage || "default-cover.png"
            }" alt="${book.title}"></div>
            <div class="search-result-info">
                <div class="search-result-title">${highlightedTitle}</div>
                <div class="search-result-author">${highlightedAuthor}</div>
                <div class="search-result-rating">
                    <div class="search-result-stars">${stars}</div>
                    <span class="search-result-number">${rating.toFixed(
                      1
                    )}</span>
                </div>
            </div>
        </div>
    `;
}

function highlightSearchTerm(text, searchTerm) {
  if (!searchTerm || searchTerm.length < 1) return text;
  const regex = new RegExp(
    `(${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`,
    "gi"
  );
  return text.replace(
    regex,
    '<mark style="background: rgba(59, 130, 246, 0.3); color: inherit; padding: 0 2px; border-radius: 3px;">$1</mark>'
  );
}

function selectSearchResult(bookId) {
  hideSearchDropdown();
  document.getElementById("search-input").value = "";
  openModal(bookId);
}

function showSearchDropdown() {
  document.getElementById("search-dropdown").classList.add("show");
  isSearchDropdownVisible = true;
}
function hideSearchDropdown() {
  document.getElementById("search-dropdown").classList.remove("show");
  isSearchDropdownVisible = false;
}

function setupSearchEvents() {
  const searchInput = document.getElementById("search-input");
  searchInput.addEventListener("input", (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => performSearch(e.target.value), 150);
  });
  searchInput.addEventListener("keydown", (e) => {
    if (e.key === "Escape") hideSearchDropdown();
  });
  searchInput.addEventListener("focus", () => performSearch(searchInput.value));
  document.addEventListener("click", (e) => {
    const searchContainer = e.target.closest(".hero-search");
    if (!searchContainer) hideSearchDropdown();
  });
}

/**
 * -----------------------------------------------------------------
 * LÓGICA DEL MODAL (Reseñas y Valoraciones)
 * -----------------------------------------------------------------
 */

async function openModal(bookId) {
  if (!getToken()) {
    showNotification(
      "Debes iniciar sesión para ver los detalles del libro.",
      "error"
    );
    showLogin();
    return;
  }

  currentBookId = bookId;
  const modal = document.getElementById("review-modal");
  modal.classList.add("active");
  document.body.style.overflow = "hidden";

  // Mostrar estado de carga
  document.getElementById("modal-title").textContent = "Cargando...";
  document.getElementById("modal-author").textContent = "...";
  document.getElementById("modal-description").textContent = "...";
  document.getElementById("modal-cover").textContent = "...";

  try {
    // Hacemos TRES llamadas en paralelo
    const [bookData, breakdownData, userRatingData] = await Promise.all([
      fetchWithAuth(`/books/${bookId}`), // 1. Detalles del libro
      fetchWithAuth(`/interactions/breakdown/${bookId}`), // 2. Desglose de estrellas
      fetchWithAuth(`/interactions/user-rating/${bookId}`), // 3. Tu voto específico
    ]);

    if (
      !bookData.success ||
      !breakdownData.success ||
      !userRatingData.success
    ) {
      throw new Error("No se pudieron cargar los datos del modal");
    }

    const book = bookData.data.book;
    const breakdown = breakdownData.data.breakdown;
    const totalReviews = breakdownData.data.totalReviews;
    const averageRating = book.averageRating || 0;
    const userRating = userRatingData.data.ratingValue; // <-- ¡NUEVO! El voto del usuario (ej. 3 o null)

    document.getElementById("modal-title").textContent = book.title;
    document.getElementById("modal-author").textContent = book.author;
    document.getElementById("modal-description").textContent = book.description;
    document.getElementById("modal-cover").innerHTML = `<img src="${
      book.coverImage || "default-cover.png"
    }" alt="${book.title}">`;
    updateReviewsDisplay(averageRating, totalReviews, breakdown);

    loadUserRating(userRating);
    hideRecommendations();
    hideRatingMessage();
  } catch (error) {
    console.error("Error al abrir modal:", error);
    showNotification(error.message || "Error al cargar el libro", "error");
    closeModal();
  }
}

function closeModal() {
  document.getElementById("review-modal").classList.remove("active");
  document.body.style.overflow = "auto";
  currentBookId = null;
}

function updateReviewsDisplay(average, total, breakdown) {
  document.getElementById("average-rating").textContent = average.toFixed(1);
  document.getElementById(
    "total-reviews"
  ).textContent = `basado en ${total} reseñas`;

  const averageStarsContainer = document.getElementById("average-stars");
  const fullStars = Math.floor(average);
  averageStarsContainer.innerHTML = "";
  for (let i = 1; i <= 5; i++) {
    const star = document.createElement("span");
    star.className = i <= fullStars ? "star" : "star empty";
    star.textContent = "★";
    averageStarsContainer.appendChild(star);
  }

  for (let rating = 1; rating <= 5; rating++) {
    const count = breakdown[rating] || 0;
    const percentage = total > 0 ? (count / total) * 100 : 0;
    const barFill = document.getElementById(`rating-${rating}`);
    const countEl = document.getElementById(`count-${rating}`);
    if (barFill) barFill.style.width = `${percentage}%`;
    if (countEl) countEl.textContent = count;
  }
}

function loadUserRating(ratingValue) { // <-- Acepta el número, no el bookId
    const stars = document.querySelectorAll('.interactive-star');

    stars.forEach((star, index) => {
        // Si ratingValue es 3, index 0, 1, y 2 (que son < 3) se activarán.
        const shouldBeActive = ratingValue && (index < ratingValue);
        star.classList.toggle('active', shouldBeActive);
    });
}

function setupInteractiveStars() {
  const starsContainer = document.getElementById("interactive-stars");
  if (!starsContainer) return;

  starsContainer.addEventListener("click", (e) => {
    if (e.target.classList.contains("interactive-star")) {
      if (!getToken()) {
        showNotification("Debes iniciar sesión para valorar", "error");
        return;
      }
      const rating = parseInt(e.target.dataset.rating);
      const stars = starsContainer.querySelectorAll(".interactive-star");
      stars.forEach((s, i) => s.classList.toggle("active", i < rating));
      submitRating(rating);
    }
  });
}

async function submitRating(newRating) {
    if (!currentBookId || !getToken()) return;
    
    try {
        // 1. Registrar o actualizar la valoración en el backend
        const data = await fetchWithAuth(`/interactions/books/${currentBookId}/rate`, {
            method: 'POST',
            body: JSON.stringify({ ratingValue: newRating })
        });

        if (data.success) {
            showNotification('¡Valoración registrada!', 'success');
            
            // 2. Obtener los TRES datos actualizados de la API
            const [bookData, breakdownData] = await Promise.all([
                fetchWithAuth(`/books/${currentBookId}`),               // Detalles del libro (trae el nuevo promedio/conteo)
                fetchWithAuth(`/interactions/breakdown/${currentBookId}`) // Desglose de estrellas (trae el nuevo conteo de barras)
            ]);

            if (breakdownData.success && bookData.success) {
                const book = bookData.data.book;
                
                // Estos son los datos correctos del nuevo endpoint de desglose
                const newAverage = book.averageRating;
                const newTotalReviews = breakdownData.data.totalReviews;
                const newBreakdown = breakdownData.data.breakdown;

                // 3. Actualizar la UI del modal
                updateReviewsDisplay(newAverage, newTotalReviews, newBreakdown);
                
                // 4. Actualizar la tarjeta en la página principal
                updateBookCardRating(currentBookId, newAverage);
            }
            
            showRatingMessage();
            showRecommendations(currentBookId); // Muestra recomendaciones de contenido
        } else {
            showNotification(data.message || 'Error al enviar valoración', 'error');
        }
    } catch (error) {
        console.error('Error al enviar rating:', error);
        showNotification(error.message || 'Error de red al valorar', 'error');
    }
}

function updateBookCardRating(bookId, newRating) {
  const bookCard = document.querySelector(`[data-book-id="${bookId}"]`);
  if (!bookCard) return;
  const ratingElement = bookCard.querySelector(".rating-number");
  const starsContainer = bookCard.querySelector(".stars");
  if (ratingElement) ratingElement.textContent = newRating.toFixed(1);
  if (starsContainer) {
    const fullStars = Math.floor(newRating);
    starsContainer.innerHTML = Array.from(
      { length: 5 },
      (_, i) => `<span class="star ${i < fullStars ? "" : "empty"}">★</span>`
    ).join("");
  }
}

function showRatingMessage() {
  const message = document.getElementById("rating-message");
  message.style.display = "block";
  setTimeout(() => message.classList.add("show"), 10);
}
function hideRatingMessage() {
  const message = document.getElementById("rating-message");
  message.classList.remove("show");
  setTimeout(() => (message.style.display = "none"), 300);
}

async function showRecommendations(bookId) {
  const section = document.getElementById("recommendations-section");
  const grid = document.getElementById("recommendations-grid");
  if (!section || !grid) return;

  grid.innerHTML = `<p>Buscando libros similares...</p>`;
  section.classList.add("show");

  try {
    const data = await fetchWithAuth(
      `/recommendations/content/${bookId}?limit=3`
    );
    if (data.success && data.data.recommendations.length > 0) {
      const recommendations = data.data.recommendations;
      grid.innerHTML = recommendations
        .map((rec) => createRecommendationItem(rec.book))
        .join("");
    } else {
      grid.innerHTML = `<p>No encontramos libros similares por ahora.</p>`;
    }
  } catch (error) {
    console.error("Error cargando recomendaciones del modal:", error);
    grid.innerHTML = `<p>Error al cargar recomendaciones.</p>`;
  }
}

function createRecommendationItem(book) {
  return `
        <div class="recommendation-item" onclick='closeModal(); openModal("${
          book._id
        }")'>
            <div class="recommendation-cover"><img src="${
              book.coverImage || "default-cover.png"
            }" alt="${book.title}"></div>
            <div class="recommendation-title">${book.title}</div>
        </div>
    `;
}

function hideRecommendations() {
  const section = document.getElementById("recommendations-section");
  if (section) section.classList.remove("show");
}

/**
 * -----------------------------------------------------------------
 * LÓGICA DE UTILIDAD (Notificaciones, Listeners)
 * -----------------------------------------------------------------
 */

function setupGlobalListeners() {
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeModal();
      hideSearchDropdown();
    }
  });

  document.getElementById("review-modal").addEventListener("click", (e) => {
    if (e.target === e.currentTarget) closeModal();
  });

  document.addEventListener("click", (e) => {
    if (!e.target.closest(".profile-section")) hideProfileDropdown();
  });
}

function showNotification(message, type = "info") {
  const notification = document.createElement("div");
  notification.className = `notification ${type}`;
  notification.textContent = message;

  notification.style.cssText = `
        position: fixed; top: 2rem; right: 2rem;
        background: ${
          type === "success"
            ? "#10B981"
            : type === "error"
            ? "#EF4444"
            : "#3B82F6"
        };
        color: white; padding: 1rem 1.5rem; border-radius: 12px; font-weight: 600;
        font-size: 0.9rem; box-shadow: 0 8px 25px rgba(0, 0, 0, 0.2);
        z-index: 10000; transform: translateX(120%);
        transition: transform 0.3s ease-in-out;
        max-width: 300px; word-wrap: break-word;
    `;

  document.body.appendChild(notification);

  setTimeout(() => {
    notification.style.transform = "translateX(0)";
  }, 10);

  setTimeout(() => {
    notification.style.transform = "translateX(120%)";
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 300);
  }, 3000);
}

/**
 * Limpia los scripts de la plantilla de Canva.
 */
function cleanupCanvaScripts() {
  // Borra las funciones falsas que estaban en el HTML
  window.onConfigChange = undefined;
  window.mapToCapabilities = undefined;
  window.mapToEditPanelValues = undefined;

  // Borra los scripts de SDK de Canva del DOM
  const sdkScripts = [
    ...document.querySelectorAll('script[src*="_sdk.js"]'),
    ...document.querySelectorAll('script[src*="cdn.tailwindcss.com"]'),
    ...document.querySelectorAll('script[src*="cdn-cgi"]'),
  ];
  sdkScripts.forEach((script) => script.remove());
}
