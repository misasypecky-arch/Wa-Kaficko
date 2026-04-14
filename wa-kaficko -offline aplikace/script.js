
const API_URL = 'http://lmpss3.dev.spsejecna.net/procedure2.php';

let state = {
    users: [],
    drinkTypes: [],
    counts: {}
};

document.addEventListener('DOMContentLoaded', () => {
    initApp();
    document.getElementById('save-btn').addEventListener('click', saveData);
});

async function initApp() {
    try {
       
        const [usersRes, typesRes] = await Promise.all([
            fetch(`${API_URL}?cmd=getPeopleList`)
                .then(r => r.ok ? r.json() : null)
                .catch(() => null),
            fetch(`${API_URL}?cmd=getTypesList`)
                .then(r => r.ok ? r.json() : null)
                .catch(() => null)
        ]);

        
        state.users = (Array.isArray(usersRes) && usersRes.length > 0) ? usersRes : [
            { id: "1", name: "Masopust Lukáš" },
            { id: "2", name: "Molič Jan" },
            { id: "3", name: "Adamek Daniel" },
            { id: "4", name: "Weber David" }
        ];

        state.drinkTypes = (Array.isArray(typesRes) && typesRes.length > 0) ? typesRes : [
            "Mléko", "Espresso", "Coffe", "Long", "Doppio+"
        ];

        renderUsers();
        renderDrinks();
        loadLastUser();
    } catch (err) {
        console.error("Kritická chyba inicializace:", err);
    }
}


function renderUsers() {
    const select = document.getElementById('user-select');
    select.innerHTML = state.users.map(u => 
        `<option value="${u.id}">${u.name}</option>`
    ).join('');

    select.addEventListener('change', (e) => {
        saveUserToPersistence(e.target.value);
    });
}

function renderDrinks() {
    const container = document.getElementById('drinks-container');
    container.innerHTML = state.drinkTypes.map(type => {
        state.counts[type] = 0;
        return `
            <div class="drink-card">
                <div class="drink-info"><span>${type}</span></div>
                <div class="counter">
                    <button class="btn-circle" onclick="updateCount('${type}', -1)">-</button>
                    <span id="count-${type.replace(/\+/g, 'plus')}" class="count-val">0</span>
                    <button class="btn-circle" onclick="updateCount('${type}', 1)">+</button>
                </div>
            </div>
        `;
    }).join('');
}

function updateCount(type, delta) {
    const newVal = Math.max(0, state.counts[type] + delta);
    state.counts[type] = newVal;
    
    const elementId = `count-${type.replace(/\+/g, 'plus')}`;
    document.getElementById(elementId).innerText = newVal;
}


function saveUserToPersistence(userId) {
    localStorage.setItem('lastCoffeeUser', userId);
    document.cookie = `lastCoffeeUser=${userId}; max-age=${60*60*24*30}; path=/; SameSite=Lax`;
}

function loadLastUser() {
    const lastId = localStorage.getItem('lastCoffeeUser') || getCookie('lastCoffeeUser');
    if (lastId) {
        const select = document.getElementById('user-select');
        if (Array.from(select.options).some(opt => opt.value === lastId)) {
            select.value = lastId;
        }
    }
}

function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
}

async function saveData() {
    const userId = document.getElementById('user-select').value;
    const saveBtn = document.getElementById('save-btn');
    
    const payload = {
        user: userId,
        drinks: Object.keys(state.counts).map(type => ({
            type: type,
            value: state.counts[type]
        }))
    };

   
    updateDailySummary(payload.drinks);

    saveBtn.disabled = true;
    saveBtn.innerText = "Ukládám...";

    
    if (!navigator.onLine) {
        saveToOfflineQueue(payload);
        resetCounts();
        saveBtn.disabled = false;
        saveBtn.innerText = "Uložit záznam";
        return;
    }

    try {
        const response = await fetch(`${API_URL}?cmd=saveDrinks`, {
            method: 'POST',
            body: JSON.stringify(payload)
        });

        if (!response.ok) throw new Error("Server neodpověděl 200 OK");
        
        showToast("Záznam byl uložen!");
        resetCounts();
    } catch (err) {
        
        saveToOfflineQueue(payload);
        resetCounts();
    } finally {
        saveBtn.disabled = false;
        saveBtn.innerText = "Uložit záznam";
    }
}

function resetCounts() {
    Object.keys(state.counts).forEach(type => {
        state.counts[type] = 0;
        const elementId = `count-${type.replace(/\+/g, 'plus')}`;
        document.getElementById(elementId).innerText = 0;
    });
}

function showToast(msg) {
    const t = document.getElementById('toast');
    t.innerText = msg;
    t.classList.remove('hidden');
    setTimeout(() => t.classList.add('hidden'), 2500);
}

function saveToOfflineQueue(payload) {
    let queue = JSON.parse(localStorage.getItem('coffeeQueue')) || [];
    queue.push(payload);
    localStorage.setItem('coffeeQueue', JSON.stringify(queue));    
    alert("API není dostupné nebo jste offline. 💾 Záznam byl uložen LOKÁLNĚ do prohlížeče a odešle se automaticky po připojení.");
}

async function syncOfflineData() {
    let queue = JSON.parse(localStorage.getItem('coffeeQueue')) || [];
    if (queue.length === 0) return;

    showToast("Jste online, synchronizuji záznamy...");
    let remainingQueue = [];

    for (let payload of queue) {
        try {
            const response = await fetch(`${API_URL}?cmd=saveDrinks`, {
                method: 'POST',
                body: JSON.stringify(payload)
            });
            if (!response.ok) throw new Error("Chyba API při syncu");
        } catch (err) {
           
            remainingQueue.push(payload); 
        }
    }

    localStorage.setItem('coffeeQueue', JSON.stringify(remainingQueue));
    if (remainingQueue.length === 0) {
        showToast("Všechna offline data odeslána!");
    }
}
window.addEventListener('online', syncOfflineData);

function updateDailySummary(drinks) {
    const today = new Date().toLocaleDateString('cs-CZ');
    let summary = JSON.parse(localStorage.getItem('dailySummary')) || { date: today, drinks: {} };

    
    if (summary.date !== today) {
        summary = { date: today, drinks: {} };
    }

    drinks.forEach(d => {
        if (d.value > 0) {
            summary.drinks[d.type] = (summary.drinks[d.type] || 0) + d.value;
        }
    });

    localStorage.setItem('dailySummary', JSON.stringify(summary));
}

function showDailySummary() {
    const today = new Date().toLocaleDateString('cs-CZ');
    const summary = JSON.parse(localStorage.getItem('dailySummary'));

    if (!summary || summary.date !== today || Object.keys(summary.drinks).length === 0) {
        alert("Dnes jste si zatím žádnou kávu nezaznamenali. Běžte to napravit! ☕");
        return;
    }

    let text = `☕ Vaše dnešní skóre:\n\n`;
    for (const [type, count] of Object.entries(summary.drinks)) {
        text += `- ${type}: ${count}x\n`;
    }

    
    if ("Notification" in window) {
        if (Notification.permission === "granted") {
            new Notification("Kafíčko - Dnešní přehled", { body: text, icon: '☕' });
        } else if (Notification.permission !== "denied") {
            Notification.requestPermission().then(permission => {
                if (permission === "granted") {
                    new Notification("Kafíčko - Dnešní přehled", { body: text, icon: '☕' });
                } else {
                    alert(text); 
                }
            });
        } else {
            alert(text);
        }
    } else {
        alert(text);
    }
}
