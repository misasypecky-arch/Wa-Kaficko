
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
        // Přidali jsme r.ok pro kontrolu, jestli server nevrátil chybu (např. 404)
        const [usersRes, typesRes] = await Promise.all([
            fetch(`${API_URL}?cmd=getPeopleList`)
                .then(r => r.ok ? r.json() : null)
                .catch(() => null),
            fetch(`${API_URL}?cmd=getTypesList`)
                .then(r => r.ok ? r.json() : null)
                .catch(() => null)
        ]);

        // STRIKTNÍ KONTROLA: Použij z API jen tehdy, pokud je to opravdu pole (seznam)
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

    saveBtn.disabled = true;
    saveBtn.innerText = "Ukládám...";

    try {
        const response = await fetch(`${API_URL}?cmd=saveDrinks`, {
            method: 'POST',
            body: JSON.stringify(payload)
        });

        
        showToast("Záznam byl uložen!");
        resetCounts();
    } catch (err) {
        alert("Chyba při komunikaci s API.");
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