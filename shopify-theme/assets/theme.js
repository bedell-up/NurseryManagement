/* ============================================================
   Bloomsday Natives — Theme JavaScript
   Minimal, no dependencies
   ============================================================ */

'use strict';

// ── Utility ──────────────────────────────────────────────────
const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

function debounce(fn, ms = 200) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

// ── Toast notifications ───────────────────────────────────────
function showToast(msg, icon = '✓') {
  let el = $('#site-toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'site-toast';
    el.className = 'toast';
    document.body.appendChild(el);
  }
  el.innerHTML = `<span>${icon}</span> ${msg}`;
  el.classList.add('visible');
  clearTimeout(el._timeout);
  el._timeout = setTimeout(() => el.classList.remove('visible'), 3200);
}

// ── Header scroll state ───────────────────────────────────────
(function initHeader() {
  const header = $('.site-header');
  if (!header) return;
  const onScroll = debounce(() => {
    header.classList.toggle('scrolled', window.scrollY > 20);
  }, 50);
  window.addEventListener('scroll', onScroll, { passive: true });
})();

// ── Mobile menu toggle ────────────────────────────────────────
(function initMobileMenu() {
  const btn  = $('#mobile-menu-btn');
  const nav  = $('#mobile-nav');
  if (!btn || !nav) return;
  btn.addEventListener('click', () => {
    const open = nav.classList.toggle('open');
    btn.setAttribute('aria-expanded', open);
    btn.querySelector('.menu-icon-open').style.display  = open ? 'none'  : '';
    btn.querySelector('.menu-icon-close').style.display = open ? ''      : 'none';
  });
  // Close on outside click
  document.addEventListener('click', (e) => {
    if (!btn.contains(e.target) && !nav.contains(e.target)) {
      nav.classList.remove('open');
      btn.setAttribute('aria-expanded', false);
    }
  });
})();

// ── Quantity selector ─────────────────────────────────────────
(function initQuantity() {
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-quantity-btn]');
    if (!btn) return;
    const wrap = btn.closest('[data-quantity-wrap]');
    const input = wrap?.querySelector('input[name="quantity"]');
    if (!input) return;
    const step = btn.dataset.quantityBtn === 'plus' ? 1 : -1;
    const min  = parseInt(input.min || 1, 10);
    const max  = parseInt(input.max || 999, 10);
    input.value = Math.min(max, Math.max(min, parseInt(input.value || 1, 10) + step));
  });
})();

// ── Product variant selector ──────────────────────────────────
(function initVariants() {
  const form = $('#product-form');
  if (!form) return;

  const variantInput = form.querySelector('input[name="id"]');
  const variantBtns  = $$('.variant-btn', form);
  const priceEl      = $('#product-price');
  const comparePriceEl = $('#product-compare-price');
  const availEl      = $('#product-availability');
  const addBtn       = form.querySelector('.btn--add-to-cart');

  // Build variant map from Liquid-injected data
  const variantData = window.productVariants || [];

  function getSelectedOptions() {
    const selected = {};
    $$('[data-option-name]', form).forEach(wrap => {
      const name = wrap.dataset.optionName;
      const activeBtn = wrap.querySelector('.variant-btn.active');
      if (activeBtn) selected[name] = activeBtn.dataset.optionValue;
    });
    return selected;
  }

  function findVariant(selectedOptions) {
    return variantData.find(v =>
      v.options.every((opt, i) => opt === Object.values(selectedOptions)[i])
    );
  }

  function updateUI(variant) {
    if (!variant) return;
    if (variantInput) variantInput.value = variant.id;

    // Price
    if (priceEl) {
      const price = (variant.price / 100).toFixed(2);
      priceEl.textContent = `$${price}`;
      priceEl.classList.toggle('product-price--sale', !!variant.compare_at_price);
    }
    if (comparePriceEl) {
      const cp = variant.compare_at_price;
      comparePriceEl.textContent = cp ? `$${(cp / 100).toFixed(2)}` : '';
      comparePriceEl.style.display = cp ? '' : 'none';
    }

    // Availability
    if (availEl) {
      if (variant.available) {
        availEl.textContent = 'In stock';
        availEl.className = 'availability--in-stock';
      } else {
        availEl.textContent = 'Sold out';
        availEl.className = 'availability--out';
      }
    }

    // Add to cart button
    if (addBtn) {
      addBtn.disabled = !variant.available;
      addBtn.textContent = variant.available ? 'Add to Cart' : 'Sold Out';
    }
  }

  variantBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const wrap = btn.closest('[data-option-name]');
      $$('.variant-btn', wrap).forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const selected = getSelectedOptions();
      const variant  = findVariant(selected);
      if (variant) updateUI(variant);
    });
  });
})();

// ── Product image gallery ──────────────────────────────────────
(function initGallery() {
  const main   = $('#product-main-image');
  const thumbs = $$('.product-thumbnail');
  if (!main || !thumbs.length) return;

  thumbs.forEach(thumb => {
    thumb.addEventListener('click', () => {
      const src = thumb.dataset.src;
      const alt = thumb.dataset.alt || '';
      const img = main.querySelector('img');
      if (img && src) { img.src = src; img.alt = alt; }
      thumbs.forEach(t => t.classList.remove('active'));
      thumb.classList.add('active');
    });
  });
})();

// ── Add to cart ───────────────────────────────────────────────
(function initAddToCart() {
  const form = $('#product-form');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = form.querySelector('.btn--add-to-cart');
    if (!btn || btn.disabled) return;

    const id  = form.querySelector('input[name="id"]')?.value;
    const qty = parseInt(form.querySelector('input[name="quantity"]')?.value || 1, 10);
    if (!id) return;

    btn.classList.add('loading');
    const originalText = btn.textContent;
    btn.innerHTML = '<span class="spinner"></span> Adding…';

    try {
      const res = await fetch('/cart/add.js', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ id, quantity: qty }),
      });

      if (!res.ok) throw new Error('Failed');
      const data = await res.json();

      // Open drawer (it refreshes cart internally)
      CartDrawer.open();
      showToast('Added to cart 🌿');

    } catch (err) {
      showToast('Something went wrong — please try again.', '⚠');
    } finally {
      btn.classList.remove('loading');
      btn.textContent = originalText;
    }
  });
})();

// ── Cart count update ─────────────────────────────────────────
async function updateCartCount() {
  try {
    const res = await fetch('/cart.js', { headers: { 'Accept': 'application/json' } });
    const cart = await res.json();
    const counts = $$('.cart-count');
    counts.forEach(el => {
      el.textContent = cart.item_count;
      el.style.display = cart.item_count > 0 ? '' : 'none';
    });
  } catch {}
}

// ── Collection filter + search ────────────────────────────────
(function initCollectionFilter() {
  const filterBtns   = $$('.filter-btn[data-filter]');
  const searchInput  = $('#collection-search-input');
  const searchClear  = $('#collection-search-clear');
  const noResults    = $('#collection-no-results');
  const countEl      = $('.collection-count');

  if (!filterBtns.length && !searchInput) return;

  let activeFilter = 'all';
  let searchTerm   = '';

  function applyFilters() {
    const wraps = $$('.product-card-wrap');
    let visible = 0;

    wraps.forEach(wrap => {
      const type  = wrap.dataset.type  || '';
      const title = wrap.dataset.title || '';
      const sci   = wrap.dataset.sci   || '';

      const matchesFilter = activeFilter === 'all' || type === activeFilter;
      const matchesSearch = !searchTerm ||
        title.includes(searchTerm) ||
        sci.includes(searchTerm);

      const show = matchesFilter && matchesSearch;
      wrap.style.display = show ? '' : 'none';
      if (show) visible++;
    });

    // Update count
    if (countEl) {
      countEl.textContent = `${visible} plant${visible !== 1 ? 's' : ''}`;
    }

    // No-results state
    if (noResults) {
      noResults.style.display = visible === 0 && wraps.length > 0 ? '' : 'none';
    }
  }

  // Type filter buttons
  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      activeFilter = btn.dataset.filter;
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      applyFilters();
    });
  });

  // Search input
  if (searchInput) {
    searchInput.addEventListener('input', debounce(() => {
      searchTerm = searchInput.value.trim().toLowerCase();
      if (searchClear) searchClear.hidden = !searchTerm;
      applyFilters();
    }, 180));

    if (searchClear) {
      searchClear.addEventListener('click', () => {
        searchInput.value = '';
        searchTerm = '';
        searchClear.hidden = true;
        searchInput.focus();
        applyFilters();
      });
    }
  }
})();

// ── Collection sort ───────────────────────────────────────────
(function initCollectionSort() {
  const sortSel = $('#collection-sort');
  if (!sortSel) return;
  sortSel.addEventListener('change', () => {
    const url = new URL(window.location.href);
    url.searchParams.set('sort_by', sortSel.value);
    window.location.href = url.toString();
  });
})();

// ── Cart item removal ─────────────────────────────────────────
document.addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-cart-remove]');
  if (!btn) return;
  const key = btn.dataset.cartRemove;
  try {
    await fetch('/cart/change.js', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: key, quantity: 0 }),
    });
    window.location.reload();
  } catch {}
});

// ── Cart quantity update ──────────────────────────────────────
document.addEventListener('change', debounce(async (e) => {
  const input = e.target.closest('[data-cart-quantity]');
  if (!input) return;
  const key = input.dataset.cartQuantity;
  const qty = parseInt(input.value, 10);
  try {
    await fetch('/cart/change.js', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: key, quantity: qty }),
    });
    window.location.reload();
  } catch {}
}, 600));

// ── Cart Drawer ───────────────────────────────────────────────
const CartDrawer = (() => {
  const drawer  = document.getElementById('cart-drawer');
  const overlay = document.getElementById('cart-drawer-overlay');
  const closeBtn = document.getElementById('cart-drawer-close');
  const body    = document.getElementById('cart-drawer-body');
  const footer  = document.getElementById('cart-drawer-footer');
  const countEl = document.getElementById('drawer-item-count');
  const subtotalEl = document.getElementById('drawer-subtotal');

  if (!drawer) return { open: () => {}, refresh: () => {} };

  function formatMoney(cents) {
    return '$' + (cents / 100).toFixed(2);
  }

  function open() {
    drawer.classList.add('open');
    overlay.classList.add('open');
    drawer.setAttribute('aria-hidden', 'false');
    overlay.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    closeBtn?.focus();
    refresh();
  }

  function close() {
    drawer.classList.remove('open');
    overlay.classList.remove('open');
    drawer.setAttribute('aria-hidden', 'true');
    overlay.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  async function refresh() {
    if (!body) return;
    body.innerHTML = '<div class="cart-drawer__loading"><div class="spinner" style="border-color:rgba(44,95,46,0.2);border-top-color:var(--color-primary);"></div></div>';

    try {
      const res  = await fetch('/cart.js', { headers: { Accept: 'application/json' } });
      const cart = await res.json();
      render(cart);
    } catch {
      body.innerHTML = '<p style="text-align:center;padding:2rem;color:var(--color-text-muted);">Could not load cart.</p>';
    }
  }

  function render(cart) {
    // Update count badges everywhere
    $$('.cart-count').forEach(el => {
      el.textContent = cart.item_count;
      el.style.display = cart.item_count > 0 ? '' : 'none';
    });
    if (countEl) countEl.textContent = cart.item_count;

    if (cart.item_count === 0) {
      body.innerHTML = `
        <div class="cart-drawer__empty">
          <div class="cart-drawer__empty-icon">🌱</div>
          <h3 class="cart-drawer__empty-title">Your cart is empty</h3>
          <p class="cart-drawer__empty-text">Add some plants to get started.</p>
          <a href="/collections/all" class="btn btn--primary">Browse Plants</a>
        </div>`;
      if (footer) footer.style.display = 'none';
      return;
    }

    // Render items
    body.innerHTML = cart.items.map(item => `
      <div class="drawer-item" data-item-key="${item.key}">
        <a href="${item.url}" class="drawer-item__image" tabindex="-1">
          ${item.image
            ? `<img src="${item.image.replace(/(\.[a-z]+)$/, '_144x144$1')}" alt="${item.title}" width="72" height="72" loading="lazy">`
            : '<div class="drawer-item__image-placeholder">🌿</div>'}
        </a>
        <div class="drawer-item__details">
          <a href="${item.url}" class="drawer-item__name">${item.product_title}</a>
          ${item.variant_title && item.variant_title !== 'Default Title'
            ? `<span class="drawer-item__variant">${item.variant_title}</span>` : ''}
          <div class="drawer-item__bottom">
            <div class="drawer-item__qty">
              <button class="drawer-item__qty-btn" data-drawer-qty="${item.key}" data-change="-1" aria-label="Decrease">−</button>
              <span class="drawer-item__qty-val">${item.quantity}</span>
              <button class="drawer-item__qty-btn" data-drawer-qty="${item.key}" data-change="1" aria-label="Increase">+</button>
            </div>
            <span class="drawer-item__price">${formatMoney(item.final_line_price)}</span>
            <button class="drawer-item__remove" data-drawer-remove="${item.key}" aria-label="Remove ${item.title}">Remove</button>
          </div>
        </div>
      </div>`).join('');

    // Footer
    if (subtotalEl) subtotalEl.textContent = formatMoney(cart.total_price);
    if (footer) footer.style.display = '';
  }

  // Event listeners
  closeBtn?.addEventListener('click', close);
  overlay?.addEventListener('click', close);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });

  // Qty & remove from within drawer
  document.addEventListener('click', async (e) => {
    // Qty change
    const qtyBtn = e.target.closest('[data-drawer-qty]');
    if (qtyBtn) {
      const key    = qtyBtn.dataset.drawerQty;
      const change = parseInt(qtyBtn.dataset.change, 10);
      const item   = drawer.querySelector(`.drawer-item[data-item-key="${key}"]`);
      const valEl  = item?.querySelector('.drawer-item__qty-val');
      const current = parseInt(valEl?.textContent || '1', 10);
      const next   = Math.max(0, current + change);
      try {
        await fetch('/cart/change.js', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: key, quantity: next }),
        });
        refresh();
      } catch {}
      return;
    }

    // Remove
    const removeBtn = e.target.closest('[data-drawer-remove]');
    if (removeBtn) {
      const key = removeBtn.dataset.drawerRemove;
      try {
        await fetch('/cart/change.js', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: key, quantity: 0 }),
        });
        refresh();
      } catch {}
    }
  });

  return { open, close, refresh };
})();

// Open drawer when cart icon is clicked
document.addEventListener('click', (e) => {
  if (e.target.closest('#header-cart-icon-btn') || e.target.closest('.header-cart-btn')) {
    e.preventDefault();
    CartDrawer.open();
  }
});

// ── Init cart count on page load ──────────────────────────────
document.addEventListener('DOMContentLoaded', updateCartCount);
