(function (window) {
    const db = window.StaffPlanner.db;
    const tables = window.StaffPlanner.tables;

    const monthNames = [
        'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];
    const monthShort = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const weekLabels = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'];
    const storeLegendItems = [
        ['C', '#FACE68', 'Rumichaca entre Sucre y Colon', 'https://maps.app.goo.gl/GFjNtPVYuY8TQZvm9'],
        ['V', '#D2DCB6', 'Velez y Garcia Aviles', 'https://maps.app.goo.gl/vAzf9j127ZpVJq2XA'],
        ['S', '#5A9CB5', 'Lorenzo de Garaycoa entre Luque y Aguirre', 'https://maps.app.goo.gl/w1PL8sSKujL5LoFAA'],
        ['P', '#A7AAE1', 'Portete y la 19', 'https://maps.app.goo.gl/MGewoEzfABcrqLPk9'],
        ['T', '#FA6868', 'C.C. Plaza Tia Bastion', 'https://maps.app.goo.gl/BATM7wJ7jznPwcaq6'],
        ['J', '#DEE791', 'La Joya C.C. Plaza Diamante', 'https://maps.app.goo.gl/W1rf9nBUo4w4y4hu9'],
        ['M', '#2FA08E', 'Mapasingue Oeste C.C. Plaza Tia El Trebol', 'https://maps.app.goo.gl/nGmWBBGKC8mDEYLe9']
    ];

    function h(value) {
        return String(value ?? '').replace(/[&<>"']/g, (char) => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        }[char]));
    }

    function asText(value, fallback = '') {
        if (value === null || value === undefined || value === '') return fallback;
        return String(value);
    }

    function asInt(value, fallback = 0) {
        const parsed = parseInt(value, 10);
        return Number.isFinite(parsed) ? parsed : fallback;
    }

    function byId(rows, id) {
        return rows.find((row) => asInt(row.id, NaN) === asInt(id, NaN)) || null;
    }

    function dateKey(date) {
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    }

    function monthStart(date) {
        return new Date(date.getFullYear(), date.getMonth(), 1);
    }

    function monthEnd(date) {
        return new Date(date.getFullYear(), date.getMonth() + 1, 0);
    }

    function isLightColor(hexColor) {
        const hex = asText(hexColor, '#ffffff').replace('#', '');
        if (hex.length < 6) return true;
        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);
        return ((r * 299 + g * 587 + b * 114) / 1000) > 155;
    }

    function initials(name) {
        return asText(name, 'N').trim().split(/\s+/).filter(Boolean).map((part) => part[0]).join('').slice(0, 2).toUpperCase();
    }

    function storeBadge(store, size = 44) {
        const color = asText(store?.color_hex, '#0E9F8F');
        const textColor = isLightColor(color) ? '#111827' : '#ffffff';
        return `<span class="store-badge-ui" style="width:${size}px;height:${size}px;background:${h(color)};color:${textColor};font-size:${Math.max(11, Math.round(size / 3.2))}px">${h(asText(store?.alias_tienda, 'T'))}</span>`;
    }

    function internalTypeColor(type) {
        switch (asText(type).toUpperCase()) {
            case 'VACACIONES': return '#F59E0B';
            case 'PERMISO': return '#7C3AED';
            case 'LICENCIA': return '#2563EB';
            default: return '#0E9F8F';
        }
    }

    async function rows(query) {
        const { data, error } = await query;
        if (error) throw error;
        return data || [];
    }

    const app = {
        month: monthStart(new Date()),
        staffId: null,
        kind: 'staff',
        profile: null,
        stores: [],
        categories: [],
        schedules: [],

        async init() {
            const logged = sessionStorage.getItem('staffPlannerAuth') === 'true';
            const roleId = window.StaffPlanner.getRoleId();
            const staffId = sessionStorage.getItem('staffPlannerStaffId');
            if (logged && roleId === 4 && staffId) {
                this.staffId = asInt(staffId);
                this.kind = sessionStorage.getItem('staffPlannerRole') === 'personal' || sessionStorage.getItem('staffPlannerStaffKind') === 'personal' ? 'personal' : 'staff';
                this.showApp();
                await this.load();
                return;
            }
            this.showLogin();
        },

        showLogin() {
            document.getElementById('loginOverlay').classList.remove('hidden');
            document.getElementById('mainApp').classList.add('hidden');
            setTimeout(() => document.getElementById('loginPin')?.focus(), 50);
        },

        showApp() {
            document.getElementById('loginOverlay').classList.add('hidden');
            document.getElementById('mainApp').classList.remove('hidden');
        },

        async handlePinLogin() {
            const pinInput = document.getElementById('loginPin');
            const error = document.getElementById('loginError');
            const pin = pinInput.value.trim();
            error.classList.add('hidden');
            if (pin.length !== 4) {
                error.textContent = 'Ingresa un PIN de 4 digitos';
                error.classList.remove('hidden');
                return;
            }
            try {
                const promoter = (await rows(db.from(tables.impulsadoras).select('*').eq('pin', pin).limit(1)))[0];
                let internal = null;
                if (!promoter) {
                    internal = (await rows(db.from(tables.internalStaff).select('*').eq('pin', pin).limit(1)))[0];
                }
                const person = promoter || internal;
                if (!person) throw new Error('PIN no encontrado');
                if (person.Habilitado === false || person.habilitado === false) throw new Error('Usuario deshabilitado');
                this.staffId = asInt(person.id);
                this.kind = promoter ? 'staff' : 'personal';
                sessionStorage.setItem('staffPlannerAuth', 'true');
                sessionStorage.setItem('staffPlannerRole', this.kind);
                sessionStorage.setItem('staffPlannerStaffKind', this.kind);
                sessionStorage.setItem('staffPlannerStaffId', String(person.id));
                sessionStorage.setItem('staffPlannerRoleId', '4');
                sessionStorage.setItem('staffPlannerRoleName', promoter ? 'Impulsadora' : 'Personal Interno');
                sessionStorage.setItem('staffPlannerUser', JSON.stringify({ email: person.nombre_completo }));
                this.showApp();
                await this.load();
            } catch (err) {
                error.textContent = 'PIN invalido o usuario deshabilitado';
                error.classList.remove('hidden');
                pinInput.value = '';
                pinInput.focus();
            }
        },

        async load() {
            this.renderLoading();
            const first = dateKey(monthStart(this.month));
            const last = dateKey(monthEnd(this.month));
            if (this.kind === 'personal') {
                const [stores, profileRows, schedules] = await Promise.all([
                    rows(db.from(tables.stores).select('*')),
                    rows(db.from(tables.internalStaff).select('*').eq('id', this.staffId).limit(1)),
                    rows(db.from(tables.internalSchedule).select('*').eq('personal_id', this.staffId).gte('fecha', first).lte('fecha', last).order('fecha'))
                ]);
                this.stores = stores;
                this.profile = profileRows[0] || null;
                this.schedules = schedules;
                this.categories = [];
            } else {
                const [stores, promoters, categories, schedules] = await Promise.all([
                    rows(db.from(tables.stores).select('*')),
                    rows(db.from(tables.impulsadoras).select('*').eq('id', this.staffId).limit(1)),
                    rows(db.from(tables.categories).select('*')),
                    rows(db.from(tables.schedule).select('*').eq('impulsadora_id', this.staffId).gte('fecha', first).lte('fecha', last).order('fecha'))
                ]);
                this.stores = stores;
                this.profile = promoters[0] || null;
                this.categories = categories;
                this.schedules = schedules;
            }
            this.render();
        },

        renderLoading() {
            document.getElementById('mainApp').innerHTML = `<div class="planner-page"><header class="planner-topbar"><div><h1 class="app-page-title">Horario</h1><p class="app-page-subtitle">Cargando...</p></div></header>${'<div class="p-4 space-y-3"><div class="skeleton h-20 rounded-xl"></div><div class="skeleton h-20 rounded-xl"></div></div>'}</div>`;
        },

        render() {
            const name = asText(this.profile?.nombre_completo, 'Horario');
            document.getElementById('mainApp').innerHTML = `
                <div class="planner-page !pb-6">
                    <header class="planner-topbar">
                        <div class="planner-topbar-title">
                            <h1 class="app-page-title">Horario</h1>
                            <p class="app-page-subtitle">${h(monthNames[this.month.getMonth()])} ${this.month.getFullYear()}</p>
                        </div>
                        <button class="planner-icon-btn" onclick="SelfMobileApp.load()"><span class="material-icons">refresh</span></button>
                        <button class="planner-icon-btn" onclick="SelfMobileApp.logout()"><span class="material-icons">logout</span></button>
                    </header>
                    ${this.monthControls()}
                    <section class="self-calendar-card app-card">
                        ${this.profileHeader(name)}
                        ${this.statsRow()}
                        <div class="self-calendar">${this.calendarGrid()}</div>
                        <p class="text-center text-[11px] font-bold text-[#756c65] mt-3">Novepsa Planner</p>
                    </section>
                    ${this.storeLegend()}
                </div>`;
        },

        profileHeader(name) {
            const brand = this.kind === 'personal'
                ? asText(this.profile?.idVendedor || this.profile?.idvendedor, 'Personal interno')
                : asText(this.profile?.Marca, 'Sin marca');
            const category = this.kind === 'personal'
                ? 'Personal Interno'
                : asText(byId(this.categories, this.profile?.idCategoria)?.descripcion, 'Sin categoria');
            return `
                <div class="flex items-center gap-3 mb-4">
                    <span class="store-badge-ui" style="width:54px;height:54px;background:#111827;color:#fff">${h(initials(name))}</span>
                    <div class="flex-1 min-w-0">
                        <h2 class="text-[20px] font-black text-[#111827] leading-tight">${h(name)}</h2>
                        <p class="font-black text-[#e85d75]">${h(brand)}</p>
                        <p class="text-xs font-bold text-[#756c65]">${h(category)}</p>
                    </div>
                </div>`;
        },

        statsRow() {
            const stores = new Set(this.schedules.map((row) => asInt(row.tienda_id)));
            return `
                <div class="grid grid-cols-3 gap-2 mb-4">
                    <div class="rounded-xl bg-[#f8f4f0] p-3 text-center"><div class="text-xl font-black">${this.schedules.length}</div><div class="text-[10px] font-bold text-[#756c65]">dias asignados</div></div>
                    <div class="rounded-xl bg-[#f8f4f0] p-3 text-center"><div class="text-xl font-black">${stores.size}</div><div class="text-[10px] font-bold text-[#756c65]">puntos</div></div>
                    <div class="rounded-xl bg-[#f8f4f0] p-3 text-center"><div class="text-xl font-black">${monthShort[this.month.getMonth()]}</div><div class="text-[10px] font-bold text-[#756c65]">${this.month.getFullYear()}</div></div>
                </div>`;
        },

        calendarGrid() {
            const daysInMonth = monthEnd(this.month).getDate();
            const firstDay = monthStart(this.month);
            const leadingEmpty = firstDay.getDay();
            const totalCells = leadingEmpty + daysInMonth;
            const trailingEmpty = (7 - (totalCells % 7)) % 7;
            const cellCount = totalCells + trailingEmpty;
            let cells = '';
            for (let index = 0; index < cellCount; index += 1) {
                const day = index - leadingEmpty + 1;
                if (day < 1 || day > daysInMonth) {
                    cells += '<div class="calendar-cell blank"></div>';
                    continue;
                }
                const date = new Date(this.month.getFullYear(), this.month.getMonth(), day);
                const assignment = this.schedules.find((row) => asText(row.fecha) === dateKey(date));
                const isToday = dateKey(date) === dateKey(new Date());
                cells += `<div class="calendar-cell ${isToday ? 'today' : ''}"><span class="calendar-day-number">${day}</span><span class="mt-auto">${this.assignmentBadge(assignment)}</span></div>`;
            }
            return `<div class="calendar-week">${weekLabels.map((label) => `<div>${label}</div>`).join('')}</div><div class="calendar-grid">${cells}</div>`;
        },

        assignmentBadge(assignment) {
            if (!assignment) return '<span class="block h-[18px] rounded-md bg-[#f1ece7] text-center text-[10px] font-black text-[#b5aaa1]">-</span>';
            if (this.kind === 'personal') {
                const color = internalTypeColor(assignment.tipo);
                const textColor = isLightColor(color) ? '#111827' : '#ffffff';
                return `<span class="block rounded-md px-1 py-1 text-center text-[9px] font-black" style="background:${h(color)};color:${textColor}">${h(asText(assignment.tipo, 'TRABAJO'))}</span>`;
            }
            const store = byId(this.stores, assignment.tienda_id);
            const color = asText(store?.color_hex, '#0E9F8F');
            const textColor = isLightColor(color) ? '#111827' : '#ffffff';
            return `<span class="block rounded-md px-1 py-1 text-center text-[9px] font-black" style="background:${h(color)};color:${textColor}">${h(asText(store?.alias_tienda, 'T'))}</span>`;
        },

        monthControls() {
            return `
                <div class="month-controls">
                    <button class="month-arrow" onclick="SelfMobileApp.changeMonth(-1)"><span class="material-icons">chevron_left</span></button>
                    <div class="month-title">${h(monthNames[this.month.getMonth()])} ${this.month.getFullYear()}</div>
                    <button class="month-arrow" onclick="SelfMobileApp.changeMonth(1)"><span class="material-icons">chevron_right</span></button>
                </div>`;
        },

        storeLegend() {
            if (this.kind === 'personal') {
                return `<section class="agenda-list"><h2>Asignaciones</h2>${this.schedules.length ? this.schedules.map((row) => this.internalRow(row)).join('') : '<div class="empty-state"><span class="material-icons">event_busy</span><strong>Sin turnos este mes</strong><p>Cuando tengas asignaciones apareceran aqui.</p></div>'}</section>`;
            }
            return `
                <section class="agenda-list">
                    <h2>Tiendas</h2>
                    ${storeLegendItems.map((item) => this.legendRow(item)).join('')}
                </section>`;
        },

        internalRow(row) {
            const store = byId(this.stores, row.tienda_id);
            return `<article class="agenda-row">${storeBadge(store, 38)}<span class="flex-1 min-w-0"><span class="app-list-title block">${h(asText(row.fecha))}</span><span class="app-list-subtitle block">${h(asText(store?.nombre_display, 'Bodega/Tienda'))} - ${h(asText(row.tipo, 'TRABAJO'))}</span></span></article>`;
        },

        legendRow(item) {
            const [alias, color, address, mapsUrl] = item;
            const store = this.stores.find((row) => asText(row.alias_tienda).toUpperCase() === alias) || { alias_tienda: alias, color_hex: color, nombre_display: address };
            return `<article class="app-card mb-2"><div class="agenda-row" style="margin-bottom:0;background:#fff">${storeBadge(store, 44)}<span class="flex-1 min-w-0 app-list-title">${h(address)}</span><button class="planner-icon-btn" onclick="SelfMobileApp.openMap('${h(mapsUrl)}')"><span class="material-icons">map</span></button></div></article>`;
        },

        async changeMonth(delta) {
            this.month = new Date(this.month.getFullYear(), this.month.getMonth() + delta, 1);
            await this.load();
        },

        openMap(url) {
            window.open(url, '_blank', 'noopener');
        },

        logout() {
            sessionStorage.clear();
            window.location.href = 'login.html';
        }
    };

    window.SelfMobileApp = app;
})(window);
