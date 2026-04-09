import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore, collection, addDoc, getDocs, deleteDoc, doc, query, where, orderBy } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBT2G_lbbkavWkf2Mmmb820D-CzOPI8-dk",
  authDomain: "wardrobe-builder-9b049.firebaseapp.com",
  projectId: "wardrobe-builder-9b049",
  storageBucket: "wardrobe-builder-9b049.firebasestorage.app",
  messagingSenderId: "296610161659",
  appId: "1:296610161659:web:b7f57e9e76d5f44fd5215e",
  measurementId: "G-1X0J7F9ZGL"
};

const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);

let wardrobe = [];
let currentFilter = 'all';
let selectedItem = null;
let currentOccasion = 'casual';
let photoDataUrl = null;
let currentSlide = 0;
let totalSlides = 0;
let currentUser = null;

const HEADWEAR = ['Baseball Cap','Bucket Hat','Beanie','Hat'];
const CATEGORY_ICONS = {
  'T-Shirt':'👕','Shirt':'👔','Knitwear':'🧶','Jacket':'🧥','Coat':'🧥',
  'Hoodie':'🫧','Trousers':'👖','Jeans':'👖','Shorts':'🩳','Sneakers':'👟',
  'Boots':'🥾','Loafers':'👞','Sandals':'🩴','Baseball Cap':'🧢',
  'Bucket Hat':'🪖','Beanie':'🎩','Hat':'🎩','Accessories':'⌚','Other':'📦'
};
function getIcon(cat) { return CATEGORY_ICONS[cat] || '👔'; }
function isHeadwear(cat) { return HEADWEAR.includes(cat); }

onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUser = user;
    document.getElementById('auth-screen').style.display = 'none';
    document.getElementById('app').style.display = 'flex';
    document.getElementById('user-email-display').textContent = user.email;
    await loadWardrobe();
  } else {
    currentUser = null;
    wardrobe = [];
    document.getElementById('auth-screen').style.display = 'flex';
    document.getElementById('app').style.display = 'none';
  }
});

window.switchAuthTab = (tab) => {
  document.querySelectorAll('.auth-tab').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
  document.querySelector(`.auth-tab:${tab === 'login' ? 'first-child' : 'last-child'}`).classList.add('active');
  document.getElementById(`tab-${tab}`).classList.add('active');
  document.getElementById('auth-error').style.display = 'none';
};

function showAuthError(msg) {
  const el = document.getElementById('auth-error');
  el.textContent = msg;
  el.style.display = 'block';
}

window.handleLogin = async () => {
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  if (!email || !password) return showAuthError('Please fill in all fields.');
  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (e) {
    const msgs = { 'auth/invalid-credential': 'Incorrect email or password.', 'auth/user-not-found': 'No account found with that email.', 'auth/wrong-password': 'Incorrect password.' };
    showAuthError(msgs[e.code] || 'Sign in failed. Please try again.');
  }
};

window.handleSignup = async () => {
  const email = document.getElementById('signup-email').value.trim();
  const password = document.getElementById('signup-password').value;
  const confirm = document.getElementById('signup-confirm').value;
  if (!email || !password || !confirm) return showAuthError('Please fill in all fields.');
  if (password !== confirm) return showAuthError('Passwords do not match.');
  if (password.length < 6) return showAuthError('Password must be at least 6 characters.');
  try {
    await createUserWithEmailAndPassword(auth, email, password);
  } catch (e) {
    const msgs = { 'auth/email-already-in-use': 'An account with this email already exists.', 'auth/invalid-email': 'Please enter a valid email address.' };
    showAuthError(msgs[e.code] || 'Could not create account. Please try again.');
  }
};

window.handleSignOut = async () => {
  await signOut(auth);
  wardrobe = [];
  selectedItem = null;
};

async function loadWardrobe() {
  if (!currentUser) return;
  wardrobe = [];
  try {
    const q = query(collection(db, 'wardrobeItems'), where('userId', '==', currentUser.uid), orderBy('createdAt', 'asc'));
    const snap = await getDocs(q);
    snap.forEach(d => wardrobe.push({ id: d.id, ...d.data() }));
  } catch (e) {
    console.error('Load error:', e);
  }
  renderWardrobe();
  renderOutfitSelector();
}

async function saveItemToFirestore(item) {
  if (!currentUser) return null;
  const data = {
    userId: currentUser.uid,
    name: item.name,
    category: item.category,
    color: item.color || '',
    notes: item.notes || '',
    url: item.url || '',
    photo: item.photo || '',
    createdAt: new Date().toISOString()
  };
  const docRef = await addDoc(collection(db, 'wardrobeItems'), data);
  return docRef.id;
}

async function deleteItemFromFirestore(firestoreId) {
  await deleteDoc(doc(db, 'wardrobeItems', firestoreId));
}

window.switchInputTab = (tab, event) => {
  document.querySelectorAll('.input-tab').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.input-section').forEach(s => s.classList.remove('active'));
  event.target.classList.add('active');
  document.getElementById('tab-' + tab).classList.add('active');
};

window.addItemFromDesc = async () => {
  const name = document.getElementById('desc-name').value.trim();
  const cat = document.getElementById('desc-cat').value;
  const color = document.getElementById('desc-color').value.trim();
  const notes = document.getElementById('desc-notes').value.trim();
  if (!name) return alert('Please enter an item name.');
  await addItem({ name, category: cat || 'Other', color, notes });
  document.getElementById('desc-name').value = '';
  document.getElementById('desc-color').value = '';
  document.getElementById('desc-notes').value = '';
  document.getElementById('desc-cat').value = '';
};

window.addItemFromUrl = async () => {
  const url = document.getElementById('url-link').value.trim();
  const name = document.getElementById('url-name').value.trim() || 'Linked Item';
  const cat = document.getElementById('url-cat').value;
  if (!url) return alert('Please enter a URL.');
  await addItem({ name, category: cat || 'Other', url });
  document.getElementById('url-link').value = '';
  document.getElementById('url-name').value = '';
  document.getElementById('url-cat').value = '';
};

window.handlePhotoUpload = (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    photoDataUrl = ev.target.result;
    document.getElementById('photo-preview-img').src = photoDataUrl;
    document.getElementById('photo-preview').style.display = 'block';
  };
  reader.readAsDataURL(file);
};

window.addItemFromPhoto = async () => {
  const name = document.getElementById('photo-name').value.trim() || 'Uploaded Item';
  const cat = document.getElementById('photo-cat').value;
  const color = document.getElementById('photo-color').value.trim();
  await addItem({ name, category: cat || 'Other', color, photo: photoDataUrl });
  document.getElementById('photo-name').value = '';
  document.getElementById('photo-cat').value = '';
  document.getElementById('photo-color').value = '';
  document.getElementById('photo-preview').style.display = 'none';
  photoDataUrl = null;
};

async function addItem(item) {
  const firestoreId = await saveItemToFirestore(item);
  if (!firestoreId) return;
  item.id = firestoreId;
  wardrobe.push(item);
  renderWardrobe();
  renderOutfitSelector();
}

window.deleteItem = async (id) => {
  await deleteItemFromFirestore(id);
  wardrobe = wardrobe.filter(w => w.id !== id);
  if (selectedItem && selectedItem.id === id) selectedItem = null;
  renderWardrobe();
  renderOutfitSelector();
};

function renderWardrobe() {
  const grid = document.getElementById('wardrobe-grid');
  const empty = document.getElementById('empty-wardrobe');
  let filtered;
  if (currentFilter === 'all') filtered = wardrobe;
  else if (currentFilter === 'headwear') filtered = wardrobe.filter(w => isHeadwear(w.category));
  else filtered = wardrobe.filter(w => w.category === currentFilter);
  grid.querySelectorAll('.clothing-card').forEach(c => c.remove());
  if (wardrobe.length === 0) { empty.style.display = 'block'; return; }
  empty.style.display = 'none';
  filtered.forEach(item => {
    const card = document.createElement('div');
    card.className = 'clothing-card';
    card.innerHTML = `
      <button class="card-delete" onclick="deleteItem('${item.id}')">✕</button>
      <div class="card-icon">${item.photo ? `<img src="${item.photo}" alt="">` : getIcon(item.category)}</div>
      <div class="card-name">${item.name}</div>
      <div class="card-meta">${item.category}${item.color ? ' · ' + item.color : ''}</div>
      ${item.notes ? `<div class="card-tags"><span class="tag">${item.notes}</span></div>` : ''}
      ${item.url ? `<div class="card-tags"><span class="tag" style="color:var(--accent);cursor:pointer;" onclick="window.open('${item.url}','_blank')">↗ link</span></div>` : ''}
    `;
    grid.appendChild(card);
  });
}

window.filterWardrobe = (cat, btn) => {
  currentFilter = cat;
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderWardrobe();
};

function renderOutfitSelector() {
  const sel = document.getElementById('item-selector');
  const count = document.getElementById('item-count');
  count.textContent = wardrobe.length + ' item' + (wardrobe.length !== 1 ? 's' : '');
  if (wardrobe.length === 0) {
    sel.innerHTML = `<div class="empty-state" style="padding:20px;"><div class="e-icon" style="font-size:28px;">👆</div><p style="font-size:13px;">No items yet</p><span style="font-size:11px;">Add clothes in Wardrobe first</span></div>`;
    return;
  }
  sel.innerHTML = wardrobe.map(item => `
    <div class="selector-item ${selectedItem && selectedItem.id === item.id ? 'active' : ''}" onclick="selectItem('${item.id}')">
      <div class="si-icon">${item.photo ? `<img src="${item.photo}" alt="">` : getIcon(item.category)}</div>
      <div>
        <div class="si-name">${item.name}</div>
        <div class="si-meta">${item.category}${item.color ? ' · ' + item.color : ''}</div>
      </div>
    </div>
  `).join('');
}

window.selectItem = (id) => {
  selectedItem = wardrobe.find(w => w.id === id);
  renderOutfitSelector();
};

window.setOccasion = (btn, occ) => {
  currentOccasion = occ;
  document.querySelectorAll('.occasion-chip').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('custom-row').classList.remove('visible');
  document.getElementById('occasion-active').classList.remove('visible');
};

window.toggleCustomOccasion = () => {
  const row = document.getElementById('custom-row');
  const chip = document.getElementById('custom-chip');
  if (row.classList.contains('visible')) {
    row.classList.remove('visible');
  } else {
    document.querySelectorAll('.occasion-chip').forEach(b => b.classList.remove('active'));
    chip.classList.add('active');
    row.classList.add('visible');
    document.getElementById('custom-occasion-input').focus();
  }
};

window.confirmCustomOccasion = () => {
  const val = document.getElementById('custom-occasion-input').value.trim();
  if (!val) return;
  currentOccasion = val;
  document.getElementById('custom-row').classList.remove('visible');
  const d = document.getElementById('occasion-active');
  d.textContent = '✦ ' + val.toUpperCase();
  d.classList.add('visible');
  document.getElementById('custom-occasion-input').value = '';
};

window.goToSlide = (n) => {
  currentSlide = Math.max(0, Math.min(n, totalSlides - 1));
  const track = document.getElementById('cards-track');
  if (track) track.style.transform = `translateX(-${currentSlide * 100}%)`;
  document.querySelectorAll('.carousel-dot').forEach((d, i) => d.classList.toggle('active', i === currentSlide));
  const prev = document.getElementById('nav-prev');
  const next = document.getElementById('nav-next');
  if (prev) prev.disabled = currentSlide === 0;
  if (next) next.disabled = currentSlide === totalSlides - 1;
};

function renderOutfitCards(outfits, occasion) {
  const area = document.getElementById('outfits-area');
  totalSlides = outfits.length;
  currentSlide = 0;
  const dots = outfits.map((_, i) => `<div class="carousel-dot ${i === 0 ? 'active' : ''}" onclick="goToSlide(${i})"></div>`).join('');
  const cards = outfits.map((o, i) => {
    const matchedItems = o.items.map(itemName => {
      return wardrobe.find(w => w.name.toLowerCase().includes(itemName.toLowerCase()) || itemName.toLowerCase().includes(w.name.toLowerCase())) || { name: itemName, category: '' };
    });
    const itemCards = matchedItems.map(w => {
      const isAnchor = selectedItem && w.name === selectedItem.name;
      return `
        <div class="outfit-item-card ${isAnchor ? 'is-anchor' : ''}">
          <div class="outfit-item-icon">${w.photo ? `<img src="${w.photo}" alt="">` : getIcon(w.category)}</div>
          <div class="outfit-item-name">${w.name}</div>
          ${w.category ? `<div class="outfit-item-cat">${w.category}</div>` : ''}
          ${isAnchor ? `<div class="anchor-badge">anchor</div>` : ''}
        </div>`;
    }).join('');
    return `
      <div class="outfit-card">
        <div class="outfit-card-header">
          <div>
            <div class="outfit-card-num">LOOK ${i + 1} OF ${outfits.length}</div>
            <div class="outfit-card-title">${o.title.toUpperCase()}</div>
          </div>
          <div class="outfit-occasion-tag">${occasion.toUpperCase()}</div>
        </div>
        <div class="outfit-items-grid">${itemCards}</div>
        <div class="outfit-card-footer">
          <div class="outfit-stylist-note">${o.note}</div>
        </div>
      </div>`;
  }).join('');
  area.innerHTML = `
    <div class="carousel-wrap">
      <div class="carousel-header">
        <div class="carousel-title">YOUR LOOKS</div>
        <div class="carousel-nav">
          <div class="carousel-dots">${dots}</div>
          <button class="nav-btn" id="nav-prev" onclick="goToSlide(currentSlide - 1)" disabled>‹</button>
          <button class="nav-btn" id="nav-next" onclick="goToSlide(currentSlide + 1)">›</button>
        </div>
      </div>
      <div class="cards-viewport">
        <div class="cards-track" id="cards-track">${cards}</div>
      </div>
    </div>`;
  const viewport = area.querySelector('.cards-viewport');
  let startX = 0;
  viewport.addEventListener('touchstart', e => { startX = e.touches[0].clientX; }, { passive: true });
  viewport.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - startX;
    if (Math.abs(dx) > 40) goToSlide(currentSlide + (dx < 0 ? 1 : -1));
  });
}

window.generateOutfit = async () => {
  if (!selectedItem) return alert('Please select an anchor piece first.');
  if (wardrobe.length < 2) return alert('Add at least 2 items to your wardrobe first.');
  const area = document.getElementById('outfits-area');
  area.innerHTML = `<div class="thinking-card"><div class="dot-flashing"><span></span><span></span><span></span></div><div class="thinking-label">Styling your looks…</div></div>`;
  const wardrobeList = wardrobe.map(w => `- ${w.name} (${w.category}${w.color ? ', ' + w.color : ''}${w.notes ? ', ' + w.notes : ''})`).join('\n');
  const anchorDesc = `${selectedItem.name} (${selectedItem.category}${selectedItem.color ? ', ' + selectedItem.color : ''}${selectedItem.notes ? ', ' + selectedItem.notes : ''})`;
  const prompt = `You are a personal stylist. The user's wardrobe:\n\n${wardrobeList}\n\nAnchor piece: ${anchorDesc}\nOccasion: ${currentOccasion}\n\nSuggest 3 complete outfit combinations using ONLY items from the wardrobe list, always including the anchor piece. Use the exact item names as they appear in the wardrobe list. Headwear/accessories optional.\n\nRespond ONLY with JSON:\n{"outfits":[{"title":"Short outfit name","items":["exact item name","exact item name"],"note":"1-2 sentence stylist note"}]}`;
  try {
    const messages = selectedItem.photo
      ? [{ role: 'user', content: [{ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: selectedItem.photo.split(',')[1] } }, { type: 'text', text: prompt }] }]
      : [{ role: 'user', content: prompt }];
    const resp = await fetch('/api/generate-outfit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages })
    });
    const data = await resp.json();
    const text = data.content.map(b => b.text || '').join('');
    const clean = text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);
    renderOutfitCards(parsed.outfits, currentOccasion);
  } catch (e) {
    area.innerHTML = `<div class="error-card">Something went wrong. Please try again.</div>`;
  }
};

window.showView = (name, event) => {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('nav button').forEach(b => b.classList.remove('active'));
  document.getElementById('view-' + name).classList.add('active');
  event.target.classList.add('active');
  if (name === 'outfit') renderOutfitSelector();
};
